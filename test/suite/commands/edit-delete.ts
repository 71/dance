import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/edit-insert.md", function () {
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

  test("1 > delete", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo bar
         ^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.edit.delete");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-insert.md:8:1", 6, String.raw`
      fooar
         | 0
    `);
  });

  test("1 > delete-character", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo bar
         ^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.edit.delete");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-insert.md:18:1", 6, String.raw`
      fooar
         ^ 0
    `);
  });

  test("1 > delete-character > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      fooar
         ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.edit.delete");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-insert.md:30:1", 6, String.raw`
      foor
         ^ 0
    `);
  });

  groupTestsByParentName(this);
});
