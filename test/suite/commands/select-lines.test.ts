import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/select-lines.md", function () {
  // Set up document.
  let document: vscode.TextDocument,
      editor: vscode.TextEditor;

  this.beforeAll(async () => {
    document = await vscode.workspace.openTextDocument({ language: "plaintext" });
    editor = await vscode.window.showTextDocument(document);
    editor.options.insertSpaces = true;
    editor.options.tabSize = 2;

    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });
  });

  this.afterAll(async () => {
    await executeCommand("workbench.action.closeActiveEditor");
  });

  test("1 > whole-buffer", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      ^ 0
      bar
      baz
    `);

    // Perform all operations.
    await executeCommand("dance.select.buffer");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:10:1", 6, String.raw`
      foo
      ^^^^ 0
      bar
      ^^^^ 0
      baz
      ^^^ 0
    `);
  });

  test("1 > select-line", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      ^ 0
      bar
      baz
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:24:1", 6, String.raw`
      foo
      ^^^^ 0
      bar
      baz
    `);
  });

  test("1 > select-line > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      ^^^^ 0
      bar
      baz
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:36:1", 6, String.raw`
      foo
      bar
      ^^^^ 0
      baz
    `);
  });

  test("1 > extend-line", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      ^ 0
      bar
      baz
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below.extend");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:48:1", 6, String.raw`
      foo
      ^^^^ 0
      bar
      baz
    `);
  });

  test("1 > extend-line > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      ^^^^ 0
      bar
      baz
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below.extend");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:60:1", 6, String.raw`
      foo
      ^^^^ 0
      bar
      ^^^^ 0
      baz
    `);
  });

  test("2 > line", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
         ^^^ 0
      world
      ^^^^^^ 0
        my
      ^^^ 0
          friends,
        and welcome
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:86:1", 6, String.raw`
      hello
      world
        my
      ^^^^^ 0
          friends,
        and welcome
    `);
  });

  test("2 > line-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
         ^^^ 0
      world
      ^^^^^^ 0
        my
      ^^^ 0
          friends,
        and welcome
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below.extend");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:100:1", 6, String.raw`
      hello
         ^^^ 0
      world
      ^^^^^^ 0
        my
      ^^^^^ 0
          friends,
        and welcome
    `);
  });

  test("2 > line-2", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
         ^^^ 0
      world
      ^^^^^^ 0
        my
      ^^^ 0
          friends,
        and welcome
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below", { count: 2 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:116:1", 6, String.raw`
      hello
      world
        my
          friends,
      ^^^^^^^^^^^^^ 0
        and welcome
    `);
  });

  test("2 > line-extend-2", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
         ^^^ 0
      world
      ^^^^^^ 0
        my
      ^^^ 0
          friends,
        and welcome
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below.extend", { count: 2 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:130:1", 6, String.raw`
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
  });

  test("3 > line", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
        ^^^^ 0
      world

      my
      friend
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:158:1", 6, String.raw`
      hello
      ^^^^^^ 0
      world

      my
      friend
    `);
  });

  test("3 > line-2", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
        ^^^^ 0
      world

      my
      friend
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below", { count: 2 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:174:1", 6, String.raw`
      hello
      world
      ^^^^^^ 0

      my
      friend
    `);
  });

  test("3 > line-2 > line", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
      world
      ^^^^^^ 0

      my
      friend
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:190:1", 6, String.raw`
      hello
      world

      ^ 0
      my
      friend
    `);
  });

  test("3 > line-2 > line > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
      world

      ^ 0
      my
      friend
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:206:1", 6, String.raw`
      hello
      world

      my
      ^^^ 0
      friend
    `);
  });

  test("4 > line", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
      |^^^^^ 0
      world
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:230:1", 6, String.raw`
      hello
      ^^^^^^ 0
      world
    `);
  });

  test("5 > line-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
      |^^^^^ 0
      world
      ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below.extend");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:252:1", 6, String.raw`
      hello
      world
      ^ 0
    `);
  });

  test("5 > line-extend > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
      world
      ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below.extend");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:265:1", 6, String.raw`
      hello
      world
      ^^^^^ 0
    `);
  });

  test("6 > line", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
       | 0
      bar
      baz
      quux
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:286:1", 6, String.raw`
      foo
      ^^^^ 0
      bar
      baz
      quux
    `);
  });

  test("6 > line > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      ^^^^ 0
      bar
      baz
      quux
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:299:1", 6, String.raw`
      foo
      bar
      ^^^^ 0
      baz
      quux
    `);
  });

  test("6 > line > x > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
      ^^^^ 0
      baz
      quux
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:312:1", 6, String.raw`
      foo
      bar
      baz
      ^^^^ 0
      quux
    `);
  });

  test("6 > line > line-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      ^^^^ 0
      bar
      baz
      quux
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below.extend");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:325:1", 6, String.raw`
      foo
      ^^^^ 0
      bar
      ^^^^ 0
      baz
      quux
    `);
  });

  test("6 > line-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
       | 0
      bar
      baz
      quux
    `);

    // Perform all operations.
    await executeCommand("dance.select.line.below.extend");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:339:1", 6, String.raw`
      foo
      ^^^^ 0
      bar
      baz
      quux
    `);
  });

  test("7 > line-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
         ^ 0
      bar
      baz
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.line.below.extend");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lines.md:363:1", 6, String.raw`
      foo
      ^^^^ 0
      bar
      baz
    `);
  });

  groupTestsByParentName(this);
});
