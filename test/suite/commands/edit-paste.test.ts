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
          "initial": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            foo
            ^^^^ 0
            bar
          `)),

          "a-1": new Promise((resolve) => notifyDependents["a-1"] = resolve),
          "a-2": new Promise((resolve) => notifyDependents["a-2"] = resolve),
          "b-1": new Promise((resolve) => notifyDependents["b-1"] = resolve),
        };

  test("transition initial > a-1", async function () {
    const beforeDocument = await documents["initial"];

    if (beforeDocument === undefined) {
      notifyDependents["a-1"](undefined);
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
      notifyDependents["a-1"](afterDocument);
    } catch (e) {
      notifyDependents["a-1"](undefined);

      throw e;
    }
  });

  test("transition a-1     > a-2", async function () {
    const beforeDocument = await documents["a-1"];

    if (beforeDocument === undefined) {
      notifyDependents["a-2"](undefined);
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
      notifyDependents["a-2"](afterDocument);
    } catch (e) {
      notifyDependents["a-2"](undefined);

      throw e;
    }
  });

  test("transition initial > b-1", async function () {
    const beforeDocument = await documents["initial"];

    if (beforeDocument === undefined) {
      notifyDependents["b-1"](undefined);
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
      notifyDependents["b-1"](afterDocument);
    } catch (e) {
      notifyDependents["b-1"](undefined);

      throw e;
    }
  });
});
