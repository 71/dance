import * as vscode from "vscode";

import { ExpectedDocument, groupTestsByParentName } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("./test/suite/commands/seek-object-paragraph.md", function () {
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

  test("1 > to-start", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      | 0
         ^ 1
      bar
         ^ 2

      ^ 3
      baz
      ^ 4


      ^ 5


      qux
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=paragraph)", where: "start" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-paragraph.md:23:1", 6, String.raw`
      foo
      ^^^^ 0
      bar
      ^^^^ 0

      ^ 0
      baz
      |^^^ 1

      ^ 1

      ^ 1


      qux
    `);
  });

  test("1 > to-end", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      | 0
         ^ 1
      bar
         ^ 2

      ^ 3
      baz
      ^ 4


      ^ 5


      qux
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=paragraph)", where: "end" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-paragraph.md:50:1", 6, String.raw`
      foo
      ^^^^ 0
      bar
      ^^^^ 0

      ^ 0
      baz
      ^^^^ 1

      ^ 1

      ^ 1

      ^ 1

      ^ 1
      qux
    `);
  });

  test("1 > to-end-inner", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      | 0
         ^ 1
      bar
         ^ 2

      ^ 3
      baz
      ^ 4


      ^ 5


      qux
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=paragraph)", where: "end", inner: true });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-paragraph.md:78:1", 6, String.raw`
      foo
      ^^^^ 0
      bar
      ^^^^ 0

      baz
      ^^^^ 1


      ^ 2


      qux
    `);
  });

  test("1 > select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo
      | 0
         ^ 1
      bar
         ^ 2

      ^ 3
      baz
      ^ 4


      ^ 5


      qux
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=paragraph)" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-paragraph.md:102:1", 6, String.raw`
      foo
      ^^^^ 0
      bar
      ^^^^ 0

      ^ 0
      baz
      ^^^^ 1

      ^ 1

      ^ 1

      ^ 1

      ^ 1
      qux
    `);
  });

  test("2 > select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      paragraph 1
      ^^^^^^^^^^^^ 0

      ^ 1

      ^ 2

      ^ 3

      ^ 4
      paragraph 2
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=paragraph)", inner: true });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-paragraph.md:149:1", 6, String.raw`
      paragraph 1
      ^^^^^^^^^^^^ 0




      paragraph 2
      ^^^^^^^^^^^ 1
    `);
  });

  test("2 > to-end-inner", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      paragraph 1
      ^^^^^^^^^^^^ 0

      ^ 1

      ^ 2

      ^ 3

      ^ 4
      paragraph 2
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=paragraph)", where: "end", inner: true });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-paragraph.md:169:1", 6, String.raw`
      paragraph 1
                 ^ 0


      ^ 1

      ^ 2

      ^ 3
      paragraph 2
      ^^^^^^^^^^^ 3
    `);
  });

  groupTestsByParentName(this);
});
