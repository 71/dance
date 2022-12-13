import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/selections-sort.md", function () {
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

  test("1 > sort-by-content", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      z
      ^ 0
       y
       ^ 2
        x
        ^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.selections.sort", { expression: "$" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-sort.md:12:1", 6, String.raw`
      z
      ^ 2
       y
       ^ 1
        x
        ^ 0
    `);
  });

  test("1 > sort-by-content-desc", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      z
      ^ 0
       y
       ^ 2
        x
        ^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.selections.sort", { expression: "$", direction: -1 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-sort.md:26:1", 6, String.raw`
      z
      ^ 0
       y
       ^ 1
        x
        ^ 2
    `);
  });

  test("1 > sort-by-position-with-priority-for-y", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      z
      ^ 0
       y
       ^ 2
        x
        ^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.selections.sort", { expression: "($ === 'y' ? ' ' : '') + Selections.toString(Selections.nth(i))" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-sort.md:40:1", 6, String.raw`
      z
      ^ 1
       y
       ^ 0
        x
        ^ 2
    `);
  });

  groupTestsByParentName(this);
});
