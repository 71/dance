import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("search.md", function () {
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
          "initial-easy": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            foo bar
              ^ 0
          `)),
          "initial-1": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            The quick brown fox
              ^^^ 0
            jumps over the
            lazy dog quickly.
          `)),
          "initial-2": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            The quick brown fox
                       | 0
            jumps over the
            lazy dog quickly.
              ^ 0
          `)),

          "search-easy": new Promise((resolve) => notifyDependents["search-easy"] = resolve),
          "search-1": new Promise((resolve) => notifyDependents["search-1"] = resolve),
          "search-repeat-1": new Promise((resolve) => notifyDependents["search-repeat-1"] = resolve),
          "search-start-1": new Promise((resolve) => notifyDependents["search-start-1"] = resolve),
          "search-start-wrap-1": new Promise((resolve) => notifyDependents["search-start-wrap-1"] = resolve),
          "search-wrap-1": new Promise((resolve) => notifyDependents["search-wrap-1"] = resolve),
          "search-not-found-1": new Promise((resolve) => notifyDependents["search-not-found-1"] = resolve),
          "search-backward-1": new Promise((resolve) => notifyDependents["search-backward-1"] = resolve),
          "search-backward-start-wrap-1a": new Promise((resolve) => notifyDependents["search-backward-start-wrap-1a"] = resolve),
          "search-backward-start-wrap-1b": new Promise((resolve) => notifyDependents["search-backward-start-wrap-1b"] = resolve),
          "search-backward-not-found-1": new Promise((resolve) => notifyDependents["search-backward-not-found-1"] = resolve),
          "search-extend-1": new Promise((resolve) => notifyDependents["search-extend-1"] = resolve),
          "search-extend-wrap-1": new Promise((resolve) => notifyDependents["search-extend-wrap-1"] = resolve),
          "search-backward-extend-1a": new Promise((resolve) => notifyDependents["search-backward-extend-1a"] = resolve),
          "search-backward-extend-character-1a": new Promise((resolve) => notifyDependents["search-backward-extend-character-1a"] = resolve),
          "search-backward-extend-1b": new Promise((resolve) => notifyDependents["search-backward-extend-1b"] = resolve),
          "search-backward-extend-character-1b": new Promise((resolve) => notifyDependents["search-backward-extend-character-1b"] = resolve),
          "search-backward-extend-wrap-1": new Promise((resolve) => notifyDependents["search-backward-extend-wrap-1"] = resolve),
          "search-2": new Promise((resolve) => notifyDependents["search-2"] = resolve),
          "search-extend-2": new Promise((resolve) => notifyDependents["search-extend-2"] = resolve),
          "search-extend-character-2": new Promise((resolve) => notifyDependents["search-extend-character-2"] = resolve),
          "search-wrap-2": new Promise((resolve) => notifyDependents["search-wrap-2"] = resolve),
          "search-extend-wrap-2": new Promise((resolve) => notifyDependents["search-extend-wrap-2"] = resolve),
          "search-backward-2": new Promise((resolve) => notifyDependents["search-backward-2"] = resolve),
          "search-backward-extend-2": new Promise((resolve) => notifyDependents["search-backward-extend-2"] = resolve),
          "search-backward-wrap-2": new Promise((resolve) => notifyDependents["search-backward-wrap-2"] = resolve),
          "search-backward-extend-wrap-2": new Promise((resolve) => notifyDependents["search-backward-extend-wrap-2"] = resolve),
        };

  test("transition initial-easy > search-easy                        ", async function () {
    const beforeDocument = await documents["initial-easy"];

    if (beforeDocument === undefined) {
      notifyDependents["search-easy"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo bar
          ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "b" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-easy"](afterDocument);
    } catch (e) {
      notifyDependents["search-easy"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-1                           ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
                ^^^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "brown" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-1"](afterDocument);
    } catch (e) {
      notifyDependents["search-1"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-repeat-1                    ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-repeat-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
                       ^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "o", count: 2 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-repeat-1"](afterDocument);
    } catch (e) {
      notifyDependents["search-repeat-1"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-start-1                     ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-start-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
      jumps over the
      lazy dog quickly.
               ^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "quick" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-start-1"](afterDocument);
    } catch (e) {
      notifyDependents["search-start-1"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-start-wrap-1                ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-start-wrap-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
          ^^^^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "quick " });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-start-wrap-1"](afterDocument);
    } catch (e) {
      notifyDependents["search-start-wrap-1"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-wrap-1                      ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-wrap-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
      ^^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "Th" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-wrap-1"](afterDocument);
    } catch (e) {
      notifyDependents["search-wrap-1"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-not-found-1                 ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-not-found-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "pig" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-not-found-1"](afterDocument);
    } catch (e) {
      notifyDependents["search-not-found-1"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-backward-1                  ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-backward-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
      ^^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "Th", direction: -1 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-backward-1"](afterDocument);
    } catch (e) {
      notifyDependents["search-backward-1"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-backward-start-wrap-1a      ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-backward-start-wrap-1a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
      jumps over the
                  ^^ 0
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "he", direction: -1 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-backward-start-wrap-1a"](afterDocument);
    } catch (e) {
      notifyDependents["search-backward-start-wrap-1a"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-backward-start-wrap-1b      ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-backward-start-wrap-1b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
       ^^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "he q", direction: -1 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-backward-start-wrap-1b"](afterDocument);
    } catch (e) {
      notifyDependents["search-backward-start-wrap-1b"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-backward-not-found-1        ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-backward-not-found-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "pig", direction: -1 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-backward-not-found-1"](afterDocument);
    } catch (e) {
      notifyDependents["search-backward-not-found-1"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-extend-1                    ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-extend-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
        ^ 0
      jumps over the
      lazy dog quickly.
                   ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "quick", shift: "extend" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-extend-1"](afterDocument);
    } catch (e) {
      notifyDependents["search-extend-1"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-extend-wrap-1               ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-extend-wrap-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "T", shift: "extend" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-extend-wrap-1"](afterDocument);
    } catch (e) {
      notifyDependents["search-extend-wrap-1"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-backward-extend-1a          ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-backward-extend-1a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
      |^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "T", direction: -1, shift: "extend" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-backward-extend-1a"](afterDocument);
    } catch (e) {
      notifyDependents["search-backward-extend-1a"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-backward-extend-character-1a", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-backward-extend-character-1a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
      |^^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.search", { input: "T", direction: -1, shift: "extend" });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-backward-extend-character-1a"](afterDocument);
    } catch (e) {
      notifyDependents["search-backward-extend-character-1a"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-backward-extend-1b          ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-backward-extend-1b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
      |^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "Th", direction: -1, shift: "extend" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-backward-extend-1b"](afterDocument);
    } catch (e) {
      notifyDependents["search-backward-extend-1b"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-backward-extend-character-1b", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-backward-extend-character-1b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
      |^^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.search", { input: "Th", direction: -1, shift: "extend" });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-backward-extend-character-1b"](afterDocument);
    } catch (e) {
      notifyDependents["search-backward-extend-character-1b"](undefined);

      throw e;
    }
  });

  test("transition initial-1    > search-backward-extend-wrap-1      ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["search-backward-extend-wrap-1"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
        ^^^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "lazy", direction: -1, shift: "extend" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-backward-extend-wrap-1"](afterDocument);
    } catch (e) {
      notifyDependents["search-backward-extend-wrap-1"](undefined);

      throw e;
    }
  });

  test("transition initial-2    > search-2                           ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["search-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
      jumps over the
      lazy dog quickly.
            ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "o" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-2"](afterDocument);
    } catch (e) {
      notifyDependents["search-2"](undefined);

      throw e;
    }
  });

  test("transition initial-2    > search-extend-2                    ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["search-extend-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
      jumps over the
      lazy dog quickly.
         ^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "o", shift: "extend" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-extend-2"](afterDocument);
    } catch (e) {
      notifyDependents["search-extend-2"](undefined);

      throw e;
    }
  });

  test("transition initial-2    > search-extend-character-2          ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["search-extend-character-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
      jumps over the
      lazy dog quickly.
        ^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.search", { input: "o", shift: "extend" });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-extend-character-2"](afterDocument);
    } catch (e) {
      notifyDependents["search-extend-character-2"](undefined);

      throw e;
    }
  });

  test("transition initial-2    > search-wrap-2                      ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["search-wrap-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
       |^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "he" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-wrap-2"](afterDocument);
    } catch (e) {
      notifyDependents["search-wrap-2"](undefined);

      throw e;
    }
  });

  test("transition initial-2    > search-extend-wrap-2               ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["search-extend-wrap-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
                 | 0
      jumps over the
      lazy dog quickly.
        ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "he", shift: "extend" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-extend-wrap-2"](afterDocument);
    } catch (e) {
      notifyDependents["search-extend-wrap-2"](undefined);

      throw e;
    }
  });

  test("transition initial-2    > search-backward-2                  ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["search-backward-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
           ^ 0
      jumps over the
      lazy dog quickly.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "u", direction: -1 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-backward-2"](afterDocument);
    } catch (e) {
      notifyDependents["search-backward-2"](undefined);

      throw e;
    }
  });

  test("transition initial-2    > search-backward-extend-2           ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["search-backward-extend-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
           | 0
      jumps over the
      lazy dog quickly.
        ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "u", direction: -1, shift: "extend" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-backward-extend-2"](afterDocument);
    } catch (e) {
      notifyDependents["search-backward-extend-2"](undefined);

      throw e;
    }
  });

  test("transition initial-2    > search-backward-wrap-2             ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["search-backward-wrap-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
      jumps over the
      lazy dog quickly.
            ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "o", direction: -1 });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-backward-wrap-2"](afterDocument);
    } catch (e) {
      notifyDependents["search-backward-wrap-2"](undefined);

      throw e;
    }
  });

  test("transition initial-2    > search-backward-extend-wrap-2      ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["search-backward-extend-wrap-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      The quick brown fox
                 | 0
      jumps over the
      lazy dog quickly.
        ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "o", direction: -1, shift: "extend" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["search-backward-extend-wrap-2"](afterDocument);
    } catch (e) {
      notifyDependents["search-backward-extend-wrap-2"](undefined);

      throw e;
    }
  });
});
