import * as vscode from "vscode";

import { addDepthToCommandTests, ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("./test/suite/commands/selections-trim.md", function () {
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

            ^ 0
            there are two blank lines before me
                     ^ 0                       | 1
               some whitespaces around me    
                                            ^ 1
            and some more words
            ^^^^^^^^^^^^^ 2
            finally a selection    
                                ^^^ 3
                that contains only whitespace
            ^^^| 3
          `)),
          "2": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            hello
             ^ 0
            world
            my dear
             |^^^^^ 1
            friends
          `)),
          "3": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            hello
             |^^^^ 0
            world
            ^^ 0
            my
              ^ 1
            dear
            ^^^^^ 1
            friends
            ^^^ 1
          `)),

          "1-trim-whitespace": new Promise((resolve) => notifyDependents["1-trim-whitespace"] = resolve),
          "2-trim": new Promise((resolve) => notifyDependents["2-trim"] = resolve),
          "2-expand": new Promise((resolve) => notifyDependents["2-expand"] = resolve),
          "2-expand-x": new Promise((resolve) => notifyDependents["2-expand-x"] = resolve),
          "3-expand": new Promise((resolve) => notifyDependents["3-expand"] = resolve),
          "3-trim": new Promise((resolve) => notifyDependents["3-trim"] = resolve),
        };

  test("1 > trim-whitespace", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-trim-whitespace"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`

      there are two blank lines before me
      ^^^^^^^^^ 0
         some whitespaces around me    
         |^^^^^^^^^^^^^^^^^^^^^^^^^ 1
      and some more words
      ^^^^^^^^^^^^^ 2
      finally a selection    
          that contains only whitespace
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.selections.trimWhitespace");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/selections-trim.md:18:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-trim-whitespace"](afterDocument);
    } catch (e) {
      notifyDependents["1-trim-whitespace"](undefined);

      throw e;
    }
  });

  test("2 > trim", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-trim"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      hello
       ^ 0
      world
      my dear
       |^^^^^ 1
      friends
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.selections.trimLines");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/selections-trim.md:46:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-trim"](afterDocument);
    } catch (e) {
      notifyDependents["2-trim"](undefined);

      throw e;
    }
  });

  test("2 > expand", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-expand"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      hello
      ^^^^^^ 0
      world
      my dear
      |^^^^^^^ 1
      friends
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.selections.expandToLines");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/selections-trim.md:63:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-expand"](afterDocument);
    } catch (e) {
      notifyDependents["2-expand"](undefined);

      throw e;
    }
  });

  test("2 > expand > x", async function () {
    const beforeDocument = await documents["2-expand"];

    if (beforeDocument === undefined) {
      notifyDependents["2-expand-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      hello
      ^^^^^^ 0
      world
      my dear
      |^^^^^^^ 1
      friends
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.selections.expandToLines");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/selections-trim.md:77:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-expand-x"](afterDocument);
    } catch (e) {
      notifyDependents["2-expand-x"](undefined);

      throw e;
    }
  });

  test("3 > expand", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-expand"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      hello
      |^^^^^ 0
      world
      ^^^^^^ 0
      my
      ^^^ 1
      dear
      ^^^^^ 1
      friends
      ^^^^^^^^ 1
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.selections.expandToLines");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/selections-trim.md:108:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-expand"](afterDocument);
    } catch (e) {
      notifyDependents["3-expand"](undefined);

      throw e;
    }
  });

  test("3 > trim", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-trim"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      hello
      world
      my
      dear
      ^^^^^ 0
      friends
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.selections.trimLines");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/selections-trim.md:129:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-trim"](afterDocument);
    } catch (e) {
      notifyDependents["3-trim"](undefined);

      throw e;
    }
  });

  addDepthToCommandTests(this);
});
