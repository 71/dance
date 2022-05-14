import * as vscode from "vscode";
import { Context } from "../../src/api";

import { Extension } from "../../src/state/extension";
import { ExpectedDocument } from "./utils";

const { executeCommand } = vscode.commands;

function delay(ms = 10) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function type(text: string) {
  await executeCommand("workbench.action.focusActiveEditorGroup");

  // We can't simply use
  //   await vscode.commands.executeCommand("type", { text });
  //
  // Since such insertions happen differently from actual, keyboard based
  // insertions.
  //
  // Keyboard based insertions emit a DidTextDocumentChange event first,
  // followed by a DidEditorSelectionsChange event. `type`-based insertions emit
  // DidTextDocumentChange events and DidEditorSelectionsChange events in a
  // somewhat more parallel way.
  //
  // At the time of writing, using `type` once produces these events with "abc":
  // - Text insert: "a"
  // - Text insert: "b" (at an offset from "a")
  // - Selection change
  // - Text insert: "c"
  // - Selection change
  //
  // Whereas keyboard-based events produce:
  // - Text insert: "a"
  // - Selection change
  // - Text insert: "b"
  // - Selection change
  // - Text insert: "c"
  // - Selection change
  for (const char of text) {
    await executeCommand("type", { text: char });
  }
}

async function deleteBefore(count = 1) {
  for (let i = 0; i < count; i++) {
    await executeCommand("deleteLeft");
  }
}

async function deleteAfter(count = 1) {
  for (let i = 0; i < count; i++) {
    await executeCommand("deleteRight");
  }
}

suite("History tests", function () {
  // Set up document.
  let document: vscode.TextDocument,
      editor: vscode.TextEditor,
      extension: Extension;

  this.beforeAll(async () => {
    document = await vscode.workspace.openTextDocument();
    editor = await vscode.window.showTextDocument(document);
    editor.options.insertSpaces = true;
    editor.options.tabSize = 2;

    extension = (await vscode.extensions.getExtension("gregoire.dance")!.activate()).extension;

    await new Promise<void>((resolve) => {
      const disposable = extension.editors.onModeDidChange(async () => {
        disposable.dispose();
        await extension.editors.getState(editor).setMode(extension.modes.get("insert")!);
        resolve();
      });
    });
  });

  this.afterAll(async () => {
    await executeCommand("workbench.action.closeActiveEditor");
  });

  async function record(f: () => Promise<void>) {
    const recorder = extension.recorder,
          recording = recorder.startRecording();

    await extension.editors.getState(editor).setMode(extension.modes.get("insert")!);
    await f();
    await extension.editors.getState(editor).setMode(extension.modes.get("normal")!);
    await delay(10);  // For VS Code to update the editor in the extension host.

    return recording.complete();
  }

  function testRepeat(name: string, document: string, run: () => Promise<void>) {
    test(name, async function () {
      const startDocument = ExpectedDocument.parseIndented(4, document);

      await startDocument.apply(editor);
      await delay(10);  // For VS Code to update the editor in the backend.

      const recording = await record(run),
            expectedDocument = ExpectedDocument.snapshot(editor);

      await startDocument.apply(editor);
      await delay(10);  // For VS Code to update the editor in the backend.

      await recording.replay(
        new Context(extension.editors.getState(editor), extension.cancellationToken));

      expectedDocument.assertEquals(editor);
    });
  }

  // TODO: test is flaky
  // testRepeat("insert a", `
  //   foo bar
  //    | 0
  // `, async () => {
  //   await type("a");
  // });

  // TODO: test is flaky
  // testRepeat("insert abc and delete c", `
  //   foo bar
  //    | 0
  // `, async () => {
  //   await type("abc");
  //   await deleteBefore(1);
  // });

  // TODO: test is flaky
  // testRepeat("insert abc and delete o", `
  //   foo bar
  //    | 0
  // `, async () => {
  //   await type("abc");
  //   await deleteAfter(1);
  // });

  // TODO: test does not pass
  // testRepeat("insert abc, left and delete b", `
  //   foo bar
  //    | 0
  // `, async () => {
  //   await type("abc");
  //   await executeCommand("dance.modes.set.normal");
  //   await executeCommand("dance.select.left.jump");
  //   await deleteBefore(1);
  // });
});
