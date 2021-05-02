import * as vscode from "vscode";

import { addDepthToCommandTests, ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("./test/suite/commands/edit-indent.md", function () {
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
          "1": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            The quick brown fox
            ^ 0
            jumps over the lazy
                               ^ 0
            dog.
          `)),
          "2": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            The quick brown fox
            ^ 0
            jumps over the lazy
                              ^ 0
            dog.
          `)),
          "3": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            The quick brown fox
            ^^^^^^^^^^^^^^^ 0
            jumps over the lazy
            dog.
          `)),
          "4": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            The quick brown fox
            |^^^^^^^^^^^^^^ 0
            jumps over the lazy
            dog.
          `)),
          "5": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            The quick brown fox
            ^^^^^^^^^^^^^^^^^^^^ 0
            jumps over the lazy
            dog.
          `)),
          "6": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            The quick brown fox
            | 0
            jumps over the lazy
            dog.
          `)),

          "1-indent": new Promise((resolve) => notifyDependents["1-indent"] = resolve),
          "2-indent": new Promise((resolve) => notifyDependents["2-indent"] = resolve),
          "3-indent": new Promise((resolve) => notifyDependents["3-indent"] = resolve),
          "4-indent": new Promise((resolve) => notifyDependents["4-indent"] = resolve),
          "5-indent": new Promise((resolve) => notifyDependents["5-indent"] = resolve),
          "6-indent": new Promise((resolve) => notifyDependents["6-indent"] = resolve),
        };

  test("1 > indent", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-indent"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/edit-indent.md:11:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-indent"](afterDocument);
    } catch (e) {
      notifyDependents["1-indent"](undefined);

      throw e;
    }
  });

  test("2 > indent", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-indent"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/edit-indent.md:34:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-indent"](afterDocument);
    } catch (e) {
      notifyDependents["2-indent"](undefined);

      throw e;
    }
  });

  test("3 > indent", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-indent"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/edit-indent.md:56:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-indent"](afterDocument);
    } catch (e) {
      notifyDependents["3-indent"](undefined);

      throw e;
    }
  });

  test("4 > indent", async function () {
    const beforeDocument = await documents["4"];

    if (beforeDocument === undefined) {
      notifyDependents["4-indent"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/edit-indent.md:77:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["4-indent"](afterDocument);
    } catch (e) {
      notifyDependents["4-indent"](undefined);

      throw e;
    }
  });

  test("5 > indent", async function () {
    const beforeDocument = await documents["5"];

    if (beforeDocument === undefined) {
      notifyDependents["5-indent"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/edit-indent.md:98:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["5-indent"](afterDocument);
    } catch (e) {
      notifyDependents["5-indent"](undefined);

      throw e;
    }
  });

  test("6 > indent", async function () {
    const beforeDocument = await documents["6"];

    if (beforeDocument === undefined) {
      notifyDependents["6-indent"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/edit-indent.md:120:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["6-indent"](afterDocument);
    } catch (e) {
      notifyDependents["6-indent"](undefined);

      throw e;
    }
  });

  addDepthToCommandTests(this);
});
