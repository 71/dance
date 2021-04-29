import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("selections-copy.md", function () {
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
            foo
            ^ 0
            bar
            baz
            qux
          `)),
          "initial-2": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            aaa aaa aaa
              bb bb bb bb
               ^ 0     ^^ 1
                cc cc cc cc
                  ddd
                 ee
                f
              gg gg gg gg gg
          `)),
          "initial-3": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            ab
              ^ 0
            cd
            efg
            hi
          `)),

          "copy-1a": new Promise((resolve) => notifyDependents["copy-1a"] = resolve),
          "copy-1b": new Promise((resolve) => notifyDependents["copy-1b"] = resolve),
          "copy-2a": new Promise((resolve) => notifyDependents["copy-2a"] = resolve),
          "copy-2aa": new Promise((resolve) => notifyDependents["copy-2aa"] = resolve),
          "copy-2aaa": new Promise((resolve) => notifyDependents["copy-2aaa"] = resolve),
          "copy-3a": new Promise((resolve) => notifyDependents["copy-3a"] = resolve),
          "copy-3aa": new Promise((resolve) => notifyDependents["copy-3aa"] = resolve),
        };

  test("transition initial-1 > copy-1a  ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["copy-1a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      ^ 1
      bar
      ^ 0
      baz
      qux
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.selections.copy");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["copy-1a"](afterDocument);
    } catch (e) {
      notifyDependents["copy-1a"](undefined);

      throw e;
    }
  });

  test("transition copy-1a   > copy-1b  ", async function () {
    const beforeDocument = await documents["copy-1a"];

    if (beforeDocument === undefined) {
      notifyDependents["copy-1b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      ^ 2
      bar
      ^ 1
      baz
      ^ 0
      qux
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.selections.copy");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["copy-1b"](afterDocument);
    } catch (e) {
      notifyDependents["copy-1b"](undefined);

      throw e;
    }
  });

  test("transition initial-2 > copy-2a  ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["copy-2a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      aaa aaa aaa
        bb bb bb bb
         ^ 2     ^^ 3
          cc cc cc cc
         ^ 0     ^^ 1
            ddd
           ee
          f
        gg gg gg gg gg
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.selections.copy");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["copy-2a"](afterDocument);
    } catch (e) {
      notifyDependents["copy-2a"](undefined);

      throw e;
    }
  });

  test("transition copy-2a   > copy-2aa ", async function () {
    const beforeDocument = await documents["copy-2a"];

    if (beforeDocument === undefined) {
      notifyDependents["copy-2aa"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      aaa aaa aaa
        bb bb bb bb
         ^ 4     ^^ 5
          cc cc cc cc
         ^ 2     ^^ 3
            ddd
         ^ 0
           ee
          f
        gg gg gg gg gg
                 ^^ 1
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.selections.copy");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["copy-2aa"](afterDocument);
    } catch (e) {
      notifyDependents["copy-2aa"](undefined);

      throw e;
    }
  });

  test("transition copy-2aa  > copy-2aaa", async function () {
    const beforeDocument = await documents["copy-2aa"];

    if (beforeDocument === undefined) {
      notifyDependents["copy-2aaa"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      aaa aaa aaa
        bb bb bb bb
         ^ 5     ^^ 6
          cc cc cc cc
         ^ 3     ^^ 4
            ddd
         ^ 1
           ee
         ^ 0
          f
        gg gg gg gg gg
                 ^^ 2
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.selections.copy");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["copy-2aaa"](afterDocument);
    } catch (e) {
      notifyDependents["copy-2aaa"](undefined);

      throw e;
    }
  });

  test("transition initial-3 > copy-3a  ", async function () {
    const beforeDocument = await documents["initial-3"];

    if (beforeDocument === undefined) {
      notifyDependents["copy-3a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      ab
        ^ 1
      cd
        ^ 0
      efg
      hi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.selections.copy");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["copy-3a"](afterDocument);
    } catch (e) {
      notifyDependents["copy-3a"](undefined);

      throw e;
    }
  });

  test("transition copy-3a   > copy-3aa ", async function () {
    const beforeDocument = await documents["copy-3a"];

    if (beforeDocument === undefined) {
      notifyDependents["copy-3aa"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      ab
        ^ 2
      cd
        ^ 1
      efg
        ^ 0
      hi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.selections.copy");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["copy-3aa"](afterDocument);
    } catch (e) {
      notifyDependents["copy-3aa"](undefined);

      throw e;
    }
  });
});
