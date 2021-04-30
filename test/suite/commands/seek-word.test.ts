import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("seek-word.md", function () {
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
            console.log()
            ^ 0
          `)),
          "initial-2": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            foo

            bar
            ^ 0
          `)),
          "initial-3": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            aaa bbb ccc ddd
                  ^ 0
          `)),
          "initial-4": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            aaa bbb
               ^ 0
              ccc
            dd
          `)),
          "initial-5": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            foo x bar.baz ex
            ^ 0
            la
          `)),
          "initial-6": Promise.resolve(ExpectedDocument.parseIndented(12, `\
            a b c d
              ^ 0
          `)),

          "word-end-1a": new Promise((resolve) => notifyDependents["word-end-1a"] = resolve),
          "word-end-extend-1a": new Promise((resolve) => notifyDependents["word-end-extend-1a"] = resolve),
          "word-end-1b": new Promise((resolve) => notifyDependents["word-end-1b"] = resolve),
          "word-end-extend-1b": new Promise((resolve) => notifyDependents["word-end-extend-1b"] = resolve),
          "word-end-1c": new Promise((resolve) => notifyDependents["word-end-1c"] = resolve),
          "word-end-extend-1c": new Promise((resolve) => notifyDependents["word-end-extend-1c"] = resolve),
          "word-end-extend-1b-word-end": new Promise((resolve) => notifyDependents["word-end-extend-1b-word-end"] = resolve),
          "word-end-1c-start-a": new Promise((resolve) => notifyDependents["word-end-1c-start-a"] = resolve),
          "word-end-1c-start-b": new Promise((resolve) => notifyDependents["word-end-1c-start-b"] = resolve),
          "word-end-1c-start-c": new Promise((resolve) => notifyDependents["word-end-1c-start-c"] = resolve),
          "word-start-backward-2": new Promise((resolve) => notifyDependents["word-start-backward-2"] = resolve),
          "word-end-3a": new Promise((resolve) => notifyDependents["word-end-3a"] = resolve),
          "word-end-3b": new Promise((resolve) => notifyDependents["word-end-3b"] = resolve),
          "word-end-3b-previous": new Promise((resolve) => notifyDependents["word-end-3b-previous"] = resolve),
          "word-end-3b-previous-with-count": new Promise((resolve) => notifyDependents["word-end-3b-previous-with-count"] = resolve),
          "word-start-4a": new Promise((resolve) => notifyDependents["word-start-4a"] = resolve),
          "word-start-4b": new Promise((resolve) => notifyDependents["word-start-4b"] = resolve),
          "word-end-5a": new Promise((resolve) => notifyDependents["word-end-5a"] = resolve),
          "word-end-5b": new Promise((resolve) => notifyDependents["word-end-5b"] = resolve),
          "word-end-5c": new Promise((resolve) => notifyDependents["word-end-5c"] = resolve),
          "word-end-5d": new Promise((resolve) => notifyDependents["word-end-5d"] = resolve),
          "word-end-6": new Promise((resolve) => notifyDependents["word-end-6"] = resolve),
          "word-start-6": new Promise((resolve) => notifyDependents["word-start-6"] = resolve),
          "word-start-backward-6": new Promise((resolve) => notifyDependents["word-start-backward-6"] = resolve),
          "word-end-extend-6": new Promise((resolve) => notifyDependents["word-end-extend-6"] = resolve),
          "word-start-extend-6": new Promise((resolve) => notifyDependents["word-start-extend-6"] = resolve),
          "word-start-extend-backward-6": new Promise((resolve) => notifyDependents["word-start-extend-backward-6"] = resolve),
        };

  test("transition initial-1           > word-end-1a                    ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-1a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      console.log()
      ^^^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.wordEnd");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-1a"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-1a"](undefined);

      throw e;
    }
  });

  test("transition initial-1           > word-end-extend-1a             ", async function () {
    const beforeDocument = await documents["initial-1"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-extend-1a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      console.log()
      ^^^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.wordEnd.extend");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-extend-1a"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-extend-1a"](undefined);

      throw e;
    }
  });

  test("transition word-end-1a         > word-end-1b                    ", async function () {
    const beforeDocument = await documents["word-end-1a"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-1b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      console.log()
             ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.wordEnd");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-1b"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-1b"](undefined);

      throw e;
    }
  });

  test("transition word-end-extend-1a  > word-end-extend-1b             ", async function () {
    const beforeDocument = await documents["word-end-extend-1a"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-extend-1b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      console.log()
      ^^^^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.wordEnd.extend");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-extend-1b"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-extend-1b"](undefined);

      throw e;
    }
  });

  test("transition word-end-1b         > word-end-1c                    ", async function () {
    const beforeDocument = await documents["word-end-1b"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-1c"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      console.log()
              ^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.wordEnd");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-1c"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-1c"](undefined);

      throw e;
    }
  });

  test("transition word-end-extend-1b  > word-end-extend-1c             ", async function () {
    const beforeDocument = await documents["word-end-extend-1b"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-extend-1c"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      console.log()
      ^^^^^^^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.wordEnd.extend");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-extend-1c"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-extend-1c"](undefined);

      throw e;
    }
  });

  test("transition word-end-extend-1b  > word-end-extend-1b-word-end    ", async function () {
    const beforeDocument = await documents["word-end-extend-1b"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-extend-1b-word-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      console.log()
              ^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.wordEnd");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-extend-1b-word-end"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-extend-1b-word-end"](undefined);

      throw e;
    }
  });

  test("transition word-end-1c         > word-end-1c-start-a            ", async function () {
    const beforeDocument = await documents["word-end-1c"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-1c-start-a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      console.log()
              |^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.word.backward");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-1c-start-a"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-1c-start-a"](undefined);

      throw e;
    }
  });

  test("transition word-end-1c-start-a > word-end-1c-start-b            ", async function () {
    const beforeDocument = await documents["word-end-1c-start-a"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-1c-start-b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      console.log()
             ^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.word.backward");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-1c-start-b"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-1c-start-b"](undefined);

      throw e;
    }
  });

  test("transition word-end-1c-start-b > word-end-1c-start-c            ", async function () {
    const beforeDocument = await documents["word-end-1c-start-b"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-1c-start-c"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      console.log()
      |^^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.word.backward");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-1c-start-c"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-1c-start-c"](undefined);

      throw e;
    }
  });

  test("transition initial-2           > word-start-backward-2          ", async function () {
    const beforeDocument = await documents["initial-2"];

    if (beforeDocument === undefined) {
      notifyDependents["word-start-backward-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo
      |^^ 0

      bar
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.word.backward");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-start-backward-2"](afterDocument);
    } catch (e) {
      notifyDependents["word-start-backward-2"](undefined);

      throw e;
    }
  });

  test("transition initial-3           > word-end-3a                    ", async function () {
    const beforeDocument = await documents["initial-3"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-3a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      aaa bbb ccc ddd
             ^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.wordEnd");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-3a"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-3a"](undefined);

      throw e;
    }
  });

  test("transition word-end-3a         > word-end-3b                    ", async function () {
    const beforeDocument = await documents["word-end-3a"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-3b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      aaa bbb ccc ddd
                 ^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.wordEnd");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-3b"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-3b"](undefined);

      throw e;
    }
  });

  test("transition word-end-3b         > word-end-3b-previous           ", async function () {
    const beforeDocument = await documents["word-end-3b"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-3b-previous"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      aaa bbb ccc ddd
                  |^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.word.backward");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-3b-previous"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-3b-previous"](undefined);

      throw e;
    }
  });

  test("transition word-end-3b         > word-end-3b-previous-with-count", async function () {
    const beforeDocument = await documents["word-end-3b"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-3b-previous-with-count"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      aaa bbb ccc ddd
              |^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.word.backward", { count: 2 });
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-3b-previous-with-count"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-3b-previous-with-count"](undefined);

      throw e;
    }
  });

  test("transition initial-4           > word-start-4a                  ", async function () {
    const beforeDocument = await documents["initial-4"];

    if (beforeDocument === undefined) {
      notifyDependents["word-start-4a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      aaa bbb
          ^^^ 0
        ccc
      dd
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.word");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-start-4a"](afterDocument);
    } catch (e) {
      notifyDependents["word-start-4a"](undefined);

      throw e;
    }
  });

  test("transition word-start-4a       > word-start-4b                  ", async function () {
    const beforeDocument = await documents["word-start-4a"];

    if (beforeDocument === undefined) {
      notifyDependents["word-start-4b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      aaa bbb
        ccc
      ^^^^^ 0
      dd
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.wordEnd");

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-start-4b"](afterDocument);
    } catch (e) {
      notifyDependents["word-start-4b"](undefined);

      throw e;
    }
  });

  test("transition initial-5           > word-end-5a                    ", async function () {
    const beforeDocument = await documents["initial-5"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-5a"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo x bar.baz ex
      ^^^ 0
      la
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.wordEnd");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-5a"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-5a"](undefined);

      throw e;
    }
  });

  test("transition word-end-5a         > word-end-5b                    ", async function () {
    const beforeDocument = await documents["word-end-5a"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-5b"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo x bar.baz ex
         ^^ 0
      la
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.wordEnd");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-5b"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-5b"](undefined);

      throw e;
    }
  });

  test("transition word-end-5b         > word-end-5c                    ", async function () {
    const beforeDocument = await documents["word-end-5b"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-5c"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo x bar.baz ex
           ^^^^ 0
      la
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.wordEnd");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-5c"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-5c"](undefined);

      throw e;
    }
  });

  test("transition word-end-5c         > word-end-5d                    ", async function () {
    const beforeDocument = await documents["word-end-5c"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-5d"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      foo x bar.baz ex
               ^ 0
      la
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.wordEnd");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-5d"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-5d"](undefined);

      throw e;
    }
  });

  test("transition initial-6           > word-end-6                     ", async function () {
    const beforeDocument = await documents["initial-6"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-6"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      a b c d
         ^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.wordEnd");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-6"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-6"](undefined);

      throw e;
    }
  });

  test("transition initial-6           > word-start-6                   ", async function () {
    const beforeDocument = await documents["initial-6"];

    if (beforeDocument === undefined) {
      notifyDependents["word-start-6"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      a b c d
         ^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.word");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-start-6"](afterDocument);
    } catch (e) {
      notifyDependents["word-start-6"](undefined);

      throw e;
    }
  });

  test("transition initial-6           > word-start-backward-6          ", async function () {
    const beforeDocument = await documents["initial-6"];

    if (beforeDocument === undefined) {
      notifyDependents["word-start-backward-6"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      a b c d
      |^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.word.backward");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-start-backward-6"](afterDocument);
    } catch (e) {
      notifyDependents["word-start-backward-6"](undefined);

      throw e;
    }
  });

  test("transition initial-6           > word-end-extend-6              ", async function () {
    const beforeDocument = await documents["initial-6"];

    if (beforeDocument === undefined) {
      notifyDependents["word-end-extend-6"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      a b c d
        ^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.wordEnd.extend");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-end-extend-6"](afterDocument);
    } catch (e) {
      notifyDependents["word-end-extend-6"](undefined);

      throw e;
    }
  });

  test("transition initial-6           > word-start-extend-6            ", async function () {
    const beforeDocument = await documents["initial-6"];

    if (beforeDocument === undefined) {
      notifyDependents["word-start-extend-6"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      a b c d
        ^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.word.extend");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-start-extend-6"](afterDocument);
    } catch (e) {
      notifyDependents["word-start-extend-6"](undefined);

      throw e;
    }
  });

  test("transition initial-6           > word-start-extend-backward-6   ", async function () {
    const beforeDocument = await documents["initial-6"];

    if (beforeDocument === undefined) {
      notifyDependents["word-start-extend-backward-6"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, `\
      a b c d
      |^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
      await executeCommand("dance.seek.word.extend.backward");
      await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["word-start-extend-backward-6"](afterDocument);
    } catch (e) {
      notifyDependents["word-start-extend-backward-6"](undefined);

      throw e;
    }
  });
});
