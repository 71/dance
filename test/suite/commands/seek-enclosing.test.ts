import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/seek-enclosing.md", function () {
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

  test("1 > enclosing", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      { hello: 1,
        world: {
          foo: [
            [ 1, 2, 3, ],
              ^ 0
          ],
          bar: (42),
                ^^ 1
        },
      }
    `);

    // Perform all operations.
    await executeCommand("dance.seek.enclosing");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-enclosing.md:16:1", 6, String.raw`
      { hello: 1,
        world: {
          foo: [
            [ 1, 2, 3, ],
            |^^^^^^^^^^^ 0
          ],
          bar: (42),
               |^^^ 1
        },
      }
    `);
  });

  test("1 > enclosing > x", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      { hello: 1,
        world: {
          foo: [
            [ 1, 2, 3, ],
            |^^^^^^^^^^^ 0
          ],
          bar: (42),
               |^^^ 1
        },
      }
    `);

    // Perform all operations.
    await executeCommand("dance.seek.enclosing");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-enclosing.md:39:1", 6, String.raw`
      { hello: 1,
        world: {
          foo: [
            [ 1, 2, 3, ],
            ^^^^^^^^^^^^ 0
          ],
          bar: (42),
               ^^^^ 1
        },
      }
    `);
  });

  test("2 > enclosing", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      { hello: 1,
      ^ 0
        world: {
          foo: [
            [ 1, 2, 3, ],
          ],
          bar: (42),
        },
      }
    `);

    // Perform all operations.
    await executeCommand("dance.seek.enclosing");

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-enclosing.md:75:1", 6, String.raw`
      { hello: 1,
      ^ 0
        world: {
          foo: [
            [ 1, 2, 3, ],
          ],
          bar: (42),
        },
      }
      ^ 0
    `);
  });

  groupTestsByParentName(this);
});
