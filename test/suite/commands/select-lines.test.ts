import * as vscode from "vscode";

import { addDepthToCommandTests, ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("./test/suite/commands/select-lines.md", function () {
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
          `)),
          "2": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            hello
               ^^^ 0
            world
            ^^^^^^ 0
              my
            ^^^ 0
                friends,
              and welcome
          `)),
          "3": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            hello
              ^^^^ 0
            world

            my
            friend
          `)),
          "4": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            hello
            |^^^^^ 0
            world
          `)),
          "5": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            hello
            |^^^^^ 0
            world
            ^ 0
          `)),
          "6": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            foo
             | 0
            bar
            baz
            quux
          `)),

          "1-whole-buffer": new Promise((resolve) => notifyDependents["1-whole-buffer"] = resolve),
          "1-select-line": new Promise((resolve) => notifyDependents["1-select-line"] = resolve),
          "1-select-line-x": new Promise((resolve) => notifyDependents["1-select-line-x"] = resolve),
          "1-extend-line": new Promise((resolve) => notifyDependents["1-extend-line"] = resolve),
          "1-extend-line-x": new Promise((resolve) => notifyDependents["1-extend-line-x"] = resolve),
          "2-line": new Promise((resolve) => notifyDependents["2-line"] = resolve),
          "2-line-extend": new Promise((resolve) => notifyDependents["2-line-extend"] = resolve),
          "2-line-2": new Promise((resolve) => notifyDependents["2-line-2"] = resolve),
          "2-line-extend-2": new Promise((resolve) => notifyDependents["2-line-extend-2"] = resolve),
          "3-line": new Promise((resolve) => notifyDependents["3-line"] = resolve),
          "3-line-2": new Promise((resolve) => notifyDependents["3-line-2"] = resolve),
          "3-line-2-line": new Promise((resolve) => notifyDependents["3-line-2-line"] = resolve),
          "3-line-2-line-x": new Promise((resolve) => notifyDependents["3-line-2-line-x"] = resolve),
          "4-line": new Promise((resolve) => notifyDependents["4-line"] = resolve),
          "5-line-extend": new Promise((resolve) => notifyDependents["5-line-extend"] = resolve),
          "5-line-extend-x": new Promise((resolve) => notifyDependents["5-line-extend-x"] = resolve),
          "6-line": new Promise((resolve) => notifyDependents["6-line"] = resolve),
          "6-line-x": new Promise((resolve) => notifyDependents["6-line-x"] = resolve),
          "6-line-x-x": new Promise((resolve) => notifyDependents["6-line-x-x"] = resolve),
          "6-line-line-extend": new Promise((resolve) => notifyDependents["6-line-line-extend"] = resolve),
          "6-line-extend": new Promise((resolve) => notifyDependents["6-line-extend"] = resolve),
        };

  test("1 > whole-buffer", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-whole-buffer"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:10:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-whole-buffer"](afterDocument);
    } catch (e) {
      notifyDependents["1-whole-buffer"](undefined);

      throw e;
    }
  });

  test("1 > select-line", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select-line"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:24:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-select-line"](afterDocument);
    } catch (e) {
      notifyDependents["1-select-line"](undefined);

      throw e;
    }
  });

  test("1 > select-line > x", async function () {
    const beforeDocument = await documents["1-select-line"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select-line-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:36:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-select-line-x"](afterDocument);
    } catch (e) {
      notifyDependents["1-select-line-x"](undefined);

      throw e;
    }
  });

  test("1 > extend-line", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-extend-line"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:48:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-extend-line"](afterDocument);
    } catch (e) {
      notifyDependents["1-extend-line"](undefined);

      throw e;
    }
  });

  test("1 > extend-line > x", async function () {
    const beforeDocument = await documents["1-extend-line"];

    if (beforeDocument === undefined) {
      notifyDependents["1-extend-line-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:60:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-extend-line-x"](afterDocument);
    } catch (e) {
      notifyDependents["1-extend-line-x"](undefined);

      throw e;
    }
  });

  test("2 > line", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-line"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:86:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-line"](afterDocument);
    } catch (e) {
      notifyDependents["2-line"](undefined);

      throw e;
    }
  });

  test("2 > line-extend", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-line-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:100:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-line-extend"](afterDocument);
    } catch (e) {
      notifyDependents["2-line-extend"](undefined);

      throw e;
    }
  });

  test("2 > line-2", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-line-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:116:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-line-2"](afterDocument);
    } catch (e) {
      notifyDependents["2-line-2"](undefined);

      throw e;
    }
  });

  test("2 > line-extend-2", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-line-extend-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:130:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-line-extend-2"](afterDocument);
    } catch (e) {
      notifyDependents["2-line-extend-2"](undefined);

      throw e;
    }
  });

  test("3 > line", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-line"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:158:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-line"](afterDocument);
    } catch (e) {
      notifyDependents["3-line"](undefined);

      throw e;
    }
  });

  test("3 > line-2", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-line-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:174:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-line-2"](afterDocument);
    } catch (e) {
      notifyDependents["3-line-2"](undefined);

      throw e;
    }
  });

  test("3 > line-2 > line", async function () {
    const beforeDocument = await documents["3-line-2"];

    if (beforeDocument === undefined) {
      notifyDependents["3-line-2-line"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:190:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-line-2-line"](afterDocument);
    } catch (e) {
      notifyDependents["3-line-2-line"](undefined);

      throw e;
    }
  });

  test("3 > line-2 > line > x", async function () {
    const beforeDocument = await documents["3-line-2-line"];

    if (beforeDocument === undefined) {
      notifyDependents["3-line-2-line-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:206:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-line-2-line-x"](afterDocument);
    } catch (e) {
      notifyDependents["3-line-2-line-x"](undefined);

      throw e;
    }
  });

  test("4 > line", async function () {
    const beforeDocument = await documents["4"];

    if (beforeDocument === undefined) {
      notifyDependents["4-line"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:230:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["4-line"](afterDocument);
    } catch (e) {
      notifyDependents["4-line"](undefined);

      throw e;
    }
  });

  test("5 > line-extend", async function () {
    const beforeDocument = await documents["5"];

    if (beforeDocument === undefined) {
      notifyDependents["5-line-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:252:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["5-line-extend"](afterDocument);
    } catch (e) {
      notifyDependents["5-line-extend"](undefined);

      throw e;
    }
  });

  test("5 > line-extend > x", async function () {
    const beforeDocument = await documents["5-line-extend"];

    if (beforeDocument === undefined) {
      notifyDependents["5-line-extend-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:265:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["5-line-extend-x"](afterDocument);
    } catch (e) {
      notifyDependents["5-line-extend-x"](undefined);

      throw e;
    }
  });

  test("6 > line", async function () {
    const beforeDocument = await documents["6"];

    if (beforeDocument === undefined) {
      notifyDependents["6-line"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:286:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["6-line"](afterDocument);
    } catch (e) {
      notifyDependents["6-line"](undefined);

      throw e;
    }
  });

  test("6 > line > x", async function () {
    const beforeDocument = await documents["6-line"];

    if (beforeDocument === undefined) {
      notifyDependents["6-line-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:299:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["6-line-x"](afterDocument);
    } catch (e) {
      notifyDependents["6-line-x"](undefined);

      throw e;
    }
  });

  test("6 > line > x > x", async function () {
    const beforeDocument = await documents["6-line-x"];

    if (beforeDocument === undefined) {
      notifyDependents["6-line-x-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:312:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["6-line-x-x"](afterDocument);
    } catch (e) {
      notifyDependents["6-line-x-x"](undefined);

      throw e;
    }
  });

  test("6 > line > line-extend", async function () {
    const beforeDocument = await documents["6-line"];

    if (beforeDocument === undefined) {
      notifyDependents["6-line-line-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:325:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["6-line-line-extend"](afterDocument);
    } catch (e) {
      notifyDependents["6-line-line-extend"](undefined);

      throw e;
    }
  });

  test("6 > line-extend", async function () {
    const beforeDocument = await documents["6"];

    if (beforeDocument === undefined) {
      notifyDependents["6-line-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:339:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["6-line-extend"](afterDocument);
    } catch (e) {
      notifyDependents["6-line-extend"](undefined);

      throw e;
    }
  });

  addDepthToCommandTests(this);
});
