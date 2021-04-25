import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("edit-indent.md", function () {
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
            The quick brown fox
            ^ 0
            jumps over the lazy
                               ^ 0
            dog.
          `)),
          "initial-2": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            The quick brown fox
            ^ 0
            jumps over the lazy
                              ^ 0
            dog.
          `)),
          "initial-3": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            The quick brown fox
            ^^^^^^^^^^^^^^^ 0
            jumps over the lazy
            dog.
          `)),
          "initial-4": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            The quick brown fox
            |^^^^^^^^^^^^^^ 0
            jumps over the lazy
            dog.
          `)),
          "initial-5": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            The quick brown fox
            ^^^^^^^^^^^^^^^^^^^^ 0
            jumps over the lazy
            dog.
          `)),
          "initial-6": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            The quick brown fox
            | 0
            jumps over the lazy
            dog.
          `)),

          "indent-1": new Promise((resolve) => notifyDependents["indent-1"] = resolve),
          "indent-2": new Promise((resolve) => notifyDependents["indent-2"] = resolve),
          "indent-3": new Promise((resolve) => notifyDependents["indent-3"] = resolve),
          "indent-4": new Promise((resolve) => notifyDependents["indent-4"] = resolve),
          "indent-5": new Promise((resolve) => notifyDependents["indent-5"] = resolve),
          "indent-6": new Promise((resolve) => notifyDependents["indent-6"] = resolve),
        };

  test("transition initial-1 > indent-1", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["indent-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
        The quick brown fox
        ^ 0
        jumps over the lazy
                           ^ 0
      dog.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.edit.indent");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["indent-1"](afterDocument);
    } catch (e) {
      notifyDependents["indent-1"](undefined);

      throw e;
    }
  });

  test("transition initial-2 > indent-2", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["indent-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
        The quick brown fox
        ^ 0
        jumps over the lazy
                          ^ 0
      dog.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.edit.indent");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["indent-2"](afterDocument);
    } catch (e) {
      notifyDependents["indent-2"](undefined);

      throw e;
    }
  });

  test("transition initial-3 > indent-3", async function () {
    const beforeDocument = await documents["initial-3"];

    if (beforeDocument === undefined) {
      notifyDependents["indent-3"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
        The quick brown fox
        ^^^^^^^^^^^^^^^ 0
      jumps over the lazy
      dog.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.edit.indent");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["indent-3"](afterDocument);
    } catch (e) {
      notifyDependents["indent-3"](undefined);

      throw e;
    }
  });

  test("transition initial-4 > indent-4", async function () {
    const beforeDocument = await documents["initial-4"];

    if (beforeDocument === undefined) {
      notifyDependents["indent-4"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
        The quick brown fox
        |^^^^^^^^^^^^^^ 0
      jumps over the lazy
      dog.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.edit.indent");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["indent-4"](afterDocument);
    } catch (e) {
      notifyDependents["indent-4"](undefined);

      throw e;
    }
  });

  test("transition initial-5 > indent-5", async function () {
    const beforeDocument = await documents["initial-5"];

    if (beforeDocument === undefined) {
      notifyDependents["indent-5"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
        The quick brown fox
        ^^^^^^^^^^^^^^^^^^^^ 0
      jumps over the lazy
      dog.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.edit.indent");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["indent-5"](afterDocument);
    } catch (e) {
      notifyDependents["indent-5"](undefined);

      throw e;
    }
  });

  test("transition initial-6 > indent-6", async function () {
    const beforeDocument = await documents["initial-6"];

    if (beforeDocument === undefined) {
      notifyDependents["indent-6"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
        The quick brown fox
        | 0
      jumps over the lazy
      dog.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.edit.indent");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["indent-6"](afterDocument);
    } catch (e) {
      notifyDependents["indent-6"](undefined);

      throw e;
    }
  });
});
