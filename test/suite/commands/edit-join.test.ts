import * as vscode from "vscode";

import { addDepthToCommandTests, ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("./test/suite/commands/edit-join.md", function () {
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
            a b
            ^^^ 0
            c d
            ^^^ 0
            e f
            ^^^ 0
            g h
          `)),
          "2": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            a b
              ^ 0
            c d
            e f
               ^ 1
            g h
            i j
          `)),

          "1-join": new Promise((resolve) => notifyDependents["1-join"] = resolve),
          "1-join-select": new Promise((resolve) => notifyDependents["1-join-select"] = resolve),
          "2-join": new Promise((resolve) => notifyDependents["2-join"] = resolve),
          "2-join-select": new Promise((resolve) => notifyDependents["2-join-select"] = resolve),
        };

  test("1 > join", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-join"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/edit-join.md:13:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-join"](afterDocument);
    } catch (e) {
      notifyDependents["1-join"](undefined);

      throw e;
    }
  });

  test("1 > join-select", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-join-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/edit-join.md:24:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-join-select"](afterDocument);
    } catch (e) {
      notifyDependents["1-join-select"](undefined);

      throw e;
    }
  });

  test("2 > join", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-join"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/edit-join.md:47:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-join"](afterDocument);
    } catch (e) {
      notifyDependents["2-join"](undefined);

      throw e;
    }
  });

  test("2 > join-select", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-join-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/edit-join.md:60:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-join-select"](afterDocument);
    } catch (e) {
      notifyDependents["2-join-select"](undefined);

      throw e;
    }
  });

  addDepthToCommandTests(this);
});
