import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("selections-trim.md", function () {
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
          "initial-2": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            hello
             ^ 0
            world
            my dear
             |^^^^^ 1
            friends
          `)),
          "initial-3": Promise.resolve(ExpectedDocument.parseIndented(12, `\
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

          "trim-whitespace-1": new Promise((resolve) => notifyDependents["trim-whitespace-1"] = resolve),
          "trim-2": new Promise((resolve) => notifyDependents["trim-2"] = resolve),
          "expand-2a": new Promise((resolve) => notifyDependents["expand-2a"] = resolve),
          "expand-2b": new Promise((resolve) => notifyDependents["expand-2b"] = resolve),
          "expand-3": new Promise((resolve) => notifyDependents["expand-3"] = resolve),
          "trim-3": new Promise((resolve) => notifyDependents["trim-3"] = resolve),
        };

  test("transition initial-1 > trim-whitespace-1", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["trim-whitespace-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\

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
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["trim-whitespace-1"](afterDocument);
    } catch (e) {
      notifyDependents["trim-whitespace-1"](undefined);

      throw e;
    }
  });

  test("transition initial-2 > trim-2           ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["trim-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
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
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["trim-2"](afterDocument);
    } catch (e) {
      notifyDependents["trim-2"](undefined);

      throw e;
    }
  });

  test("transition initial-2 > expand-2a        ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["expand-2a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
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
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["expand-2a"](afterDocument);
    } catch (e) {
      notifyDependents["expand-2a"](undefined);

      throw e;
    }
  });

  test("transition expand-2a > expand-2b        ", async function () {
    const beforeDocument = await documents["expand-2a"];

    if (beforeDocument === undefined) {
      notifyDependents["expand-2b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
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
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["expand-2b"](afterDocument);
    } catch (e) {
      notifyDependents["expand-2b"](undefined);

      throw e;
    }
  });

  test("transition initial-3 > expand-3         ", async function () {
    const beforeDocument = await documents["initial-3"];

    if (beforeDocument === undefined) {
      notifyDependents["expand-3"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
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
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["expand-3"](afterDocument);
    } catch (e) {
      notifyDependents["expand-3"](undefined);

      throw e;
    }
  });

  test("transition initial-3 > trim-3           ", async function () {
    const beforeDocument = await documents["initial-3"];

    if (beforeDocument === undefined) {
      notifyDependents["trim-3"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
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
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["trim-3"](afterDocument);
    } catch (e) {
      notifyDependents["trim-3"](undefined);

      throw e;
    }
  });
});
