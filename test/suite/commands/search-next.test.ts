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
            apple pineapple pear
            ^ 0
            pear pineapple apple
            kiwi orange kiwi
          `)),

          "1-search-apple": new Promise((resolve) => notifyDependents["1-search-apple"] = resolve),
          "1-search-apple-next": new Promise((resolve) => notifyDependents["1-search-apple-next"] = resolve),
          "1-search-apple-next-add": new Promise((resolve) => notifyDependents["1-search-apple-next-add"] = resolve),
          "1-search-apple-next-3": new Promise((resolve) => notifyDependents["1-search-apple-next-3"] = resolve),
          "1-search-apple-next-add-3": new Promise((resolve) => notifyDependents["1-search-apple-next-add-3"] = resolve),
          "1-search-apple-next-4": new Promise((resolve) => notifyDependents["1-search-apple-next-4"] = resolve),
          "1-search-apple-next-add-4": new Promise((resolve) => notifyDependents["1-search-apple-next-add-4"] = resolve),
          "1-search-apple-previous": new Promise((resolve) => notifyDependents["1-search-apple-previous"] = resolve),
          "1-search-apple-previous-add": new Promise((resolve) => notifyDependents["1-search-apple-previous-add"] = resolve),
          "1-search-apple-previous-2": new Promise((resolve) => notifyDependents["1-search-apple-previous-2"] = resolve),
          "1-search-apple-previous-add-2": new Promise((resolve) => notifyDependents["1-search-apple-previous-add-2"] = resolve),
        };

  test("transition 1              > 1-search-apple               ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-apple"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "apple" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-apple"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-apple"](undefined);

      throw e;
    }
  });

  test("transition 1-search-apple > 1-search-apple-next          ", async function () {
    const beforeDocument = await documents["1-search-apple"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-apple-next"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["1-search-apple-next"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-apple-next"](undefined);

      throw e;
    }
  });

  test("transition 1-search-apple > 1-search-apple-next-add      ", async function () {
    const beforeDocument = await documents["1-search-apple"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-apple-next-add"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["1-search-apple-next-add"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-apple-next-add"](undefined);

      throw e;
    }
  });

  test("transition 1-search-apple > 1-search-apple-next-3        ", async function () {
    const beforeDocument = await documents["1-search-apple"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-apple-next-3"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      apple pineapple pear
      ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search.next", { count: 3 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-apple-next-3"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-apple-next-3"](undefined);

      throw e;
    }
  });

  test("transition 1-search-apple > 1-search-apple-next-add-3    ", async function () {
    const beforeDocument = await documents["1-search-apple"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-apple-next-add-3"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      await executeCommand("dance.search.next.add", { count: 3 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-apple-next-add-3"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-apple-next-add-3"](undefined);

      throw e;
    }
  });

  test("transition 1-search-apple > 1-search-apple-next-4        ", async function () {
    const beforeDocument = await documents["1-search-apple"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-apple-next-4"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search.next", { count: 4 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-apple-next-4"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-apple-next-4"](undefined);

      throw e;
    }
  });

  test("transition 1-search-apple > 1-search-apple-next-add-4    ", async function () {
    const beforeDocument = await documents["1-search-apple"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-apple-next-add-4"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      await executeCommand("dance.search.next.add", { count: 4 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-apple-next-add-4"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-apple-next-add-4"](undefined);

      throw e;
    }
  });

  test("transition 1-search-apple > 1-search-apple-previous      ", async function () {
    const beforeDocument = await documents["1-search-apple"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-apple-previous"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["1-search-apple-previous"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-apple-previous"](undefined);

      throw e;
    }
  });

  test("transition 1-search-apple > 1-search-apple-previous-add  ", async function () {
    const beforeDocument = await documents["1-search-apple"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-apple-previous-add"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["1-search-apple-previous-add"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-apple-previous-add"](undefined);

      throw e;
    }
  });

  test("transition 1-search-apple > 1-search-apple-previous-2    ", async function () {
    const beforeDocument = await documents["1-search-apple"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-apple-previous-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      apple pineapple pear
      pear pineapple apple
                     ^^^^^ 0
      kiwi orange kiwi
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search.previous", { count: 2 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-apple-previous-2"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-apple-previous-2"](undefined);

      throw e;
    }
  });

  test("transition 1-search-apple > 1-search-apple-previous-add-2", async function () {
    const beforeDocument = await documents["1-search-apple"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-apple-previous-add-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      await executeCommand("dance.search.previous.add", { count: 2 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-apple-previous-add-2"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-apple-previous-add-2"](undefined);

      throw e;
    }
  });
});
