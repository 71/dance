import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/edit-insert-line.md", function () {
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

  test("1 > below", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo {
      ^ 0

      }

      bar
       ^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.edit.newLine.below");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-insert-line.md:13:1", 6, String.raw`
      foo {
      ^ 0


      }

      bar
       ^ 1

    `);
  });

  test("1 > select-below", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo {
      ^ 0

      }

      bar
       ^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.edit.newLine.below", { shift: "select" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-insert-line.md:30:1", 6, String.raw`
      foo {
      ··
        | 0

      }

      bar

      | 1
    `);
  });

  test("1 > below-2", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo {
      ^ 0

      }

      bar
       ^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.edit.newLine.below", { count: 2 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-insert-line.md:47:1", 6, String.raw`
      foo {
      ^ 0



      }

      bar
       ^ 1


    `);
  });

  test("1 > select-below-2", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo {
      ^ 0

      }

      bar
       ^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.edit.newLine.below", { shift: "select", count: 2 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-insert-line.md:66:1", 6, String.raw`
      foo {
      ··
        | 1
      ··
        | 0

      }

      bar

      | 3

      | 2
    `);
  });

  test("1 > above", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo {
      ^ 0

      }

      bar
       ^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.edit.newLine.above");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-insert-line.md:87:1", 6, String.raw`

      foo {
      ^ 0

      }


      bar
       ^ 1
    `);
  });

  test("1 > select-above", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo {
      ^ 0

      }

      bar
       ^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.edit.newLine.above", { shift: "select" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-insert-line.md:104:1", 6, String.raw`

      | 0
      foo {

      }


      | 1
      bar
    `);
  });

  test("1 > above-2", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo {
      ^ 0

      }

      bar
       ^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.edit.newLine.above", { count: 2 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-insert-line.md:121:1", 6, String.raw`


      foo {
      ^ 0

      }



      bar
       ^ 1
    `);
  });

  test("1 > select-above-2", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo {
      ^ 0

      }

      bar
       ^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.edit.newLine.above", { shift: "select", count: 2 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-insert-line.md:140:1", 6, String.raw`

      | 1

      | 0
      foo {

      }


      | 3

      | 2
      bar
    `);
  });

  groupTestsByParentName(this);
});
