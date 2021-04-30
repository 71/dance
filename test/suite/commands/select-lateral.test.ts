import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("select-lateral.md", function () {
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
            foo
            bar
               ^ 0
            baz
            quxxx
          `)),
          "2": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            foo

            bar
               ^ 0

          `)),
          "3": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            foo

            ^ 0
            bar
            baz
          `)),

          "1-left": new Promise((resolve) => notifyDependents["1-left"] = resolve),
          "1-right": new Promise((resolve) => notifyDependents["1-right"] = resolve),
          "1-up": new Promise((resolve) => notifyDependents["1-up"] = resolve),
          "1-up-skip-eol": new Promise((resolve) => notifyDependents["1-up-skip-eol"] = resolve),
          "1-down": new Promise((resolve) => notifyDependents["1-down"] = resolve),
          "1-down-skip-eol": new Promise((resolve) => notifyDependents["1-down-skip-eol"] = resolve),
          "1-down-skip-eol-2": new Promise((resolve) => notifyDependents["1-down-skip-eol-2"] = resolve),
          "2-up": new Promise((resolve) => notifyDependents["2-up"] = resolve),
          "2-up-skip-eol-2": new Promise((resolve) => notifyDependents["2-up-skip-eol-2"] = resolve),
          "3-left": new Promise((resolve) => notifyDependents["3-left"] = resolve),
          "3-right": new Promise((resolve) => notifyDependents["3-right"] = resolve),
          "3-up": new Promise((resolve) => notifyDependents["3-up"] = resolve),
          "3-down": new Promise((resolve) => notifyDependents["3-down"] = resolve),
          "3-down-up": new Promise((resolve) => notifyDependents["3-down-up"] = resolve),
          "3-down-up-extend": new Promise((resolve) => notifyDependents["3-down-up-extend"] = resolve),
          "3-down-up-extend-x": new Promise((resolve) => notifyDependents["3-down-up-extend-x"] = resolve),
        };

  test("transition 1                > 1-left            ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-left"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      bar
        ^ 0
      baz
      quxxx
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.left.jump");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-left"](afterDocument);
    } catch (e) {
      notifyDependents["1-left"](undefined);

      throw e;
    }
  });

  test("transition 1                > 1-right           ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-right"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      bar
      baz
      ^ 0
      quxxx
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.right.jump");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-right"](afterDocument);
    } catch (e) {
      notifyDependents["1-right"](undefined);

      throw e;
    }
  });

  test("transition 1                > 1-up              ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-up"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
         ^ 0
      bar
      baz
      quxxx
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.up.jump");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-up"](afterDocument);
    } catch (e) {
      notifyDependents["1-up"](undefined);

      throw e;
    }
  });

  test("transition 1                > 1-up-skip-eol     ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-up-skip-eol"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
        ^ 0
      bar
      baz
      quxxx
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.up.jump", { avoidEol: true });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-up-skip-eol"](afterDocument);
    } catch (e) {
      notifyDependents["1-up-skip-eol"](undefined);

      throw e;
    }
  });

  test("transition 1                > 1-down            ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-down"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      bar
      baz
         ^ 0
      quxxx
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.down.jump");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-down"](afterDocument);
    } catch (e) {
      notifyDependents["1-down"](undefined);

      throw e;
    }
  });

  test("transition 1                > 1-down-skip-eol   ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-down-skip-eol"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      bar
      baz
        ^ 0
      quxxx
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.down.jump", { avoidEol: true });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-down-skip-eol"](afterDocument);
    } catch (e) {
      notifyDependents["1-down-skip-eol"](undefined);

      throw e;
    }
  });

  test("transition 1                > 1-down-skip-eol-2 ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-down-skip-eol-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      bar
      baz
      quxxx
         ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.down.jump", { count: 2, avoidEol: true });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-down-skip-eol-2"](afterDocument);
    } catch (e) {
      notifyDependents["1-down-skip-eol-2"](undefined);

      throw e;
    }
  });

  test("transition 2                > 2-up              ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-up"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo

      ^ 0
      bar

    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.up.jump");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["2-up"](afterDocument);
    } catch (e) {
      notifyDependents["2-up"](undefined);

      throw e;
    }
  });

  test("transition 2                > 2-up-skip-eol-2   ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-up-skip-eol-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
        ^ 0

      bar

    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.up.jump", { count: 2, avoidEol: true });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["2-up-skip-eol-2"](afterDocument);
    } catch (e) {
      notifyDependents["2-up-skip-eol-2"](undefined);

      throw e;
    }
  });

  test("transition 3                > 3-left            ", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-left"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
         ^ 0

      bar
      baz
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.left.jump");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["3-left"](afterDocument);
    } catch (e) {
      notifyDependents["3-left"](undefined);

      throw e;
    }
  });

  test("transition 3                > 3-right           ", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-right"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo

      bar
      ^ 0
      baz
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.right.jump");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["3-right"](afterDocument);
    } catch (e) {
      notifyDependents["3-right"](undefined);

      throw e;
    }
  });

  test("transition 3                > 3-up              ", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-up"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      ^ 0

      bar
      baz
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.up.jump");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["3-up"](afterDocument);
    } catch (e) {
      notifyDependents["3-up"](undefined);

      throw e;
    }
  });

  test("transition 3                > 3-down            ", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-down"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo

      bar
      ^ 0
      baz
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.down.jump");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["3-down"](afterDocument);
    } catch (e) {
      notifyDependents["3-down"](undefined);

      throw e;
    }
  });

  test("transition 3-down           > 3-down-up         ", async function () {
    const beforeDocument = await documents["3-down"];

    if (beforeDocument === undefined) {
      notifyDependents["3-down-up"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo

      ^ 0
      bar
      baz
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.up.jump");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["3-down-up"](afterDocument);
    } catch (e) {
      notifyDependents["3-down-up"](undefined);

      throw e;
    }
  });

  test("transition 3-down           > 3-down-up-extend  ", async function () {
    const beforeDocument = await documents["3-down"];

    if (beforeDocument === undefined) {
      notifyDependents["3-down-up-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo

      | 0
      bar
      ^ 0
      baz
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.up.extend");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["3-down-up-extend"](afterDocument);
    } catch (e) {
      notifyDependents["3-down-up-extend"](undefined);

      throw e;
    }
  });

  test("transition 3-down-up-extend > 3-down-up-extend-x", async function () {
    const beforeDocument = await documents["3-down-up-extend"];

    if (beforeDocument === undefined) {
      notifyDependents["3-down-up-extend-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      | 0

      ^ 0
      bar
      ^ 0
      baz
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.select.up.extend");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["3-down-up-extend-x"](afterDocument);
    } catch (e) {
      notifyDependents["3-down-up-extend-x"](undefined);

      throw e;
    }
  });
});
