import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/seek-word-edge.md", function () {
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

  test("1 > word-start-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown fox
      |^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:8:1", 6, String.raw`
      the quick brown fox
      |^ 0
    `);
  });

  test("1 > word-start-4", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown fox
      |^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word", { count: 4 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:20:1", 6, String.raw`
      the quick brown fox
                      ^^^ 0
    `);
  });

  test("1 > word-start-4 > word-start", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown fox
                      ^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:30:1", 6, String.raw`
      the quick brown fox
                      ^^^ 0
    `);
  });

  test("1 > word-start-4 > word-start > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown fox
                      ^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:42:1", 6, String.raw`
      the quick brown fox
                      ^^^ 0
    `);
  });

  test("1 > word-start-4 > word-start-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown fox
                      ^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:54:1", 6, String.raw`
      the quick brown fox
                      |^^ 0
    `);
  });

  test("1 > word-start-4 > word-start-backward-2", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown fox
                      ^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward", { count: 2 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:64:1", 6, String.raw`
      the quick brown fox
                |^^^^^ 0
    `);
  });

  test("1 > word-start-4 > word-start-backward-5", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown fox
                      ^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward", { count: 5 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:74:1", 6, String.raw`
      the quick brown fox
      |^^^ 0
    `);
  });

  test("1 > word-start-5", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown fox
      |^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word", { count: 5 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:86:1", 6, String.raw`
      the quick brown fox
                      ^^^ 0
    `);
  });

  test("2 > word-start-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo bar
             ^ 0
      baz
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:106:1", 6, String.raw`
      foo bar
          |^^ 0
      baz
    `);
  });

  test("3 > word-start-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown fox
      |^^^ 0
            |^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.word.backward");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:127:1", 6, String.raw`
      the quick brown fox
          |^^ 0
    `);
  });

  test("3 > word-start-backward-9", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown fox
      |^^^ 0
            |^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.word.backward", { count: 9 });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:139:1", 6, String.raw`
      the quick brown fox
      |^^^ 0
    `);
  });

  test("3 > word-end-4", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown fox
      |^^^ 0
            |^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.wordEnd", { count: 4 });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:151:1", 6, String.raw`
      the quick brown fox
                     ^^^^ 0
    `);
  });

  test("3 > word-end-5", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown fox
      |^^^ 0
            |^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.wordEnd", { count: 5 });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:163:1", 6, String.raw`
      the quick brown fox
                     ^^^^ 0
    `);
  });

  test("4 > word-start-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`

      there is a blank line before me
      |^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.word.backward");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:185:1", 6, String.raw`

      ^ 0
      there is a blank line before me
      ^ 0
    `);
  });

  test("4 > word-start-backward > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`

      ^ 0
      there is a blank line before me
      ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.word.backward");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:200:1", 6, String.raw`

      ^ 0
      there is a blank line before me
      ^ 0
    `);
  });

  test("4 > word-start-backward-4", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`

      there is a blank line before me
      |^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.word.backward", { count: 9 });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:214:1", 6, String.raw`

      ^ 0
      there is a blank line before me
      ^ 0
    `);
  });

  test("5 > word-start-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`


      there are two blank lines before me
      |^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.word.backward");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:239:1", 6, String.raw`

      ^ 0

      ^ 0
      there are two blank lines before me
    `);
  });

  test("5 > word-start-backward > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`

      ^ 0

      ^ 0
      there are two blank lines before me
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.word.backward");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:255:1", 6, String.raw`

      ^ 0

      ^ 0
      there are two blank lines before me
    `);
  });

  test("5 > word-start-backward-9", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`


      there are two blank lines before me
      |^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.word.backward", { count: 9 });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:270:1", 6, String.raw`

      ^ 0

      ^ 0
      there are two blank lines before me
    `);
  });

  groupTestsByParentName(this);
});
