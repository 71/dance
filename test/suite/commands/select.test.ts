import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/select.md", function () {
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

  test("1 > to-first-line", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
      | 0
      baz

    `);

    // Perform all operations.
    await executeCommand("dance.select.lineStart", { count: 1, shift: "jump" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select.md:11:1", 6, String.raw`
      foo
      | 0
      bar
      baz

    `);
  });

  test("1 > to-last-line", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      bar
      | 0
      baz

    `);

    // Perform all operations.
    await executeCommand("dance.select.lastLine", { shift: "jump" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select.md:24:1", 6, String.raw`
      foo
      bar
      baz
      | 0

    `);
  });

  groupTestsByParentName(this);
});
