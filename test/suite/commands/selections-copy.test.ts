import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/selections-copy.md", function () {
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

  test("1 > copy", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      ^ 0
      bar
      baz
      qux
    `);

    // Perform all operations.
    await executeCommand("dance.selections.copy");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-copy.md:11:1", 6, String.raw`
      foo
      ^ 1
      bar
      ^ 0
      baz
      qux
    `);
  });

  test("1 > copy > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      ^ 1
      bar
      ^ 0
      baz
      qux
    `);

    // Perform all operations.
    await executeCommand("dance.selections.copy");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-copy.md:25:1", 6, String.raw`
      foo
      ^ 2
      bar
      ^ 1
      baz
      ^ 0
      qux
    `);
  });

  test("2 > copy", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      aaa aaa aaa
        bb bb bb bb
         ^ 0     ^^ 1
          cc cc cc cc
            ddd
           ee
          f
        gg gg gg gg gg
    `);

    // Perform all operations.
    await executeCommand("dance.selections.copy");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-copy.md:53:1", 6, String.raw`
      aaa aaa aaa
        bb bb bb bb
         ^ 2     ^^ 3
          cc cc cc cc
         ^ 0     ^^ 1
            ddd
           ee
          f
        gg gg gg gg gg
    `);
  });

  test("2 > copy > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      aaa aaa aaa
        bb bb bb bb
         ^ 2     ^^ 3
          cc cc cc cc
         ^ 0     ^^ 1
            ddd
           ee
          f
        gg gg gg gg gg
    `);

    // Perform all operations.
    await executeCommand("dance.selections.copy");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-copy.md:72:1", 6, String.raw`
      aaa aaa aaa
        bb bb bb bb
         ^ 4     ^^ 5
          cc cc cc cc
         ^ 2     ^^ 3
            ddd
         ^ 0
           ee
          f
        gg gg gg gg gg
                 ^^ 1
    `);
  });

  test("2 > copy > x > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      aaa aaa aaa
        bb bb bb bb
         ^ 4     ^^ 5
          cc cc cc cc
         ^ 2     ^^ 3
            ddd
         ^ 0
           ee
          f
        gg gg gg gg gg
                 ^^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.selections.copy");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-copy.md:93:1", 6, String.raw`
      aaa aaa aaa
        bb bb bb bb
         ^ 5     ^^ 6
          cc cc cc cc
         ^ 3     ^^ 4
            ddd
         ^ 1
           ee
         ^ 0
          f
        gg gg gg gg gg
                 ^^ 2
    `);
  });

  test("3 > copy", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      ab
        ^ 0
      cd
      efg
      hi
    `);

    // Perform all operations.
    await executeCommand("dance.selections.copy");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-copy.md:125:1", 6, String.raw`
      ab
        ^ 1
      cd
        ^ 0
      efg
      hi
    `);
  });

  test("3 > copy > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      ab
        ^ 1
      cd
        ^ 0
      efg
      hi
    `);

    // Perform all operations.
    await executeCommand("dance.selections.copy");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-copy.md:139:1", 6, String.raw`
      ab
        ^ 2
      cd
        ^ 1
      efg
        ^ 0
      hi
    `);
  });

  groupTestsByParentName(this);
});
