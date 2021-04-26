import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("seek.md", function () {
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
            abcabc
            | 0
          `)),
          "initial-2": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            abcdefghijk
               ^^^^ 0
          `)),

          "select-to-1a": new Promise((resolve) => notifyDependents["select-to-1a"] = resolve),
          "select-to-1b": new Promise((resolve) => notifyDependents["select-to-1b"] = resolve),
          "select-to-1b-character": new Promise((resolve) => notifyDependents["select-to-1b-character"] = resolve),
          "select-to-1c": new Promise((resolve) => notifyDependents["select-to-1c"] = resolve),
          "select-to-1d": new Promise((resolve) => notifyDependents["select-to-1d"] = resolve),
          "select-to-1d-character": new Promise((resolve) => notifyDependents["select-to-1d-character"] = resolve),
          "select-to-backward-1a": new Promise((resolve) => notifyDependents["select-to-backward-1a"] = resolve),
          "select-to-backward-1a-character": new Promise((resolve) => notifyDependents["select-to-backward-1a-character"] = resolve),
          "select-to-backward-1b": new Promise((resolve) => notifyDependents["select-to-backward-1b"] = resolve),
          "extend-backward-2a": new Promise((resolve) => notifyDependents["extend-backward-2a"] = resolve),
          "extend-backward-2b": new Promise((resolve) => notifyDependents["extend-backward-2b"] = resolve),
          "extend-backward-2c": new Promise((resolve) => notifyDependents["extend-backward-2c"] = resolve),
          "extend-backward-2d": new Promise((resolve) => notifyDependents["extend-backward-2d"] = resolve),
          "extend-backward-2d-character": new Promise((resolve) => notifyDependents["extend-backward-2d-character"] = resolve),
          "extend-backward-2e": new Promise((resolve) => notifyDependents["extend-backward-2e"] = resolve),
          "extend-backward-2f": new Promise((resolve) => notifyDependents["extend-backward-2f"] = resolve),
          "extend-backward-2g": new Promise((resolve) => notifyDependents["extend-backward-2g"] = resolve),
          "extend-backward-2h": new Promise((resolve) => notifyDependents["extend-backward-2h"] = resolve),
          "extend-backward-2i": new Promise((resolve) => notifyDependents["extend-backward-2i"] = resolve),
        };

  test("transition initial-1              > select-to-1a                   ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["select-to-1a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcabc
      ^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek", { input: "c", include: true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["select-to-1a"](afterDocument);
    } catch (e) {
      notifyDependents["select-to-1a"](undefined);

      throw e;
    }
  });

  test("transition select-to-1a           > select-to-1b                   ", async function () {
    const beforeDocument = await documents["select-to-1a"];

    if (beforeDocument === undefined) {
      notifyDependents["select-to-1b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcabc
         ^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek", { input: "c" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["select-to-1b"](afterDocument);
    } catch (e) {
      notifyDependents["select-to-1b"](undefined);

      throw e;
    }
  });

  test("transition select-to-1a           > select-to-1b-character         ", async function () {
    const beforeDocument = await documents["select-to-1a"];

    if (beforeDocument === undefined) {
      notifyDependents["select-to-1b-character"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcabc
        ^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek", { input: "c" });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["select-to-1b-character"](afterDocument);
    } catch (e) {
      notifyDependents["select-to-1b-character"](undefined);

      throw e;
    }
  });

  test("transition initial-1              > select-to-1c                   ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["select-to-1c"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcabc
      ^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek", { input: "c", count: 2 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["select-to-1c"](afterDocument);
    } catch (e) {
      notifyDependents["select-to-1c"](undefined);

      throw e;
    }
  });

  test("transition select-to-1c           > select-to-1d                   ", async function () {
    const beforeDocument = await documents["select-to-1c"];

    if (beforeDocument === undefined) {
      notifyDependents["select-to-1d"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcabc
      ^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek", { input: "c" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["select-to-1d"](afterDocument);
    } catch (e) {
      notifyDependents["select-to-1d"](undefined);

      throw e;
    }
  });

  test("transition select-to-1c           > select-to-1d-character         ", async function () {
    const beforeDocument = await documents["select-to-1c"];

    if (beforeDocument === undefined) {
      notifyDependents["select-to-1d-character"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcabc
      ^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek", { input: "c" });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["select-to-1d-character"](afterDocument);
    } catch (e) {
      notifyDependents["select-to-1d-character"](undefined);

      throw e;
    }
  });

  test("transition select-to-1d           > select-to-backward-1a          ", async function () {
    const beforeDocument = await documents["select-to-1d"];

    if (beforeDocument === undefined) {
      notifyDependents["select-to-backward-1a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcabc
           | 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek", { input: "b", direction: -1 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["select-to-backward-1a"](afterDocument);
    } catch (e) {
      notifyDependents["select-to-backward-1a"](undefined);

      throw e;
    }
  });

  test("transition select-to-1d-character > select-to-backward-1a-character", async function () {
    const beforeDocument = await documents["select-to-1d-character"];

    if (beforeDocument === undefined) {
      notifyDependents["select-to-backward-1a-character"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcabc
        |^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek", { input: "b", direction: -1 });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["select-to-backward-1a-character"](afterDocument);
    } catch (e) {
      notifyDependents["select-to-backward-1a-character"](undefined);

      throw e;
    }
  });

  test("transition select-to-backward-1a  > select-to-backward-1b          ", async function () {
    const beforeDocument = await documents["select-to-backward-1a"];

    if (beforeDocument === undefined) {
      notifyDependents["select-to-backward-1b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcabc
          ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek", { input: "a", direction: -1 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["select-to-backward-1b"](afterDocument);
    } catch (e) {
      notifyDependents["select-to-backward-1b"](undefined);

      throw e;
    }
  });

  test("transition initial-2              > extend-backward-2a             ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["extend-backward-2a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcdefghijk
         ^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek", { input: "e", direction: -1, shift: "extend", include: true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["extend-backward-2a"](afterDocument);
    } catch (e) {
      notifyDependents["extend-backward-2a"](undefined);

      throw e;
    }
  });

  test("transition initial-2              > extend-backward-2b             ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["extend-backward-2b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcdefghijk
         ^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek", { input: "g", direction: -1, shift: "extend", include: true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["extend-backward-2b"](afterDocument);
    } catch (e) {
      notifyDependents["extend-backward-2b"](undefined);

      throw e;
    }
  });

  test("transition initial-2              > extend-backward-2c             ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["extend-backward-2c"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcdefghijk
         ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek", { input: "d", direction: -1, shift: "extend", include: true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["extend-backward-2c"](afterDocument);
    } catch (e) {
      notifyDependents["extend-backward-2c"](undefined);

      throw e;
    }
  });

  test("transition initial-2              > extend-backward-2d             ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["extend-backward-2d"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcdefghijk
       |^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek", { input: "b", direction: -1, shift: "extend", include: true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["extend-backward-2d"](afterDocument);
    } catch (e) {
      notifyDependents["extend-backward-2d"](undefined);

      throw e;
    }
  });

  test("transition initial-2              > extend-backward-2d-character   ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["extend-backward-2d-character"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcdefghijk
       |^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek", { input: "b", direction: -1, shift: "extend", include: true });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["extend-backward-2d-character"](afterDocument);
    } catch (e) {
      notifyDependents["extend-backward-2d-character"](undefined);

      throw e;
    }
  });

  test("transition initial-2              > extend-backward-2e             ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["extend-backward-2e"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcdefghijk
         ^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek", { input: "g", direction: -1, shift: "extend" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["extend-backward-2e"](afterDocument);
    } catch (e) {
      notifyDependents["extend-backward-2e"](undefined);

      throw e;
    }
  });

  test("transition initial-2              > extend-backward-2f             ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["extend-backward-2f"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcdefghijk
         ^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek", { input: "f", direction: -1, shift: "extend" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["extend-backward-2f"](afterDocument);
    } catch (e) {
      notifyDependents["extend-backward-2f"](undefined);

      throw e;
    }
  });

  test("transition initial-2              > extend-backward-2g             ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["extend-backward-2g"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcdefghijk
         ^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek", { input: "e", direction: -1, shift: "extend" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["extend-backward-2g"](afterDocument);
    } catch (e) {
      notifyDependents["extend-backward-2g"](undefined);

      throw e;
    }
  });

  test("transition initial-2              > extend-backward-2h             ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["extend-backward-2h"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcdefghijk
         | 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek", { input: "c", direction: -1, shift: "extend" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["extend-backward-2h"](afterDocument);
    } catch (e) {
      notifyDependents["extend-backward-2h"](undefined);

      throw e;
    }
  });

  test("transition initial-2              > extend-backward-2i             ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["extend-backward-2i"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      abcdefghijk
        ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek", { input: "b", direction: -1, shift: "extend" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["extend-backward-2i"](afterDocument);
    } catch (e) {
      notifyDependents["extend-backward-2i"](undefined);

      throw e;
    }
  });
});
