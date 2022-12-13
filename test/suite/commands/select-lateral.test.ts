import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/select-lateral.md", function () {
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

  test("1 > left", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
         ^ 0
      baz
      quxxx
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.left.jump");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:13:1", 6, String.raw`
      foo
      bar
        ^ 0
      baz
      quxxx
    `);
  });

  test("1 > left > right-avoid-eol", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
        ^ 0
      baz
      quxxx
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.right.jump", { avoidEol: true });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:26:1", 6, String.raw`
      foo
      bar
      baz
      ^ 0
      quxxx
    `);
  });

  test("1 > right", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
         ^ 0
      baz
      quxxx
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.right.jump");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:39:1", 6, String.raw`
      foo
      bar
      baz
      ^ 0
      quxxx
    `);
  });

  test("1 > right > left-avoid-eol", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
      baz
      ^ 0
      quxxx
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.left.jump", { avoidEol: true });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:52:1", 6, String.raw`
      foo
      bar
        ^ 0
      baz
      quxxx
    `);
  });

  test("1 > up", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
         ^ 0
      baz
      quxxx
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.up.jump");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:65:1", 6, String.raw`
      foo
         ^ 0
      bar
      baz
      quxxx
    `);
  });

  test("1 > up-avoid-eol", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
         ^ 0
      baz
      quxxx
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.up.jump", { avoidEol: true });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:78:1", 6, String.raw`
      foo
        ^ 0
      bar
      baz
      quxxx
    `);
  });

  test("1 > down", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
         ^ 0
      baz
      quxxx
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:95:1", 6, String.raw`
      foo
      bar
      baz
         ^ 0
      quxxx
    `);
  });

  test("1 > down-avoid-eol", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
         ^ 0
      baz
      quxxx
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.down.jump", { avoidEol: true });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:108:1", 6, String.raw`
      foo
      bar
      baz
        ^ 0
      quxxx
    `);
  });

  test("1 > down-avoid-eol-2", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
         ^ 0
      baz
      quxxx
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.down.jump", { count: 2, avoidEol: true });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:124:1", 6, String.raw`
      foo
      bar
      baz
      quxxx
         ^ 0
    `);
  });

  test("1 > left-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
         ^ 0
      baz
      quxxx
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.left.extend");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:140:1", 6, String.raw`
      foo
      bar
        |^ 0
      baz
      quxxx
    `);
  });

  test("1 > left-extend > right-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
        |^ 0
      baz
      quxxx
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.right.extend");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:153:1", 6, String.raw`
      foo
      bar
         ^ 0
      baz
      quxxx
    `);
  });

  test("1 > right-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
         ^ 0
      baz
      quxxx
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.right.extend");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:166:1", 6, String.raw`
      foo
      bar
         ^ 0
      baz
      ^ 0
      quxxx
    `);
  });

  test("1 > right-extend > left-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
         ^ 0
      baz
      ^ 0
      quxxx
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.left.extend");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:180:1", 6, String.raw`
      foo
      bar
         ^ 0
      baz
      quxxx
    `);
  });

  test("2 > up", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo

      bar
         ^ 0

    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.up.jump");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:205:1", 6, String.raw`
      foo

      ^ 0
      bar

    `);
  });

  test("2 > up-skip-eol-2", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo

      bar
         ^ 0

    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.up.jump", { count: 2, avoidEol: true });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:220:1", 6, String.raw`
      foo
        ^ 0

      bar

    `);
  });

  test("3 > left", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo

      ^ 0
      bar
      baz
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.left.jump");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:245:1", 6, String.raw`
      foo
         ^ 0

      bar
      baz
    `);
  });

  test("3 > right", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo

      ^ 0
      bar
      baz
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.right.jump");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:258:1", 6, String.raw`
      foo

      bar
      ^ 0
      baz
    `);
  });

  test("3 > up", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo

      ^ 0
      bar
      baz
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.up.jump");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:271:1", 6, String.raw`
      foo
      ^ 0

      bar
      baz
    `);
  });

  test("3 > down", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo

      ^ 0
      bar
      baz
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:284:1", 6, String.raw`
      foo

      bar
      ^ 0
      baz
    `);
  });

  test("3 > down > up", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo

      bar
      ^ 0
      baz
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.up.jump");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:297:1", 6, String.raw`
      foo

      ^ 0
      bar
      baz
    `);
  });

  test("3 > down > up-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo

      bar
      ^ 0
      baz
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.up.extend");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:310:1", 6, String.raw`
      foo

      | 0
      bar
      ^ 0
      baz
    `);
  });

  test("3 > down > up-extend > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo

      | 0
      bar
      ^ 0
      baz
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.up.extend");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:324:1", 6, String.raw`
      foo
      | 0

      ^ 0
      bar
      ^ 0
      baz
    `);
  });

  test("4 > down-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abc
        | 0


    `);

    // Perform all operations.
    await executeCommand("dance.select.down.extend");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:350:1", 6, String.raw`
      abc
        ^^ 0


    `);
  });

  test("4 > down-extend > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abc
        ^^ 0


    `);

    // Perform all operations.
    await executeCommand("dance.select.down.extend");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral.md:362:1", 6, String.raw`
      abc
        ^^ 0

      ^ 0

    `);
  });

  groupTestsByParentName(this);
});
