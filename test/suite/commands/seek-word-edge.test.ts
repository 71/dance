import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("seek-word-edge.md", function () {
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
          "1": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            |{0}th{0}e quick brown fox
          `)),
          "2": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            foo bar{0}
            |{0}baz
          `)),
          "3": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            |{0}the {0}qu|{1}ic{1}k brown fox
          `)),
          "4": Promise.resolve(ExpectedDocument.parseIndented(12, `\

            |{0}there{0} is a blank line before me
          `)),
          "5": Promise.resolve(ExpectedDocument.parseIndented(12, `\


            |{0}there{0} are two blank lines before me
          `)),

          "1-word-start-backward": new Promise((resolve) => notifyDependents["1-word-start-backward"] = resolve),
          "1-word-start-4": new Promise((resolve) => notifyDependents["1-word-start-4"] = resolve),
          "1-word-start-4-word-start": new Promise((resolve) => notifyDependents["1-word-start-4-word-start"] = resolve),
          "1-word-start-4-word-start-x": new Promise((resolve) => notifyDependents["1-word-start-4-word-start-x"] = resolve),
          "1-word-start-4-word-start-backward-4": new Promise((resolve) => notifyDependents["1-word-start-4-word-start-backward-4"] = resolve),
          "1-word-start-4-word-start-backward-5": new Promise((resolve) => notifyDependents["1-word-start-4-word-start-backward-5"] = resolve),
          "1-word-start-5": new Promise((resolve) => notifyDependents["1-word-start-5"] = resolve),
          "2-word-start-backward": new Promise((resolve) => notifyDependents["2-word-start-backward"] = resolve),
          "3-word-start-backward": new Promise((resolve) => notifyDependents["3-word-start-backward"] = resolve),
          "3-word-start-backward-9": new Promise((resolve) => notifyDependents["3-word-start-backward-9"] = resolve),
          "3-word-end-4": new Promise((resolve) => notifyDependents["3-word-end-4"] = resolve),
          "3-word-end-5": new Promise((resolve) => notifyDependents["3-word-end-5"] = resolve),
          "4-word-start-backward": new Promise((resolve) => notifyDependents["4-word-start-backward"] = resolve),
          "4-word-start-backward-x": new Promise((resolve) => notifyDependents["4-word-start-backward-x"] = resolve),
          "4-word-start-backward-4": new Promise((resolve) => notifyDependents["4-word-start-backward-4"] = resolve),
          "5-word-start-backward": new Promise((resolve) => notifyDependents["5-word-start-backward"] = resolve),
          "5-word-start-backward-x": new Promise((resolve) => notifyDependents["5-word-start-backward-x"] = resolve),
          "5-word-start-backward-9": new Promise((resolve) => notifyDependents["5-word-start-backward-9"] = resolve),
        };

  test("transition 1                         > 1-word-start-backward               ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-start-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      |{0}th{0}e quick brown fox
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word.backward");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-start-backward"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-start-backward"](undefined);

      throw e;
    }
  });

  test("transition 1                         > 1-word-start-4                      ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-start-4"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      the quick brown {0}fox|{0}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word", { count: 4 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-start-4"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-start-4"](undefined);

      throw e;
    }
  });

  test("transition 1-word-start-4            > 1-word-start-4-word-start           ", async function () {
    const beforeDocument = await documents["1-word-start-4"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-start-4-word-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      the quick brown {0}fox|{0}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-start-4-word-start"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-start-4-word-start"](undefined);

      throw e;
    }
  });

  test("transition 1-word-start-4-word-start > 1-word-start-4-word-start-x         ", async function () {
    const beforeDocument = await documents["1-word-start-4-word-start"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-start-4-word-start-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      the quick brown {0}fox|{0}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-start-4-word-start-x"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-start-4-word-start-x"](undefined);

      throw e;
    }
  });

  test("transition 1-word-start-4            > 1-word-start-4-word-start-backward-4", async function () {
    const beforeDocument = await documents["1-word-start-4"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-start-4-word-start-backward-4"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      |{0}the {0}quick brown fox
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word.backward", { count: 4 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-start-4-word-start-backward-4"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-start-4-word-start-backward-4"](undefined);

      throw e;
    }
  });

  test("transition 1-word-start-4            > 1-word-start-4-word-start-backward-5", async function () {
    const beforeDocument = await documents["1-word-start-4"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-start-4-word-start-backward-5"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      |{0}the {0}quick brown fox
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word.backward", { count: 5 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-start-4-word-start-backward-5"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-start-4-word-start-backward-5"](undefined);

      throw e;
    }
  });

  test("transition 1                         > 1-word-start-5                      ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-start-5"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      the quick brown {0}fox|{0}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word", { count: 5 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-start-5"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-start-5"](undefined);

      throw e;
    }
  });

  test("transition 2                         > 2-word-start-backward               ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-word-start-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo |{0}bar{0}
      baz
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word.backward");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["2-word-start-backward"](afterDocument);
    } catch (e) {
      notifyDependents["2-word-start-backward"](undefined);

      throw e;
    }
  });

  test("transition 3                         > 3-word-start-backward               ", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-word-start-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      the |{0}qui{0}ck brown fox
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word.backward");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["3-word-start-backward"](afterDocument);
    } catch (e) {
      notifyDependents["3-word-start-backward"](undefined);

      throw e;
    }
  });

  test("transition 3                         > 3-word-start-backward-9             ", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-word-start-backward-9"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      |{0}|{1}the {0}{1}quick brown fox
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word.backward", { count: 9 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["3-word-start-backward-9"](afterDocument);
    } catch (e) {
      notifyDependents["3-word-start-backward-9"](undefined);

      throw e;
    }
  });

  test("transition 3                         > 3-word-end-4                        ", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-word-end-4"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      the quick brown{0} fox|{0}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.wordEnd", { count: 4 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["3-word-end-4"](afterDocument);
    } catch (e) {
      notifyDependents["3-word-end-4"](undefined);

      throw e;
    }
  });

  test("transition 3                         > 3-word-end-5                        ", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-word-end-5"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      the quick brown{0}{1} fox|{0}|{1}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.wordEnd", { count: 5 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["3-word-end-5"](afterDocument);
    } catch (e) {
      notifyDependents["3-word-end-5"](undefined);

      throw e;
    }
  });

  test("transition 4                         > 4-word-start-backward               ", async function () {
    const beforeDocument = await documents["4"];

    if (beforeDocument === undefined) {
      notifyDependents["4-word-start-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      {0}
      t|{0}here is a blank line before me
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word.backward");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["4-word-start-backward"](afterDocument);
    } catch (e) {
      notifyDependents["4-word-start-backward"](undefined);

      throw e;
    }
  });

  test("transition 4-word-start-backward     > 4-word-start-backward-x             ", async function () {
    const beforeDocument = await documents["4-word-start-backward"];

    if (beforeDocument === undefined) {
      notifyDependents["4-word-start-backward-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      {0}
      t|{0}here is a blank line before me
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word.backward");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["4-word-start-backward-x"](afterDocument);
    } catch (e) {
      notifyDependents["4-word-start-backward-x"](undefined);

      throw e;
    }
  });

  test("transition 4                         > 4-word-start-backward-4             ", async function () {
    const beforeDocument = await documents["4"];

    if (beforeDocument === undefined) {
      notifyDependents["4-word-start-backward-4"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      {0}
      t|{0}here is a blank line before me
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word.backward", { count: 9 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["4-word-start-backward-4"](afterDocument);
    } catch (e) {
      notifyDependents["4-word-start-backward-4"](undefined);

      throw e;
    }
  });

  test("transition 5                         > 5-word-start-backward               ", async function () {
    const beforeDocument = await documents["5"];

    if (beforeDocument === undefined) {
      notifyDependents["5-word-start-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      {0}

      |{0}there are two blank lines before me
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word.backward");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["5-word-start-backward"](afterDocument);
    } catch (e) {
      notifyDependents["5-word-start-backward"](undefined);

      throw e;
    }
  });

  test("transition 5-word-start-backward     > 5-word-start-backward-x             ", async function () {
    const beforeDocument = await documents["5-word-start-backward"];

    if (beforeDocument === undefined) {
      notifyDependents["5-word-start-backward-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      {0}

      |{0}there are two blank lines before me
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word.backward");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["5-word-start-backward-x"](afterDocument);
    } catch (e) {
      notifyDependents["5-word-start-backward-x"](undefined);

      throw e;
    }
  });

  test("transition 5                         > 5-word-start-backward-9             ", async function () {
    const beforeDocument = await documents["5"];

    if (beforeDocument === undefined) {
      notifyDependents["5-word-start-backward-9"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      {0}

      |{0}there are two blank lines before me
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word.backward", { count: 9 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["5-word-start-backward-9"](afterDocument);
    } catch (e) {
      notifyDependents["5-word-start-backward-9"](undefined);

      throw e;
    }
  });
});
