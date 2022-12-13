import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/edit-join.md", function () {
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

  test("1 > join", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      a b
      ^^^ 0
      c d
      ^^^ 0
      e f
      ^^^ 0
      g h
    `);

    // Perform all operations.
    await executeCommand("dance.edit.join");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-join.md:13:1", 6, String.raw`
      a b c d e f
      ^^^^^^^^^^^ 0
      g h
    `);
  });

  test("1 > join-select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      a b
      ^^^ 0
      c d
      ^^^ 0
      e f
      ^^^ 0
      g h
    `);

    // Perform all operations.
    await executeCommand("dance.edit.join.select");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-join.md:24:1", 6, String.raw`
      a b c d e f
         ^ 0 ^ 1
      g h
    `);
  });

  test("2 > join", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      a b
        ^ 0
      c d
      e f
         ^ 1
      g h
      i j
    `);

    // Perform all operations.
    await executeCommand("dance.edit.join");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-join.md:47:1", 6, String.raw`
      a b c d
        ^ 0
      e f g h
         ^ 1
      i j
    `);
  });

  test("2 > join-select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      a b
        ^ 0
      c d
      e f
         ^ 1
      g h
      i j
    `);

    // Perform all operations.
    await executeCommand("dance.edit.join.select");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-join.md:60:1", 6, String.raw`
      a b c d
         ^ 0
      e f g h
         ^ 1
      i j
    `);
  });

  groupTestsByParentName(this);
});
