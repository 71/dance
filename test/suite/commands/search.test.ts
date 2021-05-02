import * as vscode from "vscode";

import { addDepthToCommandTests, ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("./test/suite/commands/search.md", function () {
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
          "easy": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            foo bar
              ^ 0
          `)),
          "1": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            The quick brown fox
              ^^^ 0
            jumps over the
            lazy dog quickly.
          `)),
          "2": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            The quick brown fox
                       | 0
            jumps over the
            lazy dog quickly.
              ^ 0
          `)),

          "easy-search-b": new Promise((resolve) => notifyDependents["easy-search-b"] = resolve),
          "1-search": new Promise((resolve) => notifyDependents["1-search"] = resolve),
          "1-search-repeat": new Promise((resolve) => notifyDependents["1-search-repeat"] = resolve),
          "1-search-start": new Promise((resolve) => notifyDependents["1-search-start"] = resolve),
          "1-search-start-wrap": new Promise((resolve) => notifyDependents["1-search-start-wrap"] = resolve),
          "1-search-wrap": new Promise((resolve) => notifyDependents["1-search-wrap"] = resolve),
          "1-search-not-found": new Promise((resolve) => notifyDependents["1-search-not-found"] = resolve),
          "1-search-backward": new Promise((resolve) => notifyDependents["1-search-backward"] = resolve),
          "1-search-backward-wrap": new Promise((resolve) => notifyDependents["1-search-backward-wrap"] = resolve),
          "1-search-backward-wrap-other": new Promise((resolve) => notifyDependents["1-search-backward-wrap-other"] = resolve),
          "1-search-backward-not-found": new Promise((resolve) => notifyDependents["1-search-backward-not-found"] = resolve),
          "1-search-extend": new Promise((resolve) => notifyDependents["1-search-extend"] = resolve),
          "1-search-extend-wrap": new Promise((resolve) => notifyDependents["1-search-extend-wrap"] = resolve),
          "1-search-backward-extend": new Promise((resolve) => notifyDependents["1-search-backward-extend"] = resolve),
          "1-search-backward-extend-character": new Promise((resolve) => notifyDependents["1-search-backward-extend-character"] = resolve),
          "1-search-backward-extend-other": new Promise((resolve) => notifyDependents["1-search-backward-extend-other"] = resolve),
          "1-search-backward-extend-character-other": new Promise((resolve) => notifyDependents["1-search-backward-extend-character-other"] = resolve),
          "1-search-backward-extend-wrap": new Promise((resolve) => notifyDependents["1-search-backward-extend-wrap"] = resolve),
          "2-search": new Promise((resolve) => notifyDependents["2-search"] = resolve),
          "2-search-extend": new Promise((resolve) => notifyDependents["2-search-extend"] = resolve),
          "2-search-extend-character": new Promise((resolve) => notifyDependents["2-search-extend-character"] = resolve),
          "2-search-wrap": new Promise((resolve) => notifyDependents["2-search-wrap"] = resolve),
          "2-search-extend-wrap": new Promise((resolve) => notifyDependents["2-search-extend-wrap"] = resolve),
          "2-search-backward": new Promise((resolve) => notifyDependents["2-search-backward"] = resolve),
          "2-search-backward-extend": new Promise((resolve) => notifyDependents["2-search-backward-extend"] = resolve),
          "2-search-backward-wrap": new Promise((resolve) => notifyDependents["2-search-backward-wrap"] = resolve),
          "2-search-backward-extend-wrap": new Promise((resolve) => notifyDependents["2-search-backward-extend-wrap"] = resolve),
        };

  test("easy > search-b", async function () {
    const beforeDocument = await documents["easy"];

    if (beforeDocument === undefined) {
      notifyDependents["easy-search-b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      foo bar
          ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.search", { input: "b" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:8:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["easy-search-b"](afterDocument);
    } catch (e) {
      notifyDependents["easy-search-b"](undefined);

      throw e;
    }
  });

  test("1 > search", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:27:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search"](afterDocument);
    } catch (e) {
      notifyDependents["1-search"](undefined);

      throw e;
    }
  });

  test("1 > search-repeat", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-repeat"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:39:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-repeat"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-repeat"](undefined);

      throw e;
    }
  });

  test("1 > search-start", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:51:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-start"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-start"](undefined);

      throw e;
    }
  });

  test("1 > search-start-wrap", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-start-wrap"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:65:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-start-wrap"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-start-wrap"](undefined);

      throw e;
    }
  });

  test("1 > search-wrap", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-wrap"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:79:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-wrap"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-wrap"](undefined);

      throw e;
    }
  });

  test("1 > search-not-found", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-not-found"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:91:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-not-found"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-not-found"](undefined);

      throw e;
    }
  });

  test("1 > search-backward", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:106:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-backward"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-backward"](undefined);

      throw e;
    }
  });

  test("1 > search-backward-wrap", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-backward-wrap"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:120:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-backward-wrap"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-backward-wrap"](undefined);

      throw e;
    }
  });

  test("1 > search-backward-wrap-other", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-backward-wrap-other"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:134:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-backward-wrap-other"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-backward-wrap-other"](undefined);

      throw e;
    }
  });

  test("1 > search-backward-not-found", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-backward-not-found"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:148:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-backward-not-found"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-backward-not-found"](undefined);

      throw e;
    }
  });

  test("1 > search-extend", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:163:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-extend"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-extend"](undefined);

      throw e;
    }
  });

  test("1 > search-extend-wrap", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-extend-wrap"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:176:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-extend-wrap"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-extend-wrap"](undefined);

      throw e;
    }
  });

  test("1 > search-backward-extend", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-backward-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:192:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-backward-extend"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-backward-extend"](undefined);

      throw e;
    }
  });

  test("1 > search-backward-extend-character", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-backward-extend-character"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:206:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-backward-extend-character"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-backward-extend-character"](undefined);

      throw e;
    }
  });

  test("1 > search-backward-extend-other", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-backward-extend-other"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:222:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-backward-extend-other"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-backward-extend-other"](undefined);

      throw e;
    }
  });

  test("1 > search-backward-extend-character-other", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-backward-extend-character-other"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:236:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-backward-extend-character-other"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-backward-extend-character-other"](undefined);

      throw e;
    }
  });

  test("1 > search-backward-extend-wrap", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-search-backward-extend-wrap"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:252:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-search-backward-extend-wrap"](afterDocument);
    } catch (e) {
      notifyDependents["1-search-backward-extend-wrap"](undefined);

      throw e;
    }
  });

  test("2 > search", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-search"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:281:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-search"](afterDocument);
    } catch (e) {
      notifyDependents["2-search"](undefined);

      throw e;
    }
  });

  test("2 > search-extend", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-search-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:295:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-search-extend"](afterDocument);
    } catch (e) {
      notifyDependents["2-search-extend"](undefined);

      throw e;
    }
  });

  test("2 > search-extend-character", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-search-extend-character"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:309:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-search-extend-character"](afterDocument);
    } catch (e) {
      notifyDependents["2-search-extend-character"](undefined);

      throw e;
    }
  });

  test("2 > search-wrap", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-search-wrap"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:325:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-search-wrap"](afterDocument);
    } catch (e) {
      notifyDependents["2-search-wrap"](undefined);

      throw e;
    }
  });

  test("2 > search-extend-wrap", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-search-extend-wrap"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:339:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-search-extend-wrap"](afterDocument);
    } catch (e) {
      notifyDependents["2-search-extend-wrap"](undefined);

      throw e;
    }
  });

  test("2 > search-backward", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-search-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:355:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-search-backward"](afterDocument);
    } catch (e) {
      notifyDependents["2-search-backward"](undefined);

      throw e;
    }
  });

  test("2 > search-backward-extend", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-search-backward-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:369:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-search-backward-extend"](afterDocument);
    } catch (e) {
      notifyDependents["2-search-backward-extend"](undefined);

      throw e;
    }
  });

  test("2 > search-backward-wrap", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-search-backward-wrap"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:384:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-search-backward-wrap"](afterDocument);
    } catch (e) {
      notifyDependents["2-search-backward-wrap"](undefined);

      throw e;
    }
  });

  test("2 > search-backward-extend-wrap", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-search-backward-extend-wrap"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/search.md:398:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-search-backward-extend-wrap"](afterDocument);
    } catch (e) {
      notifyDependents["2-search-backward-extend-wrap"](undefined);

      throw e;
    }
  });

  addDepthToCommandTests(this);
});
