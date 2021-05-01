import * as vscode from "vscode";

import { ExpectedDocument } from "../utils";

const executeCommand = vscode.commands.executeCommand;

suite("seek-object-sentence.md", function () {
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
            {0}A|{0} sentence starts with a non-blank character or a line break. <== It ends with a
            punctuation mark like the previous {1}o|{1}ne, or two consecutive line breaks like this

            |{2}An outer sentence{2} also contains the trailing blank characters (but never line
            breaks) like this.   {3} |{3}   <== The white spaces before this sentence belongs to
            the outer previou{4}s|{4} sentence.
               <- |{5}White spaces here and {5}the line break before them belongs to this sentence,
            not the previous one, since the previous trailing cannot contain line breaks.
          `)),
          "2": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
                {0} |{0}   {1}I|{1}'m a sen|{2}tenc{2}e   .        I'm another sentence.
          `)),
          "3": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            I'm a previous sent|{3}ence{3}.  {4} |{4} {5}
            |{5}    {0} |{0}   {1}I|{1}'m a sen|{2}tenc{2}e   .        I'm another sentence.
          `)),
          "4": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            I'm a s{0}ente|{0}nce{1}.|{1}{2}I|{2}'m anoth{3}e|{3}r sentence{4}
            |{4}
          `)),
          "5": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            I'm a sentence ter|{0}minate{0}d by two line breaks{1}
            |{1}{2}
            |{2} {3} |{3}  I'm anoth|{4}er sen{4}tence
          `)),
          "6": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            I'm a sentence ter|{0}minate{0}d by two line breaks plus one more{1}
            |{1}{2}
            |{2}{3}
            |{3}
          `)),
          "7": Promise.resolve(ExpectedDocument.parseIndented(12, String.raw`
            I'm a sentence at end of document
            {0}|{0}
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

  test("transition 1 > 1-to-end        ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      {0}A sentence starts with a non-blank character or a line break. |{0}<== It ends with a
      punctuation mark like the previous {1}one, or two consecutive line breaks like this
      |{1}
      {2}An outer sentence also contains the trailing blank characters (but never line
      breaks) like this.   {3}    |{2}<== The white spaces before this sentence belongs to
      the outer previou{4}s sentence.|{3}|{4}
         <- {5}White spaces here and the line break before them belongs to this sentence,
      not the previous one, since the previous trailing cannot contain line breaks.|{5}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "selectToEnd" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-end"](undefined);

      throw e;
    }
  });

  test("transition 1 > 1-to-start      ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      {0}A|{0} sentence starts with a non-blank character or a line break. |{1}<== It ends with a
      punctuation mark like the previous o{1}ne, or two consecutive line breaks like this

      {2}|{3}A|{2}n outer sentence also contains the trailing blank characters (but never line
      breaks) like this.{3}       |{4}<== The white spaces before this sentence belongs to
      the outer previous{4} sentence.|{5}
         <- W{5}hite spaces here and the line break before them belongs to this sentence,
      not the previous one, since the previous trailing cannot contain line breaks.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "selectToStart" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["1-to-start"](undefined);

      throw e;
    }
  });

  test("transition 1 > 1-select-inner  ", async function () {
    const beforeDocument = await documents["1"];

    if (beforeDocument === undefined) {
      notifyDependents["1-select-inner"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      {0}A sentence starts with a non-blank character or a line break.|{0} {1}<== It ends with a
      punctuation mark like the previous one, or two consecutive line breaks like this
      |{1}
      {2}{3}An outer sentence also contains the trailing blank characters (but never line
      breaks) like this.|{2}|{3}       {4}<== The white spaces before this sentence belongs to
      the outer previous sentence.|{4}{5}
         <- White spaces here and the line break before them belongs to this sentence,
      not the previous one, since the previous trailing cannot contain line breaks.|{5}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "select", "inner": true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["1-select-inner"](afterDocument);
    } catch (e) {
      notifyDependents["1-select-inner"](undefined);

      throw e;
    }
  });

  test("transition 2 > 2-to-start      ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
          {0}    {1}|{2}I|{0}|{1}'m a sent{2}ence   .        I'm another sentence.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "selectToStart" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["2-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["2-to-start"](undefined);

      throw e;
    }
  });

  test("transition 2 > 2-to-end        ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
          {0}    {1}I'm a sen{2}tence   .        |{0}|{1}|{2}I'm another sentence.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "selectToEnd" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["2-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["2-to-end"](undefined);

      throw e;
    }
  });

  test("transition 2 > 2-select        ", async function () {
    const beforeDocument = await documents["2"];

    if (beforeDocument === undefined) {
      notifyDependents["2-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
              {0}{1}{2}I'm a sentence   .        |{0}|{1}|{2}I'm another sentence.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "select" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["2-select"](afterDocument);
    } catch (e) {
      notifyDependents["2-select"](undefined);

      throw e;
    }
  });

  test("transition 3 > 3-select        ", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      {3}{4}I'm a previous sentence.|{3}|{4}    {0}{1}{2}{5}
              I'm a sentence   .|{0}|{1}|{2}|{5}        I'm another sentence.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "select", "inner": true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["3-select"](afterDocument);
    } catch (e) {
      notifyDependents["3-select"](undefined);

      throw e;
    }
  });

  test("transition 3 > 3-to-start      ", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      |{0}|{1}|{3}|{4}|{5}I'm a previous sente{3}nce.{0}{1}{4}{5}    |{2}
              I'm a sent{2}ence   .        I'm another sentence.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "selectToStart" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["3-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["3-to-start"](undefined);

      throw e;
    }
  });

  test("transition 3 > 3-to-start-inner", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-to-start-inner"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      |{0}|{1}|{3}|{4}|{5}I'm a previous sente{3}nce.{0}{1}{4}{5}    |{2}
              I'm a sent{2}ence   .        I'm another sentence.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "selectToStart", "inner": true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["3-to-start-inner"](afterDocument);
    } catch (e) {
      notifyDependents["3-to-start-inner"](undefined);

      throw e;
    }
  });

  test("transition 3 > 3-to-end        ", async function () {
    const beforeDocument = await documents["3"];

    if (beforeDocument === undefined) {
      notifyDependents["3-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a previous sent{3}ence.  {4}  |{3}{5}
          {0}    {1}I'm a sen{2}tence   .        |{0}|{1}|{2}|{4}|{5}I'm another sentence.
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "selectToEnd" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["3-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["3-to-end"](undefined);

      throw e;
    }
  });

  test("transition 4 > 4-select        ", async function () {
    const beforeDocument = await documents["4"];

    if (beforeDocument === undefined) {
      notifyDependents["4-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      {0}{1}I'm a sentence.|{0}|{1}{2}{3}{4}I'm another sentence
      |{2}|{3}|{4}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "select", "inner": true });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["4-select"](afterDocument);
    } catch (e) {
      notifyDependents["4-select"](undefined);

      throw e;
    }
  });

  test("transition 4 > 4-to-start      ", async function () {
    const beforeDocument = await documents["4"];

    if (beforeDocument === undefined) {
      notifyDependents["4-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      |{0}|{1}|{2}I'm a sente{0}nce.{1}{2}|{3}|{4}I'm anothe{3}r sentence
      {4}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "selectToStart" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["4-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["4-to-start"](undefined);

      throw e;
    }
  });

  test("transition 4 > 4-to-end        ", async function () {
    const beforeDocument = await documents["4"];

    if (beforeDocument === undefined) {
      notifyDependents["4-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sent{0}ence{1}.|{0}|{1}{2}I'm anoth{3}er sentence{4}
      |{2}|{3}|{4}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "selectToEnd" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["4-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["4-to-end"](undefined);

      throw e;
    }
  });

  test("transition 5 > 5-select        ", async function () {
    const beforeDocument = await documents["5"];

    if (beforeDocument === undefined) {
      notifyDependents["5-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      {0}{1}I'm a sentence terminated by two line breaks
      |{0}|{1}
          {2}{3}{4}I'm another sentence|{2}|{3}|{4}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "select" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["5-select"](afterDocument);
    } catch (e) {
      notifyDependents["5-select"](undefined);

      throw e;
    }
  });

  test("transition 5 > 5-to-start      ", async function () {
    const beforeDocument = await documents["5"];

    if (beforeDocument === undefined) {
      notifyDependents["5-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      |{0}|{1}I'm a sentence term{0}inated by two line breaks
      {1}{2}
       {3}   |{4}I|{2}|{3}'m anothe{4}r sentence
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "selectToStart" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["5-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["5-to-start"](undefined);

      throw e;
    }
  });

  test("transition 5 > 5-to-end        ", async function () {
    const beforeDocument = await documents["5"];

    if (beforeDocument === undefined) {
      notifyDependents["5-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sentence ter{0}minated by two line breaks{1}
      |{0}|{1}{2}
       {3}   I'm anoth{4}er sentence|{2}|{3}|{4}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "selectToEnd" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["5-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["5-to-end"](undefined);

      throw e;
    }
  });

  test("transition 6 > 6-to-start      ", async function () {
    const beforeDocument = await documents["6"];

    if (beforeDocument === undefined) {
      notifyDependents["6-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      |{0}|{1}I'm a sentence term{0}inated by two line breaks plus one more
      {1}{2}
      {3}
      |{2}|{3}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "selectToStart" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["6-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["6-to-start"](undefined);

      throw e;
    }
  });

  test("transition 6 > 6-to-end        ", async function () {
    const beforeDocument = await documents["6"];

    if (beforeDocument === undefined) {
      notifyDependents["6-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sentence ter{0}minated by two line breaks plus one more{1}
      |{0}|{1}{2}
      |{2}{3}
      |{3}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "selectToEnd" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["6-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["6-to-end"](undefined);

      throw e;
    }
  });

  test("transition 6 > 6-select        ", async function () {
    const beforeDocument = await documents["6"];

    if (beforeDocument === undefined) {
      notifyDependents["6-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      {0}{1}I'm a sentence terminated by two line breaks plus one more
      |{0}|{1}{2}
      {3}
      |{2}|{3}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "select" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["6-select"](afterDocument);
    } catch (e) {
      notifyDependents["6-select"](undefined);

      throw e;
    }
  });

  test("transition 7 > 7-to-start      ", async function () {
    const beforeDocument = await documents["7"];

    if (beforeDocument === undefined) {
      notifyDependents["7-to-start"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      |{0}I'm a sentence at end of document
      {0}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "selectToStart" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["7-to-start"](afterDocument);
    } catch (e) {
      notifyDependents["7-to-start"](undefined);

      throw e;
    }
  });

  test("transition 7 > 7-to-end        ", async function () {
    const beforeDocument = await documents["7"];

    if (beforeDocument === undefined) {
      notifyDependents["7-to-end"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      I'm a sentence at end of document{0}
      |{0}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "selectToEnd" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["7-to-end"](afterDocument);
    } catch (e) {
      notifyDependents["7-to-end"](undefined);

      throw e;
    }
  });

  test("transition 7 > 7-select        ", async function () {
    const beforeDocument = await documents["7"];

    if (beforeDocument === undefined) {
      notifyDependents["7-select"](undefined);
      this.skip();
    }

    const afterDocument = ExpectedDocument.parseIndented(6, String.raw`
      |{0}I'm a sentence at end of document
      {0}
    `);

    try {
      // Set-up document to be in expected initial state.
      await beforeDocument.apply(editor);

      // Perform all operations.
      await executeCommand("dance.seek.object", { "object": "sentence", "action": "select" });

      // Ensure document is as expected.
      afterDocument.assertEquals(editor);

      // Test passed, allow dependent tests to run.
      notifyDependents["7-select"](afterDocument);
    } catch (e) {
      notifyDependents["7-select"](undefined);

      throw e;
    }
  });
});
