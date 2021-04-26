import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("edit-join.md", function () {
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
            a b
            ^^^ 0
            c d
            ^^^ 0
            e f
            ^^^ 0
            g h
          `)),
          "initial-2": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            a b
              ^ 0
            c d
            e f
               ^ 1
            g h
            i j
          `)),

          "join": new Promise((resolve) => notifyDependents["join"] = resolve),
          "join-select": new Promise((resolve) => notifyDependents["join-select"] = resolve),
          "join-2": new Promise((resolve) => notifyDependents["join-2"] = resolve),
          "join-select-2": new Promise((resolve) => notifyDependents["join-select-2"] = resolve),
        };

  test("transition initial   > join         ", async function () {
    const beforeDocument = await documents["initial"];

    if (beforeDocument === undefined) {
      notifyDependents["join"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      a b c d e f
      ^^^^^^^^^^^ 0
      g h
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.edit.join");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["join"](afterDocument);
    } catch (e) {
      notifyDependents["join"](undefined);

      throw e;
    }
  });

  test("transition initial   > join-select  ", async function () {
    const beforeDocument = await documents["initial"];

    if (beforeDocument === undefined) {
      notifyDependents["join-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      a b c d e f
         ^ 0 ^ 1
      g h
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.edit.join.select");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["join-select"](afterDocument);
    } catch (e) {
      notifyDependents["join-select"](undefined);

      throw e;
    }
  });

  test("transition initial-2 > join-2       ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["join-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      a b c d
        ^ 0
      e f g h
         ^ 1
      i j
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.edit.join");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["join-2"](afterDocument);
    } catch (e) {
      notifyDependents["join-2"](undefined);

      throw e;
    }
  });

  test("transition initial-2 > join-select-2", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["join-select-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      a b c d
         ^ 0
      e f g h
         ^ 1
      i j
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.edit.join.select");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["join-select-2"](afterDocument);
    } catch (e) {
      notifyDependents["join-select-2"](undefined);

      throw e;
    }
  });
});
