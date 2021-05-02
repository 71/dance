import * as vscode from "vscode";

import { addDepthToCommandTests, ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("./test/suite/commands/seek-object-sentence.md", function () {
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
            A sentence starts with a non-blank character or a line break. <== It ends with a
            ^ 0
            punctuation mark like the previous one, or two consecutive line breaks like this
                                               ^ 1

            An outer sentence also contains the trailing blank characters (but never line
            |^^^^^^^^^^^^^^^^ 2
            breaks) like this.       <== The white spaces before this sentence belongs to
                                 ^ 3
            the outer previous sentence.
                             ^ 4
               <- White spaces here and the line break before them belongs to this sentence,
                  |^^^^^^^^^^^^^^^^^^^^^ 5
            not the previous one, since the previous trailing cannot contain line breaks.
          `)),
          "2": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
                    I'm a sentence   .        I'm another sentence.
                ^ 0 ^ 1      |^^^ 2
          `)),
          "3": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            I'm a previous sentence.    
                               |^^^ 3 ^ 4
                                        ^ 5
                    I'm a sentence   .        I'm another sentence.
                ^ 0 ^ 1      |^^^ 2
          `)),
          "4": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            I'm a sentence.I'm another sentence
                   ^^^^ 0 ^ 1       ^ 3        ^ 4
                           ^ 2

          `)),
          "5": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            I'm a sentence terminated by two line breaks
                              |^^^^^ 0                  ^ 1

            ^ 2
                I'm another sentence
             ^ 3         |^^^^^ 4
          `)),
          "6": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            I'm a sentence terminated by two line breaks plus one more
                              |^^^^^ 0                                ^ 1

            ^ 2

            ^ 3
          `)),
          "7": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            I'm a sentence at end of document

            | 0
          `)),

          "1-to-end": new Promise((resolve) => notifyDependents["1-to-end"] = resolve),
          "1-to-start": new Promise((resolve) => notifyDependents["1-to-start"] = resolve),
          "1-select-inner": new Promise((resolve) => notifyDependents["1-select-inner"] = resolve),
          "2-to-start": new Promise((resolve) => notifyDependents["2-to-start"] = resolve),
          "2-to-end": new Promise((resolve) => notifyDependents["2-to-end"] = resolve),
          "2-select": new Promise((resolve) => notifyDependents["2-select"] = resolve),
          "3-select": new Promise((resolve) => notifyDependents["3-select"] = resolve),
          "3-to-start": new Promise((resolve) => notifyDependents["3-to-start"] = resolve),
          "3-to-start-inner": new Promise((resolve) => notifyDependents["3-to-start-inner"] = resolve),
          "3-to-end": new Promise((resolve) => notifyDependents["3-to-end"] = resolve),
          "4-select": new Promise((resolve) => notifyDependents["4-select"] = resolve),
          "4-to-start": new Promise((resolve) => notifyDependents["4-to-start"] = resolve),
          "4-to-end": new Promise((resolve) => notifyDependents["4-to-end"] = resolve),
          "5-select": new Promise((resolve) => notifyDependents["5-select"] = resolve),
          "5-to-start": new Promise((resolve) => notifyDependents["5-to-start"] = resolve),
          "5-to-end": new Promise((resolve) => notifyDependents["5-to-end"] = resolve),
          "6-to-start": new Promise((resolve) => notifyDependents["6-to-start"] = resolve),
          "6-to-end": new Promise((resolve) => notifyDependents["6-to-end"] = resolve),
          "6-select": new Promise((resolve) => notifyDependents["6-select"] = resolve),
          "7-to-start": new Promise((resolve) => notifyDependents["7-to-start"] = resolve),
          "7-to-end": new Promise((resolve) => notifyDependents["7-to-end"] = resolve),
          "7-select": new Promise((resolve) => notifyDependents["7-select"] = resolve),
        };

  test("1 > to-end", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      A sentence starts with a non-blank character or a line break. <== It ends with a
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
      punctuation mark like the previous one, or two consecutive line breaks like this
                                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 1

      An outer sentence also contains the trailing blank characters (but never line
      ^ 2
      breaks) like this.       <== The white spaces before this sentence belongs to
      the outer previous sentence.
                                 ^ 2
         <- White spaces here and the line break before them belongs to this sentence,
            ^ 5
      not the previous one, since the previous trailing cannot contain line breaks.
                                                                                  ^ 5
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "end" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:22:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-end"](undefined);

      throw e;
    }
  });

  test("1 > to-start", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      A sentence starts with a non-blank character or a line break. <== It ends with a
      ^ 0                                                           |^^^^^^^^^^^^^^^^^^ 1
      punctuation mark like the previous one, or two consecutive line breaks like this
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 1

      An outer sentence also contains the trailing blank characters (but never line
      |^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 3
      breaks) like this.       <== The white spaces before this sentence belongs to
      ^^^^^^^^^^^^^^^^^^ 3     |^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 4
      the outer previous sentence.
      ^^^^^^^^^^^^^^^^^^ 4        | 5
         <- White spaces here and the line break before them belongs to this sentence,
      ^^^^^^^ 5
      not the previous one, since the previous trailing cannot contain line breaks.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:44:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-start"](undefined);

      throw e;
    }
  });

  test("1 > select-inner", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select-inner"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      A sentence starts with a non-blank character or a line break. <== It ends with a
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
                                                                    ^^^^^^^^^^^^^^^^^^^ 1
      punctuation mark like the previous one, or two consecutive line breaks like this
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 1

      An outer sentence also contains the trailing blank characters (but never line
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 2
      breaks) like this.       <== The white spaces before this sentence belongs to
      ^^^^^^^^^^^^^^^^^^ 2     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 4
      the outer previous sentence.|{4}{5}
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 4
                                  ^ 5
         <- White spaces here and the line break before them belongs to this sentence,
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 5
      not the previous one, since the previous trailing cannot contain line breaks.
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 5
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", inner: true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:66:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["1-select-inner"](afterDocument);
    } catch (e) {
      notifyDependents["1-select-inner"](undefined);

      throw e;
    }
  });

  test("2 > to-start", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
              I'm a sentence   .        I'm another sentence.
          ^^^^^^^^^^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:109:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["2-to-start"](undefined);

      throw e;
    }
  });

  test("2 > to-end", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
              I'm a sentence   .        I'm another sentence.
          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "end" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:119:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["2-to-end"](undefined);

      throw e;
    }
  });

  test("2 > select", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
              I'm a sentence   .        I'm another sentence.
              ^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:129:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["2-select"](afterDocument);
    } catch (e) {
      notifyDependents["2-select"](undefined);

      throw e;
    }
  });

  test("3 > select", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a previous sentence.    
      ^^^^^^^^^^^^^^^^^^^^^^^^ 1  ^ 0
              I'm a sentence   .        I'm another sentence.
      ^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", inner: true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:160:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-select"](afterDocument);
    } catch (e) {
      notifyDependents["3-select"](undefined);

      throw e;
    }
  });

  test("3 > to-start", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a previous sentence.    
      |^^^^^^^^^^^^^^^^^^^^^^^ 0  | 1
              I'm a sentence   .        I'm another sentence.
      ^^^^^^^^^^^^^^^^^^ 1
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:176:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["3-to-start"](undefined);

      throw e;
    }
  });

  test("3 > to-start-inner", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-to-start-inner"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a previous sentence.    
      |^^^^^^^^^^^^^^^^^^^^^^^ 0  | 1
              I'm a sentence   .        I'm another sentence.
      ^^^^^^^^^^^^^^^^^^ 1
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start", inner: true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:194:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-to-start-inner"](afterDocument);
    } catch (e) {
      notifyDependents["3-to-start-inner"](undefined);

      throw e;
    }
  });

  test("3 > to-end", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a previous sentence.    
                         ^^^^^^^^^^ 0
              I'm a sentence   .        I'm another sentence.
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "end" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:209:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["3-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["3-to-end"](undefined);

      throw e;
    }
  });

  test("4 > select", async function () {
    const beforeDocument = await documents["4"];

    if (beforeDocument === undefined) {
      notifyDependents["4-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sentence.I'm another sentence
      ^^^^^^^^^^^^^^^ 0
                     ^^^^^^^^^^^^^^^^^^^^^ 1

    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", inner: true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:242:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["4-select"](afterDocument);
    } catch (e) {
      notifyDependents["4-select"](undefined);

      throw e;
    }
  });

  test("4 > to-start", async function () {
    const beforeDocument = await documents["4"];

    if (beforeDocument === undefined) {
      notifyDependents["4-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sentence.I'm another sentence
      |^^^^^^^^^^^^^^ 0
                     |^^^^^^^^^^^^^^^^^^^^ 1

    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:257:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["4-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["4-to-start"](undefined);

      throw e;
    }
  });

  test("4 > to-end", async function () {
    const beforeDocument = await documents["4"];

    if (beforeDocument === undefined) {
      notifyDependents["4-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sentence.I'm another sentence
                ^^^^^ 0
                     ^^^^^^^^^^^^^^^^^^^^^ 1

    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "end" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:273:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["4-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["4-to-end"](undefined);

      throw e;
    }
  });

  test("5 > select", async function () {
    const beforeDocument = await documents["5"];

    if (beforeDocument === undefined) {
      notifyDependents["5-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sentence terminated by two line breaks
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

          I'm another sentence
          ^^^^^^^^^^^^^^^^^^^^ 1
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:307:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["5-select"](afterDocument);
    } catch (e) {
      notifyDependents["5-select"](undefined);

      throw e;
    }
  });

  test("5 > to-start", async function () {
    const beforeDocument = await documents["5"];

    if (beforeDocument === undefined) {
      notifyDependents["5-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sentence terminated by two line breaks
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

      ^ 1
          I'm another sentence
      ^^^^^^^^^^^^^^ 1
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:320:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["5-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["5-to-start"](undefined);

      throw e;
    }
  });

  test("5 > to-end", async function () {
    const beforeDocument = await documents["5"];

    if (beforeDocument === undefined) {
      notifyDependents["5-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sentence terminated by two line breaks
                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

      ^ 1
          I'm another sentence
      ^^^^^^^^^^^^^^^^^^^^^^^^ 1
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "end" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:337:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["5-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["5-to-end"](undefined);

      throw e;
    }
  });

  test("6 > to-start", async function () {
    const beforeDocument = await documents["6"];

    if (beforeDocument === undefined) {
      notifyDependents["6-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sentence term{0}inated by two line breaks plus one more
      |^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

      ^ 1

      ^ 1
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:372:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["6-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["6-to-start"](undefined);

      throw e;
    }
  });

  test("6 > to-end", async function () {
    const beforeDocument = await documents["6"];

    if (beforeDocument === undefined) {
      notifyDependents["6-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sentence terminated by two line breaks plus one more
                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

      ^ 1

      ^ 1
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "end" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:386:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["6-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["6-to-end"](undefined);

      throw e;
    }
  });

  test("6 > select", async function () {
    const beforeDocument = await documents["6"];

    if (beforeDocument === undefined) {
      notifyDependents["6-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sentence terminated by two line breaks plus one more
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

      ^ 1

      ^ 1
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:400:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["6-select"](afterDocument);
    } catch (e) {
      notifyDependents["6-select"](undefined);

      throw e;
    }
  });

  test("7 > to-start", async function () {
    const beforeDocument = await documents["7"];

    if (beforeDocument === undefined) {
      notifyDependents["7-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sentence at end of document
      |^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:424:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["7-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["7-to-start"](undefined);

      throw e;
    }
  });

  test("7 > to-end", async function () {
    const beforeDocument = await documents["7"];

    if (beforeDocument === undefined) {
      notifyDependents["7-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sentence at end of document
                                       ^ 0

    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "end" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:435:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["7-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["7-to-end"](undefined);

      throw e;
    }
  });

  test("7 > select", async function () {
    const beforeDocument = await documents["7"];

    if (beforeDocument === undefined) {
      notifyDependents["7-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sentence at end of document
      |^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:446:1");

      // Test passed, allow dependent tests to run.
      notifyDependents["7-select"](afterDocument);
    } catch (e) {
      notifyDependents["7-select"](undefined);

      throw e;
    }
  });

  addDepthToCommandTests(this);
});
