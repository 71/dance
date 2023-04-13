import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/edit-align.md", function () {
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

  test("1 > align", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo:bar
         ^ 0
      longfoo:bar
             ^ 1
      foo2:longbar
          ^ 2
    `);

    // Perform all operations.
    await executeCommand("dance.edit.align");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-align.md:12:1", 6, String.raw`
      foo    :bar
             ^ 0
      longfoo:bar
             ^ 1
      foo2   :longbar
             ^ 2
    `);
  });

  test("2 > align", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      selections are aligned by their selection active point
       --> 97) lorem
           ^^^ 0
       --> 98) ipsum
           ^^^ 1
       --> 99) dolor
           ^^^ 2
       --> 100) sit
           ^^^^ 3
       --> 101) amet
           ^^^^ 4
    `);

    // Perform all operations.
    await executeCommand("dance.edit.align");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-align.md:43:1", 6, String.raw`
      selections are aligned by their selection active point
       -->  97) lorem
            ^^^ 0
       -->  98) ipsum
            ^^^ 1
       -->  99) dolor
            ^^^ 2
       --> 100) sit
           ^^^^ 3
       --> 101) amet
           ^^^^ 4
    `);
  });

  test("3 > align", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      Lorem ipsum dolor
      ^^^^^ 0     ^^^^^ 2
            ^^^^^ 1
      consectetur adipiscing elit Morbi eget
      ^^^^^^^^^^^ 3          ^^^^ 5     ^^^^ 7
                  ^^^^^^^^^^ 4    ^^^^^ 6
      Aliquam erat
      ^^^^^^^ 8
              ^^^^ 9
    `);

    // Perform all operations.
    await executeCommand("dance.edit.align");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-align.md:77:1", 6, String.raw`
            Lorem      ipsum dolor
            ^^^^^ 0          ^^^^^ 2
                       ^^^^^ 1
      consectetur adipiscing  elit Morbi eget
      ^^^^^^^^^^^ 3           ^^^^ 5     ^^^^ 7
                  ^^^^^^^^^^ 4     ^^^^^ 6
          Aliquam       erat
          ^^^^^^^ 8     ^^^^ 9
    `);
  });

  test("3 > align-inverted", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      Lorem ipsum dolor
      ^^^^^ 0     ^^^^^ 2
            ^^^^^ 1
      consectetur adipiscing elit Morbi eget
      ^^^^^^^^^^^ 3          ^^^^ 5     ^^^^ 7
                  ^^^^^^^^^^ 4    ^^^^^ 6
      Aliquam erat
      ^^^^^^^ 8
              ^^^^ 9
    `);

    // Perform all operations.
    await executeCommand("dance.selections.changeDirection");
    await executeCommand("dance.edit.align");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-align.md:93:1", 6, String.raw`
      Lorem       ipsum      dolor
      ^^^^^ 0     ^^^^^ 1    ^^^^^ 2
      consectetur adipiscing elit Morbi eget
      ^^^^^^^^^^^ 3          ^^^^ 5     ^^^^ 7
                  ^^^^^^^^^^ 4    ^^^^^ 6
      Aliquam     erat
      ^^^^^^^ 8   ^^^^ 9
    `);
  });

  groupTestsByParentName(this);
});
