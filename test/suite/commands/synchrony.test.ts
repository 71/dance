import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/synchrony.md", function () {
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

  test("1 > down", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`

      ^ 0




































































      b
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/synchrony.md:79:1", 6, String.raw`





































































      b
      ^ 0
    `);
  });

  groupTestsByParentName(this);
});
