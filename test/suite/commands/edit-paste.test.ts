import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("edit-paste.md", function () {
  // Set up document.
  let document: vscode.TextDocument,
      editor: vscode.TextEditor;

  this.beforeAll(async () => {
    document = await vscode.workspace.openTextDocument();
    editor = await vscode.window.showTextDocument(document);

    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });
  });

  this.afterAll(async () => {
    await executeCommand("workbench.action.closeActiveEditor");
  });

  // Each test sets up using its previous document, and notifies its
  // dependents that it is done by writing its document to `documents`.
  // This ensures that tests are executed in the right order, and that we skip
  // tests whose dependencies failed.
  const notifyDependents: Record<string, (document: ExpectedDocument | undefined) => void> = {},
        documents: Record<string, Promise<ExpectedDocument | undefined>> = {
          "1": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            foo
            ^^^^ 0
            bar
          `)),

          "1-paste": new Promise((resolve) => notifyDependents["1-paste"] = resolve),
          "1-paste-x": new Promise((resolve) => notifyDependents["1-paste-x"] = resolve),
          "1-move-then-paste": new Promise((resolve) => notifyDependents["1-move-then-paste"] = resolve),
          "1-move-then-paste-move-2-then-paste": new Promise((resolve) => notifyDependents["1-move-then-paste-move-2-then-paste"] = resolve),
        };

  test("transition 1                 > 1-paste                            ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-paste"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      ^^^^ 0
      foo
      bar
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.selections.saveText");
      await executeCommand("dance.edit.paste.after");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-paste"](afterDocument);
    } catch (e) {
      notifyDependents["1-paste"](undefined);

      throw e;
    }
  });

  test("transition 1-paste           > 1-paste-x                          ", async function () {
    const beforeDocument = await documents["1-paste"];

    if (beforeDocument === undefined) {
      notifyDependents["1-paste-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      ^^^^ 0
      foo
      foo
      bar
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.edit.paste.after");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-paste-x"](afterDocument);
    } catch (e) {
      notifyDependents["1-paste-x"](undefined);

      throw e;
    }
  });

  test("transition 1                 > 1-move-then-paste                  ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-move-then-paste"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
         | 0
      foo
      bar
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.left.jump");
      await executeCommand("dance.edit.paste.after");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-move-then-paste"](afterDocument);
    } catch (e) {
      notifyDependents["1-move-then-paste"](undefined);

      throw e;
    }
  });

  test("transition 1-move-then-paste > 1-move-then-paste-move-2-then-paste", async function () {
    const beforeDocument = await documents["1-move-then-paste"];

    if (beforeDocument === undefined) {
      notifyDependents["1-move-then-paste-move-2-then-paste"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foooo
       ^^ 0
      foo
      bar
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.left.extend", { count: 2 });
      await executeCommand("dance.selections.saveText");
      await executeCommand("dance.edit.paste.after");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-move-then-paste-move-2-then-paste"](afterDocument);
    } catch (e) {
      notifyDependents["1-move-then-paste-move-2-then-paste"](undefined);

      throw e;
    }
  });
});
