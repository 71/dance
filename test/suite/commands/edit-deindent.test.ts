import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/edit-deindent.md", function () {
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

  test("1 > deindent", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      |^^ 0
       bar
        baz
         quux
           ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.edit.deindent.withIncomplete");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-deindent.md:12:1", 6, String.raw`
      foo
      |^^ 0
      bar
      baz
       quux
         ^ 0
    `);
  });

  test("1 > deindent-alt", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      |^^ 0
       bar
        baz
         quux
           ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.edit.deindent");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-deindent.md:26:1", 6, String.raw`
      foo
      |^^ 0
       bar
      baz
       quux
         ^ 0
    `);
  });

  groupTestsByParentName(this);
});
