import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/seek-object-quoted.md", function () {
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

  test("1 > select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello world "inside a quote, there can be escaped \" characters! also\"\\\"\\""
                      ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#noescape)\"(?#inner)(?#noescape)\"" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-quoted.md:13:1", 6, String.raw`
      hello world "inside a quote, there can be escaped \" characters! also\"\\\"\\""
                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
    `);
  });

  test("1 > select-inner", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      hello world "inside a quote, there can be escaped \" characters! also\"\\\"\\""
                      ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#noescape)\"(?#inner)(?#noescape)\"", inner: true });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-quoted.md:23:1", 6, String.raw`
      hello world "inside a quote, there can be escaped \" characters! also\"\\\"\\""
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
    `);
  });

  groupTestsByParentName(this);
});
