import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("search-next.md", function () {
  // Set up document.
  let document: vscode.TextDocument,
      editor: vscode.TextEditor;

  this.beforeAll(async () => {
    document = await vscode.workspace.openTextDocument();
    editor = await vscode.window.showTextDocument(document);
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
            apple pineapple pear
            ^ 0
            pear pineapple apple
            kiwi orange kiwi
          `)),

          "search-a": new Promise((resolve) => notifyDependents["search-a"] = resolve),
          "search-a-next": new Promise((resolve) => notifyDependents["search-a-next"] = resolve),
          "search-a-next-add": new Promise((resolve) => notifyDependents["search-a-next-add"] = resolve),
          "search-a-next-with-3": new Promise((resolve) => notifyDependents["search-a-next-with-3"] = resolve),
          "search-a-next-with-3-add": new Promise((resolve) => notifyDependents["search-a-next-with-3-add"] = resolve),
          "search-a-next-with-4": new Promise((resolve) => notifyDependents["search-a-next-with-4"] = resolve),
          "search-a-next-with-4-add": new Promise((resolve) => notifyDependents["search-a-next-with-4-add"] = resolve),
          "search-a-previous": new Promise((resolve) => notifyDependents["search-a-previous"] = resolve),
          "search-a-previous-add": new Promise((resolve) => notifyDependents["search-a-previous-add"] = resolve),
          "search-a-previous-with-2": new Promise((resolve) => notifyDependents["search-a-previous-with-2"] = resolve),
          "search-a-previous-with-2-add": new Promise((resolve) => notifyDependents["search-a-previous-with-2-add"] = resolve),
        };

  test("transition initial  > search-a                    ", async function () {
    const beforeDocument = await documents["initial"];

    if (beforeDocument === undefined) {
      notifyDependents["search-a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search",  { input: "apple" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-a"](afterDocument);
    } catch (e) {
      notifyDependents["search-a"](undefined);

      throw e;
    }
  });

  test("transition search-a > search-a-next               ", async function () {
    const beforeDocument = await documents["search-a"];

    if (beforeDocument === undefined) {
      notifyDependents["search-a-next"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      apple pineapple pear
      pear pineapple apple
               ^^^^^ 0
      kiwi orange kiwi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search.next");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-a-next"](afterDocument);
    } catch (e) {
      notifyDependents["search-a-next"](undefined);

      throw e;
    }
  });

  test("transition search-a > search-a-next-add           ", async function () {
    const beforeDocument = await documents["search-a"];

    if (beforeDocument === undefined) {
      notifyDependents["search-a-next-add"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      apple pineapple pear
                ^^^^^ 1
      pear pineapple apple
               ^^^^^ 0
      kiwi orange kiwi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search.next.add");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-a-next-add"](afterDocument);
    } catch (e) {
      notifyDependents["search-a-next-add"](undefined);

      throw e;
    }
  });

  test("transition search-a > search-a-next-with-3        ", async function () {
    const beforeDocument = await documents["search-a"];

    if (beforeDocument === undefined) {
      notifyDependents["search-a-next-with-3"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      apple pineapple pear
      ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search.next",  { count: 3 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-a-next-with-3"](afterDocument);
    } catch (e) {
      notifyDependents["search-a-next-with-3"](undefined);

      throw e;
    }
  });

  test("transition search-a > search-a-next-with-3-add    ", async function () {
    const beforeDocument = await documents["search-a"];

    if (beforeDocument === undefined) {
      notifyDependents["search-a-next-with-3-add"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      apple pineapple pear
      ^^^^^ 0   ^^^^^ 3
      pear pineapple apple
               ^^^^^ 2
                     ^^^^^ 1
      kiwi orange kiwi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search.next.add",  { count: 3 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-a-next-with-3-add"](afterDocument);
    } catch (e) {
      notifyDependents["search-a-next-with-3-add"](undefined);

      throw e;
    }
  });

  test("transition search-a > search-a-next-with-4        ", async function () {
    const beforeDocument = await documents["search-a"];

    if (beforeDocument === undefined) {
      notifyDependents["search-a-next-with-4"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search.next",  { count: 4 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-a-next-with-4"](afterDocument);
    } catch (e) {
      notifyDependents["search-a-next-with-4"](undefined);

      throw e;
    }
  });

  test("transition search-a > search-a-next-with-4-add    ", async function () {
    const beforeDocument = await documents["search-a"];

    if (beforeDocument === undefined) {
      notifyDependents["search-a-next-with-4-add"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      apple pineapple pear
      ^^^^^ 1   ^^^^^ 0
      pear pineapple apple
               ^^^^^ 3
                     ^^^^^ 2
      kiwi orange kiwi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search.next.add",  { count: 4 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-a-next-with-4-add"](afterDocument);
    } catch (e) {
      notifyDependents["search-a-next-with-4-add"](undefined);

      throw e;
    }
  });

  test("transition search-a > search-a-previous           ", async function () {
    const beforeDocument = await documents["search-a"];

    if (beforeDocument === undefined) {
      notifyDependents["search-a-previous"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      apple pineapple pear
      ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search.previous");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-a-previous"](afterDocument);
    } catch (e) {
      notifyDependents["search-a-previous"](undefined);

      throw e;
    }
  });

  test("transition search-a > search-a-previous-add       ", async function () {
    const beforeDocument = await documents["search-a"];

    if (beforeDocument === undefined) {
      notifyDependents["search-a-previous-add"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      apple pineapple pear
      ^^^^^ 0   ^^^^^ 1
      pear pineapple apple
      kiwi orange kiwi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search.previous.add");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-a-previous-add"](afterDocument);
    } catch (e) {
      notifyDependents["search-a-previous-add"](undefined);

      throw e;
    }
  });

  test("transition search-a > search-a-previous-with-2    ", async function () {
    const beforeDocument = await documents["search-a"];

    if (beforeDocument === undefined) {
      notifyDependents["search-a-previous-with-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      apple pineapple pear
      pear pineapple apple
                     ^^^^^ 0
      kiwi orange kiwi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search.previous",  { count: 2 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-a-previous-with-2"](afterDocument);
    } catch (e) {
      notifyDependents["search-a-previous-with-2"](undefined);

      throw e;
    }
  });

  test("transition search-a > search-a-previous-with-2-add", async function () {
    const beforeDocument = await documents["search-a"];

    if (beforeDocument === undefined) {
      notifyDependents["search-a-previous-with-2-add"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      apple pineapple pear
      ^^^^^ 1   ^^^^^ 2
      pear pineapple apple
                     ^^^^^ 0
      kiwi orange kiwi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search.previous.add",  { count: 2 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-a-previous-with-2-add"](afterDocument);
    } catch (e) {
      notifyDependents["search-a-previous-with-2-add"](undefined);

      throw e;
    }
  });
});
