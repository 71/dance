import * as vscode from "vscode";

import { addDepthToCommandTests, ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("./test/suite/commands/seek-enclosing.md", function () {
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

  // Each test sets up using its previous document, and notifies its
  // dependents that it is done by writing its document to `documents`.
  // This ensures that tests are executed in the right order, and that we skip
  // tests whose dependencies failed.
  const notifyDependents: Record<string, (document: ExpectedDocument | undefined) => void> = {},
        documents: Record<string, Promise<ExpectedDocument | undefined>> = {
          "1": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
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
          `)),
          "2": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            { hello: 1,
            ^ 0
              world: {
                foo: [
                  [ 1, 2, 3, ],
                ],
                bar: (42),
              },
            }
          `)),

          "1-enclosing": new Promise((resolve) => notifyDependents["1-enclosing"] = resolve),
          "1-enclosing-x": new Promise((resolve) => notifyDependents["1-enclosing-x"] = resolve),
          "2-enclosing": new Promise((resolve) => notifyDependents["2-enclosing"] = resolve),
        };

  test("1 > enclosing", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-enclosing"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.enclosing");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-enclosing.md:16:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-enclosing"](afterDocument);
    } catch (e) {
      notifyDependents["1-enclosing"](undefined);

      throw e;
    }
  });

  test("1 > enclosing > x", async function () {
    const beforeDocument = await documents["1-enclosing"];

    if (beforeDocument === undefined) {
      notifyDependents["1-enclosing-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.enclosing");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-enclosing.md:39:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-enclosing-x"](afterDocument);
    } catch (e) {
      notifyDependents["1-enclosing-x"](undefined);

      throw e;
    }
  });

  test("2 > enclosing", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-enclosing"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.enclosing");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-enclosing.md:75:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-enclosing"](afterDocument);
    } catch (e) {
      notifyDependents["2-enclosing"](undefined);

      throw e;
    }
  });

  addDepthToCommandTests(this);
});
