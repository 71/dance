import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/search-next.md", function () {
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

  test("1 > search-apple", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      apple pineapple pear
      ^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    // Perform all operations.
    await executeCommand("dance.search", { re: "apple" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-next.md:10:1", 6, String.raw`
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);
  });

  test("1 > search-apple > next", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    // Perform all operations.
    await executeCommand("dance.search.next");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-next.md:22:1", 6, String.raw`
      apple pineapple pear
      pear pineapple apple
               ^^^^^ 0
      kiwi orange kiwi
    `);
  });

  test("1 > search-apple > next-add", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    // Perform all operations.
    await executeCommand("dance.search.next.add");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-next.md:34:1", 6, String.raw`
      apple pineapple pear
                ^^^^^ 1
      pear pineapple apple
               ^^^^^ 0
      kiwi orange kiwi
    `);
  });

  test("1 > search-apple > next-3", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    // Perform all operations.
    await executeCommand("dance.search.next", { count: 3 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-next.md:47:1", 6, String.raw`
      apple pineapple pear
      ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);
  });

  test("1 > search-apple > next-add-3", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    // Perform all operations.
    await executeCommand("dance.search.next.add", { count: 3 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-next.md:61:1", 6, String.raw`
      apple pineapple pear
      ^^^^^ 0   ^^^^^ 3
      pear pineapple apple
               ^^^^^ 2
                     ^^^^^ 1
      kiwi orange kiwi
    `);
  });

  test("1 > search-apple > next-4", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    // Perform all operations.
    await executeCommand("dance.search.next", { count: 4 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-next.md:77:1", 6, String.raw`
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);
  });

  test("1 > search-apple > next-add-4", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    // Perform all operations.
    await executeCommand("dance.search.next.add", { count: 4 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-next.md:91:1", 6, String.raw`
      apple pineapple pear
      ^^^^^ 1   ^^^^^ 0
      pear pineapple apple
               ^^^^^ 3
                     ^^^^^ 2
      kiwi orange kiwi
    `);
  });

  test("1 > search-apple > previous", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    // Perform all operations.
    await executeCommand("dance.search.previous");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-next.md:108:1", 6, String.raw`
      apple pineapple pear
      ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);
  });

  test("1 > search-apple > previous-add", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    // Perform all operations.
    await executeCommand("dance.search.previous.add");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-next.md:120:1", 6, String.raw`
      apple pineapple pear
      ^^^^^ 0   ^^^^^ 1
      pear pineapple apple
      kiwi orange kiwi
    `);
  });

  test("1 > search-apple > previous-2", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    // Perform all operations.
    await executeCommand("dance.search.previous", { count: 2 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-next.md:132:1", 6, String.raw`
      apple pineapple pear
      pear pineapple apple
                     ^^^^^ 0
      kiwi orange kiwi
    `);
  });

  test("1 > search-apple > previous-add-2", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      apple pineapple pear
                ^^^^^ 0
      pear pineapple apple
      kiwi orange kiwi
    `);

    // Perform all operations.
    await executeCommand("dance.search.previous.add", { count: 2 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-next.md:146:1", 6, String.raw`
      apple pineapple pear
      ^^^^^ 1   ^^^^^ 2
      pear pineapple apple
                     ^^^^^ 0
      kiwi orange kiwi
    `);
  });

  test("2 > search-next-add", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      foo
      ^^^ 0
      foo
      foo
      foo
      foo
      foo
    `);

    // Perform all operations.
    await executeCommand("dance.search.selection.smart");
    await executeCommand("dance.search.next.add");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-next.md:174:1", 6, String.raw`
      foo
      foo
      ^^^ 1
      foo
      ^^^ 0
      foo
      foo
      foo
      foo
    `);
  });

  test("2 > search-next-add > search-next", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      foo
      ^^^ 1
      foo
      ^^^ 0
      foo
      foo
      foo
      foo
    `);

    // Perform all operations.
    await executeCommand("dance.search.next");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-next.md:192:1", 6, String.raw`
      foo
      foo
      ^^^ 1
      foo
      foo
      ^^^ 0
      foo
      foo
      foo
    `);
  });

  test("2 > search-next-add > search-next > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      foo
      ^^^ 1
      foo
      foo
      ^^^ 0
      foo
      foo
      foo
    `);

    // Perform all operations.
    await executeCommand("dance.search.next");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/search-next.md:209:1", 6, String.raw`
      foo
      foo
      ^^^ 1
      foo
      foo
      foo
      ^^^ 0
      foo
      foo
    `);
  });

  groupTestsByParentName(this);
});
