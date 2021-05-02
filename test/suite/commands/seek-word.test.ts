import * as vscode from "vscode";

import { addDepthToCommandTests, ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("./test/suite/commands/seek-word.md", function () {
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
            console.log()
            ^ 0
          `)),
          "2": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            foo

            bar
            ^ 0
          `)),
          "3": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            aaa bbb ccc ddd
                  ^ 0
          `)),
          "4": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            aaa bbb
               ^ 0
              ccc
            dd
          `)),
          "5": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            foo x bar.baz ex
            ^ 0
            la
          `)),
          "6": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            a b c d
              ^ 0
          `)),

          "1-word-end": new Promise((resolve) => notifyDependents["1-word-end"] = resolve),
          "1-word-end-x": new Promise((resolve) => notifyDependents["1-word-end-x"] = resolve),
          "1-word-end-x-x": new Promise((resolve) => notifyDependents["1-word-end-x-x"] = resolve),
          "1-word-end-x-x-word-start-backward": new Promise((resolve) => notifyDependents["1-word-end-x-x-word-start-backward"] = resolve),
          "1-word-end-x-x-word-start-backward-x": new Promise((resolve) => notifyDependents["1-word-end-x-x-word-start-backward-x"] = resolve),
          "1-word-end-x-x-word-start-backward-x-x": new Promise((resolve) => notifyDependents["1-word-end-x-x-word-start-backward-x-x"] = resolve),
          "1-word-end-extend": new Promise((resolve) => notifyDependents["1-word-end-extend"] = resolve),
          "1-word-end-extend-x": new Promise((resolve) => notifyDependents["1-word-end-extend-x"] = resolve),
          "1-word-end-extend-x-x": new Promise((resolve) => notifyDependents["1-word-end-extend-x-x"] = resolve),
          "1-word-end-extend-x-word-end": new Promise((resolve) => notifyDependents["1-word-end-extend-x-word-end"] = resolve),
          "2-word-start-backward": new Promise((resolve) => notifyDependents["2-word-start-backward"] = resolve),
          "3-word-end": new Promise((resolve) => notifyDependents["3-word-end"] = resolve),
          "3-word-end-x": new Promise((resolve) => notifyDependents["3-word-end-x"] = resolve),
          "3-word-end-x-word-start-backward": new Promise((resolve) => notifyDependents["3-word-end-x-word-start-backward"] = resolve),
          "3-word-end-x-word-start-backward-2": new Promise((resolve) => notifyDependents["3-word-end-x-word-start-backward-2"] = resolve),
          "4-word-start": new Promise((resolve) => notifyDependents["4-word-start"] = resolve),
          "4-word-start-word-end": new Promise((resolve) => notifyDependents["4-word-start-word-end"] = resolve),
          "5-word-end": new Promise((resolve) => notifyDependents["5-word-end"] = resolve),
          "5-word-end-x": new Promise((resolve) => notifyDependents["5-word-end-x"] = resolve),
          "5-word-end-x-x": new Promise((resolve) => notifyDependents["5-word-end-x-x"] = resolve),
          "5-word-end-x-x-x": new Promise((resolve) => notifyDependents["5-word-end-x-x-x"] = resolve),
          "6-word-end": new Promise((resolve) => notifyDependents["6-word-end"] = resolve),
          "6-word-start": new Promise((resolve) => notifyDependents["6-word-start"] = resolve),
          "6-word-start-backward": new Promise((resolve) => notifyDependents["6-word-start-backward"] = resolve),
          "6-word-end-extend": new Promise((resolve) => notifyDependents["6-word-end-extend"] = resolve),
          "6-word-start-extend": new Promise((resolve) => notifyDependents["6-word-start-extend"] = resolve),
          "6-word-start-extend-backward": new Promise((resolve) => notifyDependents["6-word-start-extend-backward"] = resolve),
        };

  test("1 > word-end", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:10:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-end"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-end"](undefined);

      throw e;
    }
  });

  test("1 > word-end > x", async function () {
    const beforeDocument = await documents["1-word-end"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-end-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:20:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-end-x"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-end-x"](undefined);

      throw e;
    }
  });

  test("1 > word-end > x > x", async function () {
    const beforeDocument = await documents["1-word-end-x"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-end-x-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:30:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-end-x-x"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-end-x-x"](undefined);

      throw e;
    }
  });

  test("1 > word-end > x > x > word-start-backward", async function () {
    const beforeDocument = await documents["1-word-end-x-x"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-end-x-x-word-start-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:40:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-end-x-x-word-start-backward"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-end-x-x-word-start-backward"](undefined);

      throw e;
    }
  });

  test("1 > word-end > x > x > word-start-backward > x", async function () {
    const beforeDocument = await documents["1-word-end-x-x-word-start-backward"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-end-x-x-word-start-backward-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:50:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-end-x-x-word-start-backward-x"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-end-x-x-word-start-backward-x"](undefined);

      throw e;
    }
  });

  test("1 > word-end > x > x > word-start-backward > x > x", async function () {
    const beforeDocument = await documents["1-word-end-x-x-word-start-backward-x"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-end-x-x-word-start-backward-x-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:60:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-end-x-x-word-start-backward-x-x"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-end-x-x-word-start-backward-x-x"](undefined);

      throw e;
    }
  });

  test("1 > word-end-extend", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-end-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:70:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-end-extend"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-end-extend"](undefined);

      throw e;
    }
  });

  test("1 > word-end-extend > x", async function () {
    const beforeDocument = await documents["1-word-end-extend"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-end-extend-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:80:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-end-extend-x"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-end-extend-x"](undefined);

      throw e;
    }
  });

  test("1 > word-end-extend > x > x", async function () {
    const beforeDocument = await documents["1-word-end-extend-x"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-end-extend-x-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:90:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-end-extend-x-x"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-end-extend-x-x"](undefined);

      throw e;
    }
  });

  test("1 > word-end-extend > x > word-end", async function () {
    const beforeDocument = await documents["1-word-end-extend-x"];

    if (beforeDocument === undefined) {
      notifyDependents["1-word-end-extend-x-word-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:100:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-word-end-extend-x-word-end"](afterDocument);
    } catch (e) {
      notifyDependents["1-word-end-extend-x-word-end"](undefined);

      throw e;
    }
  });

  test("2 > word-start-backward", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-word-start-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:121:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-word-start-backward"](afterDocument);
    } catch (e) {
      notifyDependents["2-word-start-backward"](undefined);

      throw e;
    }
  });

  test("3 > word-end", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-word-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:144:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-word-end"](afterDocument);
    } catch (e) {
      notifyDependents["3-word-end"](undefined);

      throw e;
    }
  });

  test("3 > word-end > x", async function () {
    const beforeDocument = await documents["3-word-end"];

    if (beforeDocument === undefined) {
      notifyDependents["3-word-end-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:154:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-word-end-x"](afterDocument);
    } catch (e) {
      notifyDependents["3-word-end-x"](undefined);

      throw e;
    }
  });

  test("3 > word-end > x > word-start-backward", async function () {
    const beforeDocument = await documents["3-word-end-x"];

    if (beforeDocument === undefined) {
      notifyDependents["3-word-end-x-word-start-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:164:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-word-end-x-word-start-backward"](afterDocument);
    } catch (e) {
      notifyDependents["3-word-end-x-word-start-backward"](undefined);

      throw e;
    }
  });

  test("3 > word-end > x > word-start-backward-2", async function () {
    const beforeDocument = await documents["3-word-end-x"];

    if (beforeDocument === undefined) {
      notifyDependents["3-word-end-x-word-start-backward-2"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:174:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-word-end-x-word-start-backward-2"](afterDocument);
    } catch (e) {
      notifyDependents["3-word-end-x-word-start-backward-2"](undefined);

      throw e;
    }
  });

  test("4 > word-start", async function () {
    const beforeDocument = await documents["4"];

    if (beforeDocument === undefined) {
      notifyDependents["4-word-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:193:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["4-word-start"](afterDocument);
    } catch (e) {
      notifyDependents["4-word-start"](undefined);

      throw e;
    }
  });

  test("4 > word-start > word-end", async function () {
    const beforeDocument = await documents["4-word-start"];

    if (beforeDocument === undefined) {
      notifyDependents["4-word-start-word-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:205:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["4-word-start-word-end"](afterDocument);
    } catch (e) {
      notifyDependents["4-word-start-word-end"](undefined);

      throw e;
    }
  });

  test("5 > word-end", async function () {
    const beforeDocument = await documents["5"];

    if (beforeDocument === undefined) {
      notifyDependents["5-word-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:227:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["5-word-end"](afterDocument);
    } catch (e) {
      notifyDependents["5-word-end"](undefined);

      throw e;
    }
  });

  test("5 > word-end > x", async function () {
    const beforeDocument = await documents["5-word-end"];

    if (beforeDocument === undefined) {
      notifyDependents["5-word-end-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:238:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["5-word-end-x"](afterDocument);
    } catch (e) {
      notifyDependents["5-word-end-x"](undefined);

      throw e;
    }
  });

  test("5 > word-end > x > x", async function () {
    const beforeDocument = await documents["5-word-end-x"];

    if (beforeDocument === undefined) {
      notifyDependents["5-word-end-x-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:249:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["5-word-end-x-x"](afterDocument);
    } catch (e) {
      notifyDependents["5-word-end-x-x"](undefined);

      throw e;
    }
  });

  test("5 > word-end > x > x > x", async function () {
    const beforeDocument = await documents["5-word-end-x-x"];

    if (beforeDocument === undefined) {
      notifyDependents["5-word-end-x-x-x"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:260:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["5-word-end-x-x-x"](afterDocument);
    } catch (e) {
      notifyDependents["5-word-end-x-x-x"](undefined);

      throw e;
    }
  });

  test("6 > word-end", async function () {
    const beforeDocument = await documents["6"];

    if (beforeDocument === undefined) {
      notifyDependents["6-word-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:280:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["6-word-end"](afterDocument);
    } catch (e) {
      notifyDependents["6-word-end"](undefined);

      throw e;
    }
  });

  test("6 > word-start", async function () {
    const beforeDocument = await documents["6"];

    if (beforeDocument === undefined) {
      notifyDependents["6-word-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:290:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["6-word-start"](afterDocument);
    } catch (e) {
      notifyDependents["6-word-start"](undefined);

      throw e;
    }
  });

  test("6 > word-start-backward", async function () {
    const beforeDocument = await documents["6"];

    if (beforeDocument === undefined) {
      notifyDependents["6-word-start-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:300:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["6-word-start-backward"](afterDocument);
    } catch (e) {
      notifyDependents["6-word-start-backward"](undefined);

      throw e;
    }
  });

  test("6 > word-end-extend", async function () {
    const beforeDocument = await documents["6"];

    if (beforeDocument === undefined) {
      notifyDependents["6-word-end-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:310:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["6-word-end-extend"](afterDocument);
    } catch (e) {
      notifyDependents["6-word-end-extend"](undefined);

      throw e;
    }
  });

  test("6 > word-start-extend", async function () {
    const beforeDocument = await documents["6"];

    if (beforeDocument === undefined) {
      notifyDependents["6-word-start-extend"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:320:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["6-word-start-extend"](afterDocument);
    } catch (e) {
      notifyDependents["6-word-start-extend"](undefined);

      throw e;
    }
  });

  test("6 > word-start-extend-backward", async function () {
    const beforeDocument = await documents["6"];

    if (beforeDocument === undefined) {
      notifyDependents["6-word-start-extend-backward"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
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
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-word.md:330:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["6-word-start-extend-backward"](afterDocument);
    } catch (e) {
      notifyDependents["6-word-start-extend-backward"](undefined);

      throw e;
    }
  });

  addDepthToCommandTests(this);
});
