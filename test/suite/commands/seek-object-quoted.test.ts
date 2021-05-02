import * as vscode from "vscode";

import { addDepthToCommandTests, ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("./test/suite/commands/seek-object-quoted.md", function () {
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
            hello world "inside a quote, there can be escaped \" characters! also\"\\\"\\""
                            ^ 0
          `)),

          "1-select": new Promise((resolve) => notifyDependents["1-select"] = resolve),
          "1-select-inner": new Promise((resolve) => notifyDependents["1-select-inner"] = resolve),
        };

  test("1 > select", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      hello world "inside a quote, there can be escaped \" characters! also\"\\\"\\""
                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#noescape)\"(?#inner)(?#noescape)\"" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-quoted.md:13:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-select"](afterDocument);
    } catch (e) {
      notifyDependents["1-select"](undefined);

      throw e;
    }
  });

  test("1 > select-inner", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select-inner"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      hello world "inside a quote, there can be escaped \" characters! also\"\\\"\\""
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#noescape)\"(?#inner)(?#noescape)\"", inner: true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-quoted.md:23:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-select-inner"](afterDocument);
    } catch (e) {
      notifyDependents["1-select-inner"](undefined);

      throw e;
    }
  });

  addDepthToCommandTests(this);
});
