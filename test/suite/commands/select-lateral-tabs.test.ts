import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/select-lateral-tabs.md", function () {
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
      a
      	b
       | 0
      		c
      	d
      		e
      	f
      g
      	h

    `);

    // Perform all operations.
    await executeCommand("dance.select.down.jump");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral-tabs.md:19:1", 6, String.raw`
      a
      	b
      		c
       | 0
      	d
      		e
      	f
      g
      	h

    `);
  });

  test("1 > up", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      a
      	b
       | 0
      		c
      	d
      		e
      	f
      g
      	h

    `);

    // Perform all operations.
    await executeCommand("dance.select.up.jump");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral-tabs.md:37:1", 6, String.raw`
      a
       | 0
      	b
      		c
      	d
      		e
      	f
      g
      	h

    `);
  });

  test("2 > down", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      a
      	b
       ^ 0
      		c
      	d
      		e
      	f
      g
      	h

    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.down.jump");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral-tabs.md:74:1", 6, String.raw`
      a
      	b
      		c
       ^ 0
      	d
      		e
      	f
      g
      	h

    `);
  });

  test("2 > up", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      a
      	b
       ^ 0
      		c
      	d
      		e
      	f
      g
      	h

    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.select.up.jump");
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/select-lateral-tabs.md:92:1", 6, String.raw`
      a
       ^ 0
      	b
      		c
      	d
      		e
      	f
      g
      	h

    `);
  });

  groupTestsByParentName(this);
});
