import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/edit-indent.md", function () {
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

  test("1 > indent", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
      ^ 0
      jumps over the lazy
                         ^ 0
      dog.
    `);

    // Perform all operations.
    await executeCommand("dance.edit.indent");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-indent.md:11:1", 6, String.raw`
        The quick brown fox
        ^ 0
        jumps over the lazy
                           ^ 0
      dog.
    `);
  });

  test("2 > indent", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
      ^ 0
      jumps over the lazy
                        ^ 0
      dog.
    `);

    // Perform all operations.
    await executeCommand("dance.edit.indent");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-indent.md:34:1", 6, String.raw`
        The quick brown fox
        ^ 0
        jumps over the lazy
                          ^ 0
      dog.
    `);
  });

  test("3 > indent", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
      ^^^^^^^^^^^^^^^ 0
      jumps over the lazy
      dog.
    `);

    // Perform all operations.
    await executeCommand("dance.edit.indent");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-indent.md:56:1", 6, String.raw`
        The quick brown fox
        ^^^^^^^^^^^^^^^ 0
      jumps over the lazy
      dog.
    `);
  });

  test("4 > indent", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
      |^^^^^^^^^^^^^^ 0
      jumps over the lazy
      dog.
    `);

    // Perform all operations.
    await executeCommand("dance.edit.indent");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-indent.md:77:1", 6, String.raw`
        The quick brown fox
        |^^^^^^^^^^^^^^ 0
      jumps over the lazy
      dog.
    `);
  });

  test("5 > indent", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
      ^^^^^^^^^^^^^^^^^^^^ 0
      jumps over the lazy
      dog.
    `);

    // Perform all operations.
    await executeCommand("dance.edit.indent");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-indent.md:98:1", 6, String.raw`
        The quick brown fox
        ^^^^^^^^^^^^^^^^^^^^ 0
      jumps over the lazy
      dog.
    `);
  });

  test("6 > indent", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
      | 0
      jumps over the lazy
      dog.
    `);

    // Perform all operations.
    await executeCommand("dance.edit.indent");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/edit-indent.md:120:1", 6, String.raw`
        The quick brown fox
        | 0
      jumps over the lazy
      dog.
    `);
  });

  groupTestsByParentName(this);
});
