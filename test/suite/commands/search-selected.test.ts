import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/search-selected.md", function () {
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

  test("ascii > search-selected-smart", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      a a
      ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.search.selection.smart");
    await executeCommand("dance.search.next");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-selected.md:8:1", 6, String.raw`
      a a
        ^ 0
    `);
  });

  test("ascii-punct > search-selected-smart", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      . .
      ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.search.selection.smart");
    await executeCommand("dance.search.next");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-selected.md:26:1", 6, String.raw`
      . .
        ^ 0
    `);
  });

  test("unicode > search-selected-smart", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      é é
      ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.search.selection.smart");
    await executeCommand("dance.search.next");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-selected.md:44:1", 6, String.raw`
      é é
        ^ 0
    `);
  });

  groupTestsByParentName(this);
});
