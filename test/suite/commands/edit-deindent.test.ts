import * as vscode from "vscode";

import { addDepthToCommandTests, ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("./test/suite/commands/edit-deindent.md", function () {
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
            foo
            |^^ 0
             bar
              baz
               quux
                 ^ 0
          `)),

          "1-deindent": new Promise((resolve) => notifyDependents["1-deindent"] = resolve),
          "1-deindent-alt": new Promise((resolve) => notifyDependents["1-deindent-alt"] = resolve),
        };

  test("1 > deindent", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-deindent"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      foo
      |^^ 0
      bar
      baz
       quux
         ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.edit.deindent.withIncomplete");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/edit-deindent.md:12:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-deindent"](afterDocument);
    } catch (e) {
      notifyDependents["1-deindent"](undefined);

      throw e;
    }
  });

  test("1 > deindent-alt", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-deindent-alt"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      foo
      |^^ 0
       bar
      baz
       quux
         ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.edit.deindent");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/edit-deindent.md:26:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-deindent-alt"](afterDocument);
    } catch (e) {
      notifyDependents["1-deindent-alt"](undefined);

      throw e;
    }
  });

  addDepthToCommandTests(this);
});
