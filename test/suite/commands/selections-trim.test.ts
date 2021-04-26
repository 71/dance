import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("selections-trim.md", function () {
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
          "initial": Promise.resolve(ExpectedDocument.parseIndented(12, `\

            ^ 0
            there are two blank lines before me
                     ^ 0                       | 1
               some whitespaces around me    
                                            ^ 1
            and some more words
            ^^^^^^^^^^^^^ 2
            finally a selection    
                                ^^^ 3
                that contains only whitespace
            ^^^| 3
          `)),

          "trim": new Promise((resolve) => notifyDependents["trim"] = resolve),
        };

  test("transition initial > trim", async function () {
    const beforeDocument = await documents["initial"];

    if (beforeDocument === undefined) {
      notifyDependents["trim"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\

      there are two blank lines before me
      ^^^^^^^^^ 0
         some whitespaces around me    
         |^^^^^^^^^^^^^^^^^^^^^^^^^ 1
      and some more words
      ^^^^^^^^^^^^^ 2
      finally a selection    
          that contains only whitespace
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.selections.trimWhitespace");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["trim"](afterDocument);
    } catch (e) {
      notifyDependents["trim"](undefined);

      throw e;
    }
  });
});
