import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/edit-paste-many.md", function () {
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

  test("1 > paste-after-select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo bar quux
      ^^^ 2   ^^^^ 0
          ^^^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.selections.saveText");
    await executeCommand("dance.edit.paste.after.select");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-paste-many.md:9:1", 6, String.raw`
      foofoo barbar quuxquux
         ^^^ 2          ^^^^ 0
                ^^^ 1
    `);
  });

  test("1 > paste-before-select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo bar quux
      ^^^ 2   ^^^^ 0
          ^^^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.selections.saveText");
    await executeCommand("dance.edit.paste.before.select");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-paste-many.md:21:1", 6, String.raw`
      foofoo barbar quuxquux
      ^^^ 2         ^^^^ 0
             ^^^ 1
    `);
  });

  test("1 > paste-all-after-select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo bar quux
      ^^^ 2   ^^^^ 0
          ^^^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.selections.saveText");
    await executeCommand("dance.edit.pasteAll.after.select");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-paste-many.md:33:1", 6, String.raw`
      foofoobarquux barfoobarquux quuxfoobarquux
         ^^^ 8 ^^^^ 6  ^^^ 5 ^^^^ 3   ^^^ 2 ^^^^ 0
            ^^^ 7         ^^^ 4          ^^^ 1
    `);
  });

  test("1 > paste-all-before-select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo bar quux
      ^^^ 2   ^^^^ 0
          ^^^ 1
    `);

    // Perform all operations.
    await executeCommand("dance.selections.saveText");
    await executeCommand("dance.edit.pasteAll.before.select");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-paste-many.md:45:1", 6, String.raw`
      foobarquuxfoo foobarquuxbar foobarquuxquux
      ^^^ 8 ^^^^ 6  ^^^ 5 ^^^^ 3  ^^^ 2 ^^^^ 0
         ^^^ 7         ^^^ 4         ^^^ 1
    `);
  });

  groupTestsByParentName(this);
});
