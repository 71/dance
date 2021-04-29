import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("seek-word-end.md", function () {
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
          "initial-1": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            private String foo;
               | 0
          `)),

          "word-end-1a": new Promise((resolve) => notifyDependents["word-end-1a"] = resolve),
          "word-end-1b": new Promise((resolve) => notifyDependents["word-end-1b"] = resolve),
          "word-end-with-count-1": new Promise((resolve) => notifyDependents["word-end-with-count-1"] = resolve),
        };

  test("transition initial-1   > word-end-1a          ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-1a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      private String foo;
         ^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.wordEnd");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-1a"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-1a"](undefined);

      throw e;
    }
  });

  test("transition word-end-1a > word-end-1b          ", async function () {
    const beforeDocument = await documents["word-end-1a"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-1b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      private String foo;
             ^^^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.wordEnd");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-1b"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-1b"](undefined);

      throw e;
    }
  });

  test("transition initial-1   > word-end-with-count-1", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-with-count-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      private String foo;
             ^^^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.wordEnd", { count: 2 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-with-count-1"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-with-count-1"](undefined);

      throw e;
    }
  });
});
