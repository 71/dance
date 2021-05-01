import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("seek-object-between.md", function () {
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
            if (ok) {
               ^ 0
              foo = a+(b+(c+(d)+e)+f)+g;
               |^^^ 1   ^^ 2
            } else {
              for (var i = (foo + bar); i < 1000; i++) {
              ^^^^^^^^^^^^^^^^^^^^^^^^ 3
                getAction(i)();
                           ^ 4
              }
            }
          `)),

          "1-to-end": new Promise((resolve) => notifyDependents["1-to-end"] = resolve),
          "1-to-end-extend": new Promise((resolve) => notifyDependents["1-to-end-extend"] = resolve),
          "1-to-end-inner": new Promise((resolve) => notifyDependents["1-to-end-inner"] = resolve),
          "1-to-end-inner-extend": new Promise((resolve) => notifyDependents["1-to-end-inner-extend"] = resolve),
          "1-to-start": new Promise((resolve) => notifyDependents["1-to-start"] = resolve),
          "1-to-start-extend": new Promise((resolve) => notifyDependents["1-to-start-extend"] = resolve),
          "1-to-start-inner": new Promise((resolve) => notifyDependents["1-to-start-inner"] = resolve),
          "1-to-start-inner-extend": new Promise((resolve) => notifyDependents["1-to-start-inner-extend"] = resolve),
          "1-select": new Promise((resolve) => notifyDependents["1-select"] = resolve),
          "1-select-inner": new Promise((resolve) => notifyDependents["1-select-inner"] = resolve),
        };

  test("transition 1 > 1-to-end               ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      if (ok) {
         ^^^^ 0
        foo = a+(b+(c+(d)+e)+f)+g;
                   ^^^^^^^^^ 1
      } else {
        for (var i = (foo + bar); i < 1000; i++) {
                               ^^^^^^^^^^^^^^^^^ 2
          getAction(i)();
        }
      }
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "end" });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-end"](undefined);

      throw e;
    }
  });

  test("transition 1 > 1-to-end-extend        ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-end-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      if (ok) {
         ^^^^ 0
        foo = a+(b+(c+(d)+e)+f)+g;
                  ^^^^^^^^^^ 1
      } else {
        for (var i = (foo + bar); i < 1000; i++) {
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 2
          getAction(i)();
        }
      }
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "end", shift: "extend" });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-end-extend"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-end-extend"](undefined);

      throw e;
    }
  });

  test("transition 1 > 1-to-end-inner         ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-end-inner"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      if (ok) {
         ^^^ 0
        foo = a+(b+(c+(d)+e)+f)+g;
                   ^^^^^^^^ 1
      } else {
        for (var i = (foo + bar); i < 1000; i++) {
                               ^^^^^^^^^^^^^^^^ 2
          getAction(i)();
        }
      }
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "end", inner: true });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-end-inner"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-end-inner"](undefined);

      throw e;
    }
  });

  test("transition 1 > 1-to-end-inner-extend  ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-end-inner-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      if (ok) {
         ^^^ 0
        foo = a+(b+(c+(d)+e)+f)+g;
                  ^^^^^^^^^ 1
      } else {
        for (var i = (foo + bar); i < 1000; i++) {
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 2
          getAction(i)();
        }
      }
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "end", inner: true, shift: "extend" });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-end-inner-extend"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-end-inner-extend"](undefined);

      throw e;
    }
  });

  test("transition 1 > 1-to-start             ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      if (ok) {
        foo = a+(b+(c+(d)+e)+f)+g;
                |^^^ 0
      } else {
        for (var i = (foo + bar); i < 1000; i++) {
                     |^^^^^^^^^^ 1
          getAction(i)();
                   |^^ 2
        }
      }
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "start" });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-start"](undefined);

      throw e;
    }
  });

  test("transition 1 > 1-to-start-extend      ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-start-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      if (ok) {
        foo = a+(b+(c+(d)+e)+f)+g;
                |^^ 0
      } else {
        for (var i = (foo + bar); i < 1000; i++) {
        ^^^^^^^^^^^^^ 1
          getAction(i)();
                   |^^ 2
        }
      }
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "start", shift: "extend" });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-start-extend"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-start-extend"](undefined);

      throw e;
    }
  });

  test("transition 1 > 1-to-start-inner       ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-start-inner"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      if (ok) {
        foo = a+(b+(c+(d)+e)+f)+g;
                 |^^ 0
      } else {
        for (var i = (foo + bar); i < 1000; i++) {
                      |^^^^^^^^^ 1
          getAction(i)();
                    |^ 2
        }
      }
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "start", inner: true });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-start-inner"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-start-inner"](undefined);

      throw e;
    }
  });

  test("transition 1 > 1-to-start-inner-extend", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-start-inner-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      if (ok) {
        foo = a+(b+(c+(d)+e)+f)+g;
                 |^ 0
      } else {
        for (var i = (foo + bar); i < 1000; i++) {
        ^^^^^^^^^^^^^^ 1
          getAction(i)();
                    |^ 2
        }
      }
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "start", inner: true, shift: "extend" });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-start-inner-extend"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-start-inner-extend"](undefined);

      throw e;
    }
  });

  test("transition 1 > 1-select               ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      if (ok) {
         ^^^^ 0
        foo = a+(b+(c+(d)+e)+f)+g;
                   ^^^^^^^^^ 1
      } else {
        for (var i = (foo + bar); i < 1000; i++) {
                     ^^^^^^^^^^^ 2
          getAction(i)();
                   ^^^ 3
        }
      }
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)" });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-select"](afterDocument);
    } catch (e) {
      notifyDependents["1-select"](undefined);

      throw e;
    }
  });

  test("transition 1 > 1-select-inner         ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select-inner"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      if (ok) {
          ^^ 0
        foo = a+(b+(c+(d)+e)+f)+g;
                    ^^^^^^^ 1
      } else {
        for (var i = (foo + bar); i < 1000; i++) {
                      ^^^^^^^^^ 2
          getAction(i)();
                    ^ 3
        }
      }
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", inner: true });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-select-inner"](afterDocument);
    } catch (e) {
      notifyDependents["1-select-inner"](undefined);

      throw e;
    }
  });
});
