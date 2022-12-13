import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/selections-trim.md", function () {
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

  test("1 > trim-whitespace", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`

      ^ 0
      there are two blank lines before me
               ^ 0                       | 1
         some whitespaces around me    
                                      ^ 1
      and some more words
      ^^^^^^^^^^^^^ 2
      finally a selection    
                          ^^^ 3
          that contains only whitespace
      ^^^| 3
    `);

    // Perform all operations.
    await executeCommand("dance.selections.trimWhitespace");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-trim.md:18:1", 6, String.raw`

      there are two blank lines before me
      ^^^^^^^^^ 0
         some whitespaces around me    
         |^^^^^^^^^^^^^^^^^^^^^^^^^ 1
      and some more words
      ^^^^^^^^^^^^^ 2
      finally a selection    
          that contains only whitespace
    `);
  });

  test("2 > trim", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
       ^ 0
      world
      my dear
       |^^^^^ 1
      friends
    `);

    // Perform all operations.
    await executeCommand("dance.selections.trimLines", { $expect: /^no selections remain$/ });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-trim.md:46:1", 6, String.raw`
      hello
       ^ 0
      world
      my dear
       |^^^^^ 1
      friends
    `);
  });

  test("2 > expand", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
       ^ 0
      world
      my dear
       |^^^^^ 1
      friends
    `);

    // Perform all operations.
    await executeCommand("dance.selections.expandToLines");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-trim.md:63:1", 6, String.raw`
      hello
      ^^^^^^ 0
      world
      my dear
      |^^^^^^^ 1
      friends
    `);
  });

  test("2 > expand > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
      ^^^^^^ 0
      world
      my dear
      |^^^^^^^ 1
      friends
    `);

    // Perform all operations.
    await executeCommand("dance.selections.expandToLines");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-trim.md:77:1", 6, String.raw`
      hello
      ^^^^^^ 0
      world
      my dear
      |^^^^^^^ 1
      friends
    `);
  });

  test("3 > expand", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
       |^^^^ 0
      world
      ^^ 0
      my
        ^ 1
      dear
      ^^^^^ 1
      friends
      ^^^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.selections.expandToLines");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-trim.md:108:1", 6, String.raw`
      hello
      |^^^^^ 0
      world
      ^^^^^^ 0
      my
      ^^^ 1
      dear
      ^^^^^ 1
      friends
      ^^^^^^^ 1
    `);
  });

  test("3 > trim", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello
       |^^^^ 0
      world
      ^^ 0
      my
        ^ 1
      dear
      ^^^^^ 1
      friends
      ^^^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.selections.trimLines");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-trim.md:129:1", 6, String.raw`
      hello
      world
      my
      dear
      ^^^^^ 0
      friends
    `);
  });

  groupTestsByParentName(this);
});
