import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/seek.md", function () {
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

  test("1 > select-to-included", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcabc
      | 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "c", include: true });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:8:1", 6, String.raw`
      abcabc
      ^^^ 0
    `);
  });

  test("1 > select-to-included > select-to", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcabc
      ^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "c" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:18:1", 6, String.raw`
      abcabc
         ^^ 0
    `);
  });

  test("1 > select-to-included > select-to-character", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcabc
      ^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek", { input: "c" });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:28:1", 6, String.raw`
      abcabc
        ^^^ 0
    `);
  });

  test("1 > select-to-c-2", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcabc
      | 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "c", count: 2 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:40:1", 6, String.raw`
      abcabc
      ^^^^^ 0
    `);
  });

  test("1 > select-to-c-2 > select-to-c", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcabc
      ^^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "c", $expect: /^no selections remain$/ });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:50:1", 6, String.raw`
      abcabc
      ^^^^^ 0
    `);
  });

  test("1 > select-to-c-2 > select-to-c > select-to-b-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcabc
      ^^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "b", direction: -1 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:60:1", 6, String.raw`
      abcabc
           | 0
    `);
  });

  test("1 > select-to-c-2 > select-to-c > select-to-b-backward > select-to-a-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcabc
           | 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "a", direction: -1 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:70:1", 6, String.raw`
      abcabc
          ^ 0
    `);
  });

  test("1 > select-to-c-2 > select-to-c-character", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcabc
      ^^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek", { input: "c", $expect: /^no selections remain$/ });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:80:1", 6, String.raw`
      abcabc
      ^^^^^ 0
    `);
  });

  test("1 > select-to-c-2 > select-to-c-character > select-to-b-character", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcabc
      ^^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek", { input: "b", direction: -1 });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:92:1", 6, String.raw`
      abcabc
        |^^ 0
    `);
  });

  test("2 > extend-to-e-included-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcdefghijk
         ^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "e", direction: -1, shift: "extend", include: true });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:109:1", 6, String.raw`
      abcdefghijk
         ^^ 0
    `);
  });

  test("2 > extend-to-g-included-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcdefghijk
         ^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "g", direction: -1, shift: "extend", include: true });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:119:1", 6, String.raw`
      abcdefghijk
         ^^^^ 0
    `);
  });

  test("2 > extend-to-d-included-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcdefghijk
         ^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "d", direction: -1, shift: "extend", include: true });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:131:1", 6, String.raw`
      abcdefghijk
         ^ 0
    `);
  });

  test("2 > extend-to-b-included-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcdefghijk
         ^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "b", direction: -1, shift: "extend", include: true });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:141:1", 6, String.raw`
      abcdefghijk
       |^ 0
    `);
  });

  test("2 > extend-to-b-backward-character", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcdefghijk
         ^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek", { input: "b", direction: -1, shift: "extend", include: true });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:151:1", 6, String.raw`
      abcdefghijk
       |^^ 0
    `);
  });

  test("2 > extend-to-g-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcdefghijk
         ^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "g", direction: -1, shift: "extend" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:163:1", 6, String.raw`
      abcdefghijk
         ^^^^ 0
    `);
  });

  test("2 > extend-to-f-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcdefghijk
         ^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "f", direction: -1, shift: "extend" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:175:1", 6, String.raw`
      abcdefghijk
         ^^^ 0
    `);
  });

  test("2 > extend-to-e-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcdefghijk
         ^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "e", direction: -1, shift: "extend" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:185:1", 6, String.raw`
      abcdefghijk
         ^^ 0
    `);
  });

  test("2 > extend-to-c-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcdefghijk
         ^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "c", direction: -1, shift: "extend" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:195:1", 6, String.raw`
      abcdefghijk
         | 0
    `);
  });

  test("2 > extend-to-b-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abcdefghijk
         ^^^^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "b", direction: -1, shift: "extend" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:205:1", 6, String.raw`
      abcdefghijk
        ^ 0
    `);
  });

  test("3 > select-to-line-end", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abc
      def
      ghi
       | 0
      jkl
      mno
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "\n" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:226:1", 6, String.raw`
      abc
      def
      ghi
       ^^ 0
      jkl
      mno
    `);
  });

  test("3 > select-to-line-end-included", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      abc
      def
      ghi
       | 0
      jkl
      mno
    `);

    // Perform all operations.
    await executeCommand("dance.seek", { input: "\n", include: true });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek.md:240:1", 6, String.raw`
      abc
      def
      ghi
       ^^^ 0
      jkl
      mno
    `);
  });

  groupTestsByParentName(this);
});
