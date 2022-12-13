import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/edit-paste-before.md", function () {
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

  test("1 > paste", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello world
       ^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.selections.saveText");
    await executeCommand("dance.edit.paste.before");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-paste-before.md:8:1", 6, String.raw`
      helloello world
           ^^^^ 0
    `);
  });

  test("1 > paste-select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello world
       ^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.edit.paste.before.select");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-paste-before.md:19:1", 6, String.raw`
      helloello world
       ^^^^ 0
    `);
  });

  groupTestsByParentName(this);
});
