import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/edit-paste.md", function () {
  // Set up document.
  let document: vscode.TextDocument,
      editor: vscode.TextEditor;

  this.beforeAll(async () => {
    document = await vscode.workspace.openTextDocument();
    editor = await vscode.window.showTextDocument(document);
    editor.options.insertSpaces = true;
    editor.options.tabSize = 2;

    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });
  });

  this.afterAll(async () => {
    await executeCommand("workbench.action.closeActiveEditor");
  });

  test("1 > paste", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      ^^^^ 0
      bar
    `);

    // Perform all operations.
    await executeCommand("dance.selections.saveText");
    await executeCommand("dance.edit.paste.after");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-paste.md:9:1", 6, String.raw`
      foo
      ^^^^ 0
      foo
      bar
    `);
  });

  test("1 > paste > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      ^^^^ 0
      foo
      bar
    `);

    // Perform all operations.
    await executeCommand("dance.edit.paste.after");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-paste.md:22:1", 6, String.raw`
      foo
      ^^^^ 0
      foo
      foo
      bar
    `);
  });

  test("1 > move-then-paste", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      ^^^^ 0
      bar
    `);

    // Perform all operations.
    await executeCommand("dance.select.left.jump");
    await executeCommand("dance.edit.paste.after");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-paste.md:35:1", 6, String.raw`
      foo
         | 0
      foo
      bar
    `);
  });

  test("1 > move-then-paste > move-2-then-paste", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
         | 0
      foo
      bar
    `);

    // Perform all operations.
    await executeCommand("dance.select.left.extend", { count: 2 });
    await executeCommand("dance.selections.saveText");
    await executeCommand("dance.edit.paste.after");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-paste.md:48:1", 6, String.raw`
      foooo
       ^^ 0
      foo
      bar
    `);
  });

  test("2 > paste-3", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
      ^^^^^^ 0

    `);

    // Perform all operations.
    await executeCommand("dance.selections.saveText");
    await executeCommand("dance.edit.paste.after", { count: 3 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-paste.md:70:1", 6, String.raw`
      hello
      ^^^^^^ 0
      hello
      hello
      hello

    `);
  });

  test("3 > paste-select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo bar
      ^^ 0 ^^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.selections.saveText");
    await executeCommand("dance.edit.paste.after.select");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-paste.md:92:1", 6, String.raw`
      fofoaro barfoar
        ^^ 3     ^^ 1
          ^^ 2     ^^ 0
    `);
  });

  test("3 > paste-select-from-empty", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo bar
      ^^ 0 ^^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.selections.saveText");
    await executeCommand("dance.selections.reduce");
    await executeCommand("dance.edit.paste.after.select");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-paste.md:104:1", 6, String.raw`
      fofoaro barfoar
        ^^ 3     ^^ 1
          ^^ 2     ^^ 0
    `);
  });

  test("3 > paste-select-before", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo bar
      ^^ 0 ^^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.selections.saveText");
    await executeCommand("dance.edit.paste.before.select");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-paste.md:117:1", 6, String.raw`
      foarfoo bfoarar
      ^^ 3     ^^ 1
        ^^ 2     ^^ 0
    `);
  });

  test("3 > paste-select-before-from-empty", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo bar
      ^^ 0 ^^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.selections.saveText");
    await executeCommand("dance.selections.reduce", { where: "start" });
    await executeCommand("dance.edit.paste.before.select");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-paste.md:129:1", 6, String.raw`
      foarfoo bfoarar
      ^^ 3     ^^ 1
        ^^ 2     ^^ 0
    `);
  });

  groupTestsByParentName(this);
});
