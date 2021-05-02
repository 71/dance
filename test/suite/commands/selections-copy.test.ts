import * as vscode from "vscode";

import { addDepthToCommandTests, ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("./test/suite/commands/selections-copy.md", function () {
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
            foo
            ^ 0
            bar
            baz
            qux
          `)),
          "2": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            aaa aaa aaa
              bb bb bb bb
               ^ 0     ^^ 1
                cc cc cc cc
                  ddd
                 ee
                f
              gg gg gg gg gg
          `)),
          "3": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            ab
              ^ 0
            cd
            efg
            hi
          `)),

          "1-copy": new Promise((resolve) => notifyDependents["1-copy"] = resolve),
          "1-copy-x": new Promise((resolve) => notifyDependents["1-copy-x"] = resolve),
          "2-copy": new Promise((resolve) => notifyDependents["2-copy"] = resolve),
          "2-copy-x": new Promise((resolve) => notifyDependents["2-copy-x"] = resolve),
          "2-copy-x-x": new Promise((resolve) => notifyDependents["2-copy-x-x"] = resolve),
          "3-copy": new Promise((resolve) => notifyDependents["3-copy"] = resolve),
          "3-copy-x": new Promise((resolve) => notifyDependents["3-copy-x"] = resolve),
        };

  test("1 > copy", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-copy"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/selections-copy.md:11:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-copy"](afterDocument);
    } catch (e) {
      notifyDependents["1-copy"](undefined);

      throw e;
    }
  });

  test("1 > copy > x", async function () {
    const beforeDocument = await documents["1-copy"];

    if (beforeDocument === undefined) {
      notifyDependents["1-copy-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/selections-copy.md:25:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-copy-x"](afterDocument);
    } catch (e) {
      notifyDependents["1-copy-x"](undefined);

      throw e;
    }
  });

  test("2 > copy", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-copy"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/selections-copy.md:53:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-copy"](afterDocument);
    } catch (e) {
      notifyDependents["2-copy"](undefined);

      throw e;
    }
  });

  test("2 > copy > x", async function () {
    const beforeDocument = await documents["2-copy"];

    if (beforeDocument === undefined) {
      notifyDependents["2-copy-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/selections-copy.md:72:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-copy-x"](afterDocument);
    } catch (e) {
      notifyDependents["2-copy-x"](undefined);

      throw e;
    }
  });

  test("2 > copy > x > x", async function () {
    const beforeDocument = await documents["2-copy-x"];

    if (beforeDocument === undefined) {
      notifyDependents["2-copy-x-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/selections-copy.md:93:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-copy-x-x"](afterDocument);
    } catch (e) {
      notifyDependents["2-copy-x-x"](undefined);

      throw e;
    }
  });

  test("3 > copy", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-copy"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/selections-copy.md:125:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-copy"](afterDocument);
    } catch (e) {
      notifyDependents["3-copy"](undefined);

      throw e;
    }
  });

  test("3 > copy > x", async function () {
    const beforeDocument = await documents["3-copy"];

    if (beforeDocument === undefined) {
      notifyDependents["3-copy-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/selections-copy.md:139:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-copy-x"](afterDocument);
    } catch (e) {
      notifyDependents["3-copy-x"](undefined);

      throw e;
    }
  });

  addDepthToCommandTests(this);
});
