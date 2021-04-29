import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("select-lines.md", function () {
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
          "initial": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            foo
            ^ 0
            bar
            baz
          `)),
          "initial-3": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            hello
               ^^^ 0
            world
            ^^^^^^ 0
              my
            ^^^ 0
                friends,
              and welcome
          `)),
          "initial-4": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            hello
              ^^^^ 0
            world

            my
            friend
          `)),
          "initial-5": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            hello
            |^^^^^ 0
            world
          `)),
          "initial-6": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            hello
            |^^^^^ 0
            world
            ^ 0
          `)),
          "initial-7": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            foo
             | 0
            bar
            baz
            quux
          `)),

          "whole-buffer": new Promise((resolve) => notifyDependents["whole-buffer"] = resolve),
          "line-1": new Promise((resolve) => notifyDependents["line-1"] = resolve),
          "line-extend-1": new Promise((resolve) => notifyDependents["line-extend-1"] = resolve),
          "line-2": new Promise((resolve) => notifyDependents["line-2"] = resolve),
          "line-extend-2": new Promise((resolve) => notifyDependents["line-extend-2"] = resolve),
          "line-3": new Promise((resolve) => notifyDependents["line-3"] = resolve),
          "line-extend-3": new Promise((resolve) => notifyDependents["line-extend-3"] = resolve),
          "line-with-count-3": new Promise((resolve) => notifyDependents["line-with-count-3"] = resolve),
          "line-extend-with-count-3": new Promise((resolve) => notifyDependents["line-extend-with-count-3"] = resolve),
          "line-4": new Promise((resolve) => notifyDependents["line-4"] = resolve),
          "line-with-count-4a": new Promise((resolve) => notifyDependents["line-with-count-4a"] = resolve),
          "line-with-count-4b": new Promise((resolve) => notifyDependents["line-with-count-4b"] = resolve),
          "line-with-count-4c": new Promise((resolve) => notifyDependents["line-with-count-4c"] = resolve),
          "line-5": new Promise((resolve) => notifyDependents["line-5"] = resolve),
          "line-extend-6a": new Promise((resolve) => notifyDependents["line-extend-6a"] = resolve),
          "line-extend-6b": new Promise((resolve) => notifyDependents["line-extend-6b"] = resolve),
          "line-7a": new Promise((resolve) => notifyDependents["line-7a"] = resolve),
          "line-extend-7": new Promise((resolve) => notifyDependents["line-extend-7"] = resolve),
          "line-7b": new Promise((resolve) => notifyDependents["line-7b"] = resolve),
          "line-7b-extend": new Promise((resolve) => notifyDependents["line-7b-extend"] = resolve),
          "line-7c": new Promise((resolve) => notifyDependents["line-7c"] = resolve),
        };

  test("transition initial            > whole-buffer            ", async function () {
    const beforeDocument = await documents["initial"];

    if (beforeDocument === undefined) {
      notifyDependents["whole-buffer"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      ^^^^ 0
      bar
      ^^^^ 0
      baz
      ^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.buffer");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["whole-buffer"](afterDocument);
    } catch (e) {
      notifyDependents["whole-buffer"](undefined);

      throw e;
    }
  });

  test("transition initial            > line-1                  ", async function () {
    const beforeDocument = await documents["initial"];

    if (beforeDocument === undefined) {
      notifyDependents["line-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      ^^^^ 0
      bar
      baz
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-1"](afterDocument);
    } catch (e) {
      notifyDependents["line-1"](undefined);

      throw e;
    }
  });

  test("transition initial            > line-extend-1           ", async function () {
    const beforeDocument = await documents["initial"];

    if (beforeDocument === undefined) {
      notifyDependents["line-extend-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      ^^^^ 0
      bar
      baz
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below.extend");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-extend-1"](afterDocument);
    } catch (e) {
      notifyDependents["line-extend-1"](undefined);

      throw e;
    }
  });

  test("transition line-1             > line-2                  ", async function () {
    const beforeDocument = await documents["line-1"];

    if (beforeDocument === undefined) {
      notifyDependents["line-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      bar
      ^^^^ 0
      baz
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-2"](afterDocument);
    } catch (e) {
      notifyDependents["line-2"](undefined);

      throw e;
    }
  });

  test("transition line-extend-1      > line-extend-2           ", async function () {
    const beforeDocument = await documents["line-extend-1"];

    if (beforeDocument === undefined) {
      notifyDependents["line-extend-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      ^^^^ 0
      bar
      ^^^^ 0
      baz
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below.extend");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-extend-2"](afterDocument);
    } catch (e) {
      notifyDependents["line-extend-2"](undefined);

      throw e;
    }
  });

  test("transition initial-3          > line-3                  ", async function () {
    const beforeDocument = await documents["initial-3"];

    if (beforeDocument === undefined) {
      notifyDependents["line-3"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      hello
      world
        my
      ^^^^^ 0
          friends,
        and welcome
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-3"](afterDocument);
    } catch (e) {
      notifyDependents["line-3"](undefined);

      throw e;
    }
  });

  test("transition initial-3          > line-extend-3           ", async function () {
    const beforeDocument = await documents["initial-3"];

    if (beforeDocument === undefined) {
      notifyDependents["line-extend-3"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      hello
         ^^^ 0
      world
      ^^^^^^ 0
        my
      ^^^^^ 0
          friends,
        and welcome
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below.extend");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-extend-3"](afterDocument);
    } catch (e) {
      notifyDependents["line-extend-3"](undefined);

      throw e;
    }
  });

  test("transition initial-3          > line-with-count-3       ", async function () {
    const beforeDocument = await documents["initial-3"];

    if (beforeDocument === undefined) {
      notifyDependents["line-with-count-3"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      hello
      world
        my
          friends,
      ^^^^^^^^^^^^^ 0
        and welcome
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below", { count: 2 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-with-count-3"](afterDocument);
    } catch (e) {
      notifyDependents["line-with-count-3"](undefined);

      throw e;
    }
  });

  test("transition initial-3          > line-extend-with-count-3", async function () {
    const beforeDocument = await documents["initial-3"];

    if (beforeDocument === undefined) {
      notifyDependents["line-extend-with-count-3"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      hello
         ^^^ 0
      world
      ^^^^^^ 0
        my
      ^^^^^ 0
          friends,
      ^^^^^^^^^^^^^ 0
        and welcome
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below.extend", { count: 2 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-extend-with-count-3"](afterDocument);
    } catch (e) {
      notifyDependents["line-extend-with-count-3"](undefined);

      throw e;
    }
  });

  test("transition initial-4          > line-4                  ", async function () {
    const beforeDocument = await documents["initial-4"];

    if (beforeDocument === undefined) {
      notifyDependents["line-4"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      hello
      ^^^^^^ 0
      world

      my
      friend
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-4"](afterDocument);
    } catch (e) {
      notifyDependents["line-4"](undefined);

      throw e;
    }
  });

  test("transition initial-4          > line-with-count-4a      ", async function () {
    const beforeDocument = await documents["initial-4"];

    if (beforeDocument === undefined) {
      notifyDependents["line-with-count-4a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      hello
      world
      ^^^^^^ 0

      my
      friend
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below", { count: 2 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-with-count-4a"](afterDocument);
    } catch (e) {
      notifyDependents["line-with-count-4a"](undefined);

      throw e;
    }
  });

  test("transition line-with-count-4a > line-with-count-4b      ", async function () {
    const beforeDocument = await documents["line-with-count-4a"];

    if (beforeDocument === undefined) {
      notifyDependents["line-with-count-4b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      hello
      world

      ^ 0
      my
      friend
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-with-count-4b"](afterDocument);
    } catch (e) {
      notifyDependents["line-with-count-4b"](undefined);

      throw e;
    }
  });

  test("transition line-with-count-4b > line-with-count-4c      ", async function () {
    const beforeDocument = await documents["line-with-count-4b"];

    if (beforeDocument === undefined) {
      notifyDependents["line-with-count-4c"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      hello
      world

      my
      ^^^ 0
      friend
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-with-count-4c"](afterDocument);
    } catch (e) {
      notifyDependents["line-with-count-4c"](undefined);

      throw e;
    }
  });

  test("transition initial-5          > line-5                  ", async function () {
    const beforeDocument = await documents["initial-5"];

    if (beforeDocument === undefined) {
      notifyDependents["line-5"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      hello
      ^^^^^^ 0
      world
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-5"](afterDocument);
    } catch (e) {
      notifyDependents["line-5"](undefined);

      throw e;
    }
  });

  test("transition initial-6          > line-extend-6a          ", async function () {
    const beforeDocument = await documents["initial-6"];

    if (beforeDocument === undefined) {
      notifyDependents["line-extend-6a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      hello
      world
      ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below.extend");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-extend-6a"](afterDocument);
    } catch (e) {
      notifyDependents["line-extend-6a"](undefined);

      throw e;
    }
  });

  test("transition line-extend-6a     > line-extend-6b          ", async function () {
    const beforeDocument = await documents["line-extend-6a"];

    if (beforeDocument === undefined) {
      notifyDependents["line-extend-6b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      hello
      world
      ^^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below.extend");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-extend-6b"](afterDocument);
    } catch (e) {
      notifyDependents["line-extend-6b"](undefined);

      throw e;
    }
  });

  test("transition initial-7          > line-7a                 ", async function () {
    const beforeDocument = await documents["initial-7"];

    if (beforeDocument === undefined) {
      notifyDependents["line-7a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      ^^^^ 0
      bar
      baz
      quux
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-7a"](afterDocument);
    } catch (e) {
      notifyDependents["line-7a"](undefined);

      throw e;
    }
  });

  test("transition initial-7          > line-extend-7           ", async function () {
    const beforeDocument = await documents["initial-7"];

    if (beforeDocument === undefined) {
      notifyDependents["line-extend-7"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      ^^^^ 0
      bar
      baz
      quux
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below.extend");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-extend-7"](afterDocument);
    } catch (e) {
      notifyDependents["line-extend-7"](undefined);

      throw e;
    }
  });

  test("transition line-7a            > line-7b                 ", async function () {
    const beforeDocument = await documents["line-7a"];

    if (beforeDocument === undefined) {
      notifyDependents["line-7b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      bar
      ^^^^ 0
      baz
      quux
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-7b"](afterDocument);
    } catch (e) {
      notifyDependents["line-7b"](undefined);

      throw e;
    }
  });

  test("transition line-7a            > line-7b-extend          ", async function () {
    const beforeDocument = await documents["line-7a"];

    if (beforeDocument === undefined) {
      notifyDependents["line-7b-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      ^^^^ 0
      bar
      ^^^^ 0
      baz
      quux
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below.extend");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-7b-extend"](afterDocument);
    } catch (e) {
      notifyDependents["line-7b-extend"](undefined);

      throw e;
    }
  });

  test("transition line-7b            > line-7c                 ", async function () {
    const beforeDocument = await documents["line-7b"];

    if (beforeDocument === undefined) {
      notifyDependents["line-7c"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      bar
      baz
      ^^^^ 0
      quux
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.select.line.below");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["line-7c"](afterDocument);
    } catch (e) {
      notifyDependents["line-7c"](undefined);

      throw e;
    }
  });
});
