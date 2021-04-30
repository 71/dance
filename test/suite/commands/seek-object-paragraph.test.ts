import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("seek-object-paragraph.md", function () {
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
          "1": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            {0}f|{0}oo{1}
            |{1}bar{2}
            |{2}{3}
            |{3}{4}b|{4}az

            {5}
            |{5}

            qux
          `)),
          "2": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            paragraph 1{0}
            |{0}{1}
            |{1}{2}
            |{2}{3}
            |{3}{4}
            |{4}paragraph 2
          `)),

          "1-to-start": new Promise((resolve) => notifyDependents["1-to-start"] = resolve),
          "1-to-end": new Promise((resolve) => notifyDependents["1-to-end"] = resolve),
          "1-to-end-inner": new Promise((resolve) => notifyDependents["1-to-end-inner"] = resolve),
          "1-select": new Promise((resolve) => notifyDependents["1-select"] = resolve),
          "2-select": new Promise((resolve) => notifyDependents["2-select"] = resolve),
          "2-to-end-inner": new Promise((resolve) => notifyDependents["2-to-end-inner"] = resolve),
        };

  test("transition 1 > 1-to-start    ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      {0}|{1}|{2}|{3}|{4}f|{0}oo
      {1}bar
      {2}
      {3}{4}|{5}baz

      {5}


      qux
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "paragraph", "action": "selectToStart" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-start"](undefined);

      throw e;
    }
  });

  test("transition 1 > 1-to-end      ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      {0}foo{1}
      bar{2}

      |{0}|{1}|{2}{3}{4}baz


      {5}

      |{3}|{4}|{5}qux
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "paragraph", "action": "selectToEnd" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-end"](undefined);

      throw e;
    }
  });

  test("transition 1 > 1-to-end-inner", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-end-inner"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      {0}foo{1}
      bar{2}
      |{0}|{1}|{2}
      {3}{4}baz
      |{3}|{4}

      {5}
      |{5}
      qux
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "paragraph", "action": "selectToEnd", "inner": true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-end-inner"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-end-inner"](undefined);

      throw e;
    }
  });

  test("transition 1 > 1-select      ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      {0}{1}{2}foo
      bar

      |{0}|{1}|{2}{3}{4}{5}baz




      |{3}|{4}|{5}qux
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "paragraph", "action": "select" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-select"](afterDocument);
    } catch (e) {
      notifyDependents["1-select"](undefined);

      throw e;
    }
  });

  test("transition 2 > 2-select      ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      {0}{1}{2}{3}paragraph 1
      |{0}|{1}|{2}|{3}|{3}



      {4}paragraph 2|{4}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "paragraph", "action": "select", "inner": true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["2-select"](afterDocument);
    } catch (e) {
      notifyDependents["2-select"](undefined);

      throw e;
    }
  });

  test("transition 2 > 2-to-end-inner", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-to-end-inner"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      paragraph 1{0}
      |{0}
      {1}
      |{1}{2}
      |{2}{3}
      {4}paragraph 2|{4}|{3}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "paragraph", "action": "selectToEnd", "inner": true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["2-to-end-inner"](afterDocument);
    } catch (e) {
      notifyDependents["2-to-end-inner"](undefined);

      throw e;
    }
  });
});
