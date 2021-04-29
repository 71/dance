import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("seek-enclosing.md", function () {
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
          "initial-1": Promise.resolve(ExpectedDocument.parseIndented(12, `\
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
          "initial-2": Promise.resolve(ExpectedDocument.parseIndented(12, `\
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

          "enclosing-1a": new Promise((resolve) => notifyDependents["enclosing-1a"] = resolve),
          "enclosing-1b": new Promise((resolve) => notifyDependents["enclosing-1b"] = resolve),
          "enclosing-2": new Promise((resolve) => notifyDependents["enclosing-2"] = resolve),
        };

  test("transition initial-1    > enclosing-1a", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["enclosing-1a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
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
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["enclosing-1a"](afterDocument);
    } catch (e) {
      notifyDependents["enclosing-1a"](undefined);

      throw e;
    }
  });

  test("transition enclosing-1a > enclosing-1b", async function () {
    const beforeDocument = await documents["enclosing-1a"];

    if (beforeDocument === undefined) {
      notifyDependents["enclosing-1b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
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
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["enclosing-1b"](afterDocument);
    } catch (e) {
      notifyDependents["enclosing-1b"](undefined);

      throw e;
    }
  });

  test("transition initial-2    > enclosing-2 ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["enclosing-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
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
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["enclosing-2"](afterDocument);
    } catch (e) {
      notifyDependents["enclosing-2"](undefined);

      throw e;
    }
  });
});
