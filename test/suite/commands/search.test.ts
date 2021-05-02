import * as vscode from "vscode";

import { ExpectedDocument, groupTestsByParentName } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("./test/suite/commands/search.md", function () {
  // Set up document.
  let document: vscode.TextDocument,
      editor: vscode.TextEditor;

  this.beforeAll(async () => {
    document = await vscode.workspace.openTextDocument();
    editor = await vscode.window.showTextDocument(document);

    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });
  });

  this.afterAll(async () => {
    await executeCommand("workbench.action.closeActiveEditor");
  });

  test("easy > search-b", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo bar
        ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "b" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:8:1", 6, String.raw`
      foo bar
          ^ 0
    `);
  });

  test("1 > search", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "brown" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:27:1", 6, String.raw`
      The quick brown fox
                ^^^^^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("1 > search-repeat", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "o", count: 2 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:39:1", 6, String.raw`
      The quick brown fox
                       ^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("1 > search-start", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "quick" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:51:1", 6, String.raw`
      The quick brown fox
      jumps over the
      lazy dog quickly.
               ^^^^^ 0
    `);
  });

  test("1 > search-start-wrap", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "quick " });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:65:1", 6, String.raw`
      The quick brown fox
          ^^^^^^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("1 > search-wrap", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "Th" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:79:1", 6, String.raw`
      The quick brown fox
      ^^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("1 > search-not-found", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "pig" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:91:1", 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("1 > search-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "Th", direction: -1 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:106:1", 6, String.raw`
      The quick brown fox
      ^^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("1 > search-backward-wrap", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "he", direction: -1 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:120:1", 6, String.raw`
      The quick brown fox
      jumps over the
                  ^^ 0
      lazy dog quickly.
    `);
  });

  test("1 > search-backward-wrap-other", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "he q", direction: -1 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:134:1", 6, String.raw`
      The quick brown fox
       ^^^^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("1 > search-backward-not-found", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "pig", direction: -1 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:148:1", 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("1 > search-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "quick", shift: "extend" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:163:1", 6, String.raw`
      The quick brown fox
        ^ 0
      jumps over the
      lazy dog quickly.
                   ^ 0
    `);
  });

  test("1 > search-extend-wrap", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "T", shift: "extend" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:176:1", 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("1 > search-backward-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "T", direction: -1, shift: "extend" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:192:1", 6, String.raw`
      The quick brown fox
      |^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("1 > search-backward-extend-character", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.search", { input: "T", direction: -1, shift: "extend" });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:206:1", 6, String.raw`
      The quick brown fox
      |^^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("1 > search-backward-extend-other", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "Th", direction: -1, shift: "extend" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:222:1", 6, String.raw`
      The quick brown fox
      |^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("1 > search-backward-extend-character-other", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.search", { input: "Th", direction: -1, shift: "extend" });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:236:1", 6, String.raw`
      The quick brown fox
      |^^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("1 > search-backward-extend-wrap", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "lazy", direction: -1, shift: "extend" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:252:1", 6, String.raw`
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("2 > search", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
                 | 0
      jumps over the
      lazy dog quickly.
        ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "o" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:281:1", 6, String.raw`
      The quick brown fox
      jumps over the
      lazy dog quickly.
            ^ 0
    `);
  });

  test("2 > search-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
                 | 0
      jumps over the
      lazy dog quickly.
        ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "o", shift: "extend" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:295:1", 6, String.raw`
      The quick brown fox
      jumps over the
      lazy dog quickly.
         ^^^^ 0
    `);
  });

  test("2 > search-extend-character", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
                 | 0
      jumps over the
      lazy dog quickly.
        ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.search", { input: "o", shift: "extend" });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:309:1", 6, String.raw`
      The quick brown fox
      jumps over the
      lazy dog quickly.
        ^^^^^ 0
    `);
  });

  test("2 > search-wrap", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
                 | 0
      jumps over the
      lazy dog quickly.
        ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "he" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:325:1", 6, String.raw`
      The quick brown fox
       |^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("2 > search-extend-wrap", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
                 | 0
      jumps over the
      lazy dog quickly.
        ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "he", shift: "extend" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:339:1", 6, String.raw`
      The quick brown fox
                 | 0
      jumps over the
      lazy dog quickly.
        ^ 0
    `);
  });

  test("2 > search-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
                 | 0
      jumps over the
      lazy dog quickly.
        ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "u", direction: -1 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:355:1", 6, String.raw`
      The quick brown fox
           ^ 0
      jumps over the
      lazy dog quickly.
    `);
  });

  test("2 > search-backward-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
                 | 0
      jumps over the
      lazy dog quickly.
        ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "u", direction: -1, shift: "extend" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:369:1", 6, String.raw`
      The quick brown fox
           | 0
      jumps over the
      lazy dog quickly.
        ^ 0
    `);
  });

  test("2 > search-backward-wrap", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
                 | 0
      jumps over the
      lazy dog quickly.
        ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "o", direction: -1 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:384:1", 6, String.raw`
      The quick brown fox
      jumps over the
      lazy dog quickly.
            ^ 0
    `);
  });

  test("2 > search-backward-extend-wrap", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      The quick brown fox
                 | 0
      jumps over the
      lazy dog quickly.
        ^ 0
    `);

    // Perform all operations.
    await executeCommand("dance.search", { input: "o", direction: -1, shift: "extend" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search.md:398:1", 6, String.raw`
      The quick brown fox
                 | 0
      jumps over the
      lazy dog quickly.
        ^ 0
    `);
  });

  groupTestsByParentName(this);
});
