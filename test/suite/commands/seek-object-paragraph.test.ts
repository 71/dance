import * as vscode from "vscode";

import { addDepthToCommandTests, ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("./test/suite/commands/seek-object-paragraph.md", function () {
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
               ^ 1
            bar
               ^ 2

            ^ 3
            baz
            ^ 4

            ^ 5

            qux
          `)),
          "2": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            paragraph 1
            ^^^^^^^^^^^^ 0

            ^ 1

            ^ 2

            ^ 3

            ^ 4
            paragraph 2
          `)),

          "1-to-start": new Promise((resolve) => notifyDependents["1-to-start"] = resolve),
          "1-to-end": new Promise((resolve) => notifyDependents["1-to-end"] = resolve),
          "1-to-end-inner": new Promise((resolve) => notifyDependents["1-to-end-inner"] = resolve),
          "1-select": new Promise((resolve) => notifyDependents["1-select"] = resolve),
          "2-select": new Promise((resolve) => notifyDependents["2-select"] = resolve),
          "2-to-end-inner": new Promise((resolve) => notifyDependents["2-to-end-inner"] = resolve),
        };

  test("1 > to-start", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      foo
      ^^^^ 0
      bar
      ^^^^ 0

      ^ 0
      baz
      |^^^ 1

      ^ 1

      qux
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=paragraph)", where: "start" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-paragraph.md:21:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-start"](undefined);

      throw e;
    }
  });

  test("1 > to-end", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      foo
      ^^^^ 0
      bar
      ^^^^ 0

      baz
      ^^^^ 1

      ^ 1

      ^ 1
      qux
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=paragraph)", where: "end" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-paragraph.md:45:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-end"](undefined);

      throw e;
    }
  });

  test("1 > to-end-inner", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-end-inner"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      foo
      ^^^^ 0
      bar
      ^^^^ 0

      baz
      ^^^^ 1

      ^ 2

      qux
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=paragraph)", where: "end", inner: true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-paragraph.md:68:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-end-inner"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-end-inner"](undefined);

      throw e;
    }
  });

  test("1 > select", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      foo
      ^^^^ 0
      bar
      ^^^^ 0

      baz
      ^^^^ 1

      ^ 1

      ^ 1
      qux
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=paragraph)" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-paragraph.md:90:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-select"](afterDocument);
    } catch (e) {
      notifyDependents["1-select"](undefined);

      throw e;
    }
  });

  test("2 > select", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      paragraph 1
      ^^^^^^^^^^^^ 0




      paragraph 2
      ^^^^^^^^^^^ 1
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=paragraph)", inner: true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-paragraph.md:132:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-select"](afterDocument);
    } catch (e) {
      notifyDependents["2-select"](undefined);

      throw e;
    }
  });

  test("2 > to-end-inner", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-to-end-inner"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      paragraph 1
                 ^ 0


      ^ 1

      ^ 2

      ^ 3
      paragraph 2
      ^^^^^^^^^^^ 3
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=paragraph)", where: "end", inner: true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-paragraph.md:152:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-to-end-inner"](afterDocument);
    } catch (e) {
      notifyDependents["2-to-end-inner"](undefined);

      throw e;
    }
  });

  addDepthToCommandTests(this);
});
