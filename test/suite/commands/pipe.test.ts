import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/pipe.md", function () {
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

  test("1 > pipe-replace-with-regexp", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      a b c d
      ^^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.selections.pipe.replace", { expression: String.raw`/\s/-/g` });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/pipe.md:8:1", 6, String.raw`
      a-b-c d
      ^^^^^ 0
    `);
  });

  test("1 > pipe-replace-with-regexp-newline", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      a b c d
      ^^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.selections.pipe.replace", { expression: String.raw`/\s/\n/g` });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/pipe.md:18:1", 6, String.raw`
      a
      ^^ 0
      b
      ^^ 0
      c d
      ^ 0
    `);
  });

  test("1 > pipe-replace-with-regexp-backslash-n", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      a b c d
      ^^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.selections.pipe.replace", { expression: String.raw`/\s/\\n/g` });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/pipe.md:32:1", 6, String.raw`
      a\nb\nc d
      ^^^^^^^ 0
    `);
  });

  test("1 > pipe-replace-with-regexp-backslash-newline", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      a b c d
      ^^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.selections.pipe.replace", { expression: String.raw`/\s/\\\n/g` });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/pipe.md:42:1", 6, String.raw`
      a\
      ^^^ 0
      b\
      ^^^ 0
      c d
      ^ 0
    `);
  });

  test("1 > pipe-replace-with-js", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      a b c d
      ^^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.selections.pipe.replace", { expression: String.raw`$.replace(/\s/g, "-")` });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/pipe.md:56:1", 6, String.raw`
      a-b-c d
      ^^^^^ 0
    `);
  });

  test("1 > pipe-replace-with-js-newline", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      a b c d
      ^^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.selections.pipe.replace", { expression: String.raw`$.replace(/\s/g, "\n")` });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/pipe.md:66:1", 6, String.raw`
      a
      ^^ 0
      b
      ^^ 0
      c d
      ^ 0
    `);
  });

  groupTestsByParentName(this);
});
