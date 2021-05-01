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
          "1": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            abcabc
            | 0
          `)),
          "2": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            abcdefghijk
               ^^^^ 0
          `)),

          "1-select-to-included": new Promise((resolve) => notifyDependents["1-select-to-included"] = resolve),
          "1-select-to-included-select-to": new Promise((resolve) => notifyDependents["1-select-to-included-select-to"] = resolve),
          "1-select-to-included-select-to-character": new Promise((resolve) => notifyDependents["1-select-to-included-select-to-character"] = resolve),
          "1-select-to-c-2": new Promise((resolve) => notifyDependents["1-select-to-c-2"] = resolve),
          "1-select-to-c-2-select-to-c": new Promise((resolve) => notifyDependents["1-select-to-c-2-select-to-c"] = resolve),
          "1-select-to-c-2-select-to-c-select-to-b-backward": new Promise((resolve) => notifyDependents["1-select-to-c-2-select-to-c-select-to-b-backward"] = resolve),
          "1-select-to-c-2-select-to-c-select-to-b-backward-select-to-a-backward": new Promise((resolve) => notifyDependents["1-select-to-c-2-select-to-c-select-to-b-backward-select-to-a-backward"] = resolve),
          "1-select-to-c-2-select-to-c-character": new Promise((resolve) => notifyDependents["1-select-to-c-2-select-to-c-character"] = resolve),
          "1-select-to-c-2-select-to-c-character-select-to-b-character": new Promise((resolve) => notifyDependents["1-select-to-c-2-select-to-c-character-select-to-b-character"] = resolve),
          "2-extend-to-e-included-backward": new Promise((resolve) => notifyDependents["2-extend-to-e-included-backward"] = resolve),
          "2-extend-to-g-included-backward": new Promise((resolve) => notifyDependents["2-extend-to-g-included-backward"] = resolve),
          "2-extend-to-d-included-backward": new Promise((resolve) => notifyDependents["2-extend-to-d-included-backward"] = resolve),
          "2-extend-to-b-included-backward": new Promise((resolve) => notifyDependents["2-extend-to-b-included-backward"] = resolve),
          "2-extend-to-b-backward-character": new Promise((resolve) => notifyDependents["2-extend-to-b-backward-character"] = resolve),
          "2-extend-to-g-backward": new Promise((resolve) => notifyDependents["2-extend-to-g-backward"] = resolve),
          "2-extend-to-f-backward": new Promise((resolve) => notifyDependents["2-extend-to-f-backward"] = resolve),
          "2-extend-to-e-backward": new Promise((resolve) => notifyDependents["2-extend-to-e-backward"] = resolve),
          "2-extend-to-c-backward": new Promise((resolve) => notifyDependents["2-extend-to-c-backward"] = resolve),
          "2-extend-to-b-backward": new Promise((resolve) => notifyDependents["2-extend-to-b-backward"] = resolve),
        };

  test("transition 1                                                > 1-select-to-included                                                 ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select-to-included"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["1-select-to-included"](afterDocument);
    } catch (e) {
      notifyDependents["1-select-to-included"](undefined);

      throw e;
    }
  });

  test("transition 1-select-to-included                             > 1-select-to-included-select-to                                       ", async function () {
    const beforeDocument = await documents["1-select-to-included"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select-to-included-select-to"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["1-select-to-included-select-to"](afterDocument);
    } catch (e) {
      notifyDependents["1-select-to-included-select-to"](undefined);

      throw e;
    }
  });

  test("transition 1-select-to-included                             > 1-select-to-included-select-to-character                             ", async function () {
    const beforeDocument = await documents["1-select-to-included"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select-to-included-select-to-character"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["1-select-to-included-select-to-character"](afterDocument);
    } catch (e) {
      notifyDependents["1-select-to-included-select-to-character"](undefined);

      throw e;
    }
  });

  test("transition 1                                                > 1-select-to-c-2                                                      ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select-to-c-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["1-select-to-c-2"](afterDocument);
    } catch (e) {
      notifyDependents["1-select-to-c-2"](undefined);

      throw e;
    }
  });

  test("transition 1-select-to-c-2                                  > 1-select-to-c-2-select-to-c                                          ", async function () {
    const beforeDocument = await documents["1-select-to-c-2"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select-to-c-2-select-to-c"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["1-select-to-c-2-select-to-c"](afterDocument);
    } catch (e) {
      notifyDependents["1-select-to-c-2-select-to-c"](undefined);

      throw e;
    }
  });

  test("transition 1-select-to-c-2-select-to-c                      > 1-select-to-c-2-select-to-c-select-to-b-backward                     ", async function () {
    const beforeDocument = await documents["1-select-to-c-2-select-to-c"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select-to-c-2-select-to-c-select-to-b-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["1-select-to-c-2-select-to-c-select-to-b-backward"](afterDocument);
    } catch (e) {
      notifyDependents["1-select-to-c-2-select-to-c-select-to-b-backward"](undefined);

      throw e;
    }
  });

  test("transition 1-select-to-c-2-select-to-c-select-to-b-backward > 1-select-to-c-2-select-to-c-select-to-b-backward-select-to-a-backward", async function () {
    const beforeDocument = await documents["1-select-to-c-2-select-to-c-select-to-b-backward"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select-to-c-2-select-to-c-select-to-b-backward-select-to-a-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["1-select-to-c-2-select-to-c-select-to-b-backward-select-to-a-backward"](afterDocument);
    } catch (e) {
      notifyDependents["1-select-to-c-2-select-to-c-select-to-b-backward-select-to-a-backward"](undefined);

      throw e;
    }
  });

  test("transition 1-select-to-c-2                                  > 1-select-to-c-2-select-to-c-character                                ", async function () {
    const beforeDocument = await documents["1-select-to-c-2"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select-to-c-2-select-to-c-character"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["1-select-to-c-2-select-to-c-character"](afterDocument);
    } catch (e) {
      notifyDependents["1-select-to-c-2-select-to-c-character"](undefined);

      throw e;
    }
  });

  test("transition 1-select-to-c-2-select-to-c-character            > 1-select-to-c-2-select-to-c-character-select-to-b-character          ", async function () {
    const beforeDocument = await documents["1-select-to-c-2-select-to-c-character"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select-to-c-2-select-to-c-character-select-to-b-character"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["1-select-to-c-2-select-to-c-character-select-to-b-character"](afterDocument);
    } catch (e) {
      notifyDependents["1-select-to-c-2-select-to-c-character-select-to-b-character"](undefined);

      throw e;
    }
  });

  test("transition 2                                                > 2-extend-to-e-included-backward                                      ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-extend-to-e-included-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["2-extend-to-e-included-backward"](afterDocument);
    } catch (e) {
      notifyDependents["2-extend-to-e-included-backward"](undefined);

      throw e;
    }
  });

  test("transition 2                                                > 2-extend-to-g-included-backward                                      ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-extend-to-g-included-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["2-extend-to-g-included-backward"](afterDocument);
    } catch (e) {
      notifyDependents["2-extend-to-g-included-backward"](undefined);

      throw e;
    }
  });

  test("transition 2                                                > 2-extend-to-d-included-backward                                      ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-extend-to-d-included-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["2-extend-to-d-included-backward"](afterDocument);
    } catch (e) {
      notifyDependents["2-extend-to-d-included-backward"](undefined);

      throw e;
    }
  });

  test("transition 2                                                > 2-extend-to-b-included-backward                                      ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-extend-to-b-included-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["2-extend-to-b-included-backward"](afterDocument);
    } catch (e) {
      notifyDependents["2-extend-to-b-included-backward"](undefined);

      throw e;
    }
  });

  test("transition 2                                                > 2-extend-to-b-backward-character                                     ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-extend-to-b-backward-character"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["2-extend-to-b-backward-character"](afterDocument);
    } catch (e) {
      notifyDependents["2-extend-to-b-backward-character"](undefined);

      throw e;
    }
  });

  test("transition 2                                                > 2-extend-to-g-backward                                               ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-extend-to-g-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["2-extend-to-g-backward"](afterDocument);
    } catch (e) {
      notifyDependents["2-extend-to-g-backward"](undefined);

      throw e;
    }
  });

  test("transition 2                                                > 2-extend-to-f-backward                                               ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-extend-to-f-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["2-extend-to-f-backward"](afterDocument);
    } catch (e) {
      notifyDependents["2-extend-to-f-backward"](undefined);

      throw e;
    }
  });

  test("transition 2                                                > 2-extend-to-e-backward                                               ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-extend-to-e-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["2-extend-to-e-backward"](afterDocument);
    } catch (e) {
      notifyDependents["2-extend-to-e-backward"](undefined);

      throw e;
    }
  });

  test("transition 2                                                > 2-extend-to-c-backward                                               ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-extend-to-c-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["2-extend-to-c-backward"](afterDocument);
    } catch (e) {
      notifyDependents["2-extend-to-c-backward"](undefined);

      throw e;
    }
  });

  test("transition 2                                                > 2-extend-to-b-backward                                               ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-extend-to-b-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      notifyDependents["2-extend-to-b-backward"](afterDocument);
    } catch (e) {
      notifyDependents["2-extend-to-b-backward"](undefined);

      throw e;
    }
  });
});
