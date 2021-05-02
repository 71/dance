import * as vscode from "vscode";

import { ExpectedDocument, groupTestsByParentName } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("./test/suite/commands/seek-word-edge.md", function () {
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

  test("1 > word-start-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      |{0}th{0}e quick brown fox
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:7:1", 6, String.raw`
      |{0}th{0}e quick brown fox
    `);
  });

  test("1 > word-start-4", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      |{0}th{0}e quick brown fox
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word", { count: 4 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:18:1", 6, String.raw`
      the quick brown {0}fox|{0}
    `);
  });

  test("1 > word-start-4 > word-start", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown {0}fox|{0}
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:27:1", 6, String.raw`
      the quick brown {0}fox|{0}
    `);
  });

  test("1 > word-start-4 > word-start > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown {0}fox|{0}
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:38:1", 6, String.raw`
      the quick brown {0}fox|{0}
    `);
  });

  test("1 > word-start-4 > word-start-backward-4", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown {0}fox|{0}
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward", { count: 4 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:49:1", 6, String.raw`
      |{0}the {0}quick brown fox
    `);
  });

  test("1 > word-start-4 > word-start-backward-5", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      the quick brown {0}fox|{0}
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward", { count: 5 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:58:1", 6, String.raw`
      |{0}the {0}quick brown fox
    `);
  });

  test("1 > word-start-5", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      |{0}th{0}e quick brown fox
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word", { count: 5 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:69:1", 6, String.raw`
      the quick brown {0}fox|{0}
    `);
  });

  test("2 > word-start-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      foo bar{0}
      |{0}baz
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:87:1", 6, String.raw`
      foo |{0}bar{0}
      baz
    `);
  });

  test("3 > word-start-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      |{0}the {0}qu|{1}ic{1}k brown fox
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:103:1", 6, String.raw`
      the |{0}qui{0}ck brown fox
    `);
  });

  test("3 > word-start-backward-9", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      |{0}the {0}qu|{1}ic{1}k brown fox
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward", { count: 9 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:114:1", 6, String.raw`
      |{0}|{1}the {0}{1}quick brown fox
    `);
  });

  test("3 > word-end-4", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      |{0}the {0}qu|{1}ic{1}k brown fox
    `);

    // Perform all operations.
    await executeCommand("dance.seek.wordEnd", { count: 4 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:126:1", 6, String.raw`
      the quick brown{0} fox|{0}
    `);
  });

  test("3 > word-end-5", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      |{0}the {0}qu|{1}ic{1}k brown fox
    `);

    // Perform all operations.
    await executeCommand("dance.seek.wordEnd", { count: 5 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:137:1", 6, String.raw`
      the quick brown{0}{1} fox|{0}|{1}
    `);
  });

  test("4 > word-start-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`

      |{0}there{0} is a blank line before me
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:156:1", 6, String.raw`
      {0}
      t|{0}here is a blank line before me
    `);
  });

  test("4 > word-start-backward > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      {0}
      t|{0}here is a blank line before me
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:169:1", 6, String.raw`
      {0}
      t|{0}here is a blank line before me
    `);
  });

  test("4 > word-start-backward-4", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`

      |{0}there{0} is a blank line before me
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward", { count: 9 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:181:1", 6, String.raw`
      {0}
      t|{0}here is a blank line before me
    `);
  });

  test("5 > word-start-backward", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`


      |{0}there{0} are two blank lines before me
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:201:1", 6, String.raw`
      {0}

      |{0}there are two blank lines before me
    `);
  });

  test("5 > word-start-backward > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      {0}

      |{0}there are two blank lines before me
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:215:1", 6, String.raw`
      {0}

      |{0}there are two blank lines before me
    `);
  });

  test("5 > word-start-backward-9", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`


      |{0}there{0} are two blank lines before me
    `);

    // Perform all operations.
    await executeCommand("dance.seek.word.backward", { count: 9 });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-word-edge.md:228:1", 6, String.raw`
      {0}

      |{0}there are two blank lines before me
    `);
  });

  groupTestsByParentName(this);
});
