import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/selections-order.md", function () {
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

  test("1 > change-order", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
       ^ 0
      bar
       ^ 1
      quux
       ^ 2
         ^ 3
    `);

    // Perform all operations.
    await executeCommand("dance.selections.changeOrder");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-order.md:13:1", 6, String.raw`
      foo
       ^ 3
      bar
       ^ 2
      quux
       ^ 1
         ^ 0
    `);
  });

  test("1 > order-desc", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
       ^ 0
      bar
       ^ 1
      quux
       ^ 2
         ^ 3
    `);

    // Perform all operations.
    await executeCommand("dance.selections.changeOrder", { direction: 1 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-order.md:28:1", 6, String.raw`
      foo
       ^ 0
      bar
       ^ 1
      quux
       ^ 2
         ^ 3
    `);
  });

  test("1 > order-asc", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
       ^ 0
      bar
       ^ 1
      quux
       ^ 2
         ^ 3
    `);

    // Perform all operations.
    await executeCommand("dance.selections.changeOrder", { direction: -1 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-order.md:43:1", 6, String.raw`
      foo
       ^ 3
      bar
       ^ 2
      quux
       ^ 1
         ^ 0
    `);
  });

  test("2 > change-order", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
       ^ 0
      bar
       ^ 2
      quux
       ^ 1
         ^ 3
    `);

    // Perform all operations.
    await executeCommand("dance.selections.changeOrder");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/selections-order.md:72:1", 6, String.raw`
      foo
       ^ 3
      bar
       ^ 1
      quux
       ^ 2
         ^ 0
    `);
  });

  groupTestsByParentName(this);
});
