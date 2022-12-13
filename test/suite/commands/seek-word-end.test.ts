import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/seek-word-end.md", function () {
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

  test("1 > word-end", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      private String foo;
         | 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek.wordEnd");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-end.md:8:1", 6, String.raw`
      private String foo;
         ^^^^ 0
    `);
  });

  test("1 > word-end > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      private String foo;
         ^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek.wordEnd");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-end.md:18:1", 6, String.raw`
      private String foo;
             ^^^^^^^ 0
    `);
  });

  test("1 > word-end-2", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      private String foo;
         | 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek.wordEnd", { count: 2 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-end.md:28:1", 6, String.raw`
      private String foo;
             ^^^^^^^ 0
    `);
  });

  groupTestsByParentName(this);
});
