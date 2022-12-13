import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/seek-object-sentence.md", function () {
  // Set up document.
  let document: vscode.TextDocument,
      editor: vscode.TextEditor;

  this.beforeAll(async () => {
    document = await vscode.workspace.openTextDocument({ language: "plaintext" });
    editor = await vscode.window.showTextDocument(document);
    editor.options.insertSpaces = true;
    editor.options.tabSize = 2;

    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });
  });

  this.afterAll(async () => {
    await executeCommand("workbench.action.closeActiveEditor");
  });

  test("1 > to-end", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      A sentence starts with a non-blank character or a line break. <== It ends with a
      | 0
      punctuation mark like the previous one, or two consecutive line breaks like this
                                         | 1

      An outer sentence also contains the trailing blank characters (but never line
      |^^^^^^^^^^^^^^^^ 2
      breaks) like this.       <== The white spaces before this sentence belongs to
                           ^ 3
      the outer previous sentence.
                       ^ 4
         <- White spaces here and the line break before them belongs to this sentence,
            |^^^^^^^^^^^^^^^^^^^^^ 5
      not the previous one, since the previous trailing cannot contain line breaks.
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "end" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:22:1", 6, String.raw`
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
            ^ 3
      not the previous one, since the previous trailing cannot contain line breaks.
                                                                                  ^ 3
    `);
  });

  test("1 > to-start", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      A sentence starts with a non-blank character or a line break. <== It ends with a
      | 0
      punctuation mark like the previous one, or two consecutive line breaks like this
                                         | 1

      An outer sentence also contains the trailing blank characters (but never line
      |^^^^^^^^^^^^^^^^ 2
      breaks) like this.       <== The white spaces before this sentence belongs to
                           ^ 3
      the outer previous sentence.
                       ^ 4
         <- White spaces here and the line break before them belongs to this sentence,
            |^^^^^^^^^^^^^^^^^^^^^ 5
      not the previous one, since the previous trailing cannot contain line breaks.
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:44:1", 6, String.raw`
      A sentence starts with a non-blank character or a line break. <== It ends with a
      | 0                                                           |^^^^^^^^^^^^^^^^^^ 1
      punctuation mark like the previous one, or two consecutive line breaks like this
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 1

      An outer sentence also contains the trailing blank characters (but never line
      |^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 2
      breaks) like this.       <== The white spaces before this sentence belongs to
      ^^^^^^^^^^^^^^^^^^^^^^ 2 |^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 3
      the outer previous sentence.
      ^^^^^^^^^^^^^^^^^^ 3        | 4
         <- White spaces here and the line break before them belongs to this sentence,
      ^^^^^^ 4
      not the previous one, since the previous trailing cannot contain line breaks.
    `);
  });

  test("1 > select-inner", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      A sentence starts with a non-blank character or a line break. <== It ends with a
      | 0
      punctuation mark like the previous one, or two consecutive line breaks like this
                                         | 1

      An outer sentence also contains the trailing blank characters (but never line
      |^^^^^^^^^^^^^^^^ 2
      breaks) like this.       <== The white spaces before this sentence belongs to
                           ^ 3
      the outer previous sentence.
                       ^ 4
         <- White spaces here and the line break before them belongs to this sentence,
            |^^^^^^^^^^^^^^^^^^^^^ 5
      not the previous one, since the previous trailing cannot contain line breaks.
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", inner: true });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:66:1", 6, String.raw`
      A sentence starts with a non-blank character or a line break. <== It ends with a
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
                                                                    ^^^^^^^^^^^^^^^^^^^ 1
      punctuation mark like the previous one, or two consecutive line breaks like this
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 1

      An outer sentence also contains the trailing blank characters (but never line
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 2
      breaks) like this.       <== The white spaces before this sentence belongs to
      ^^^^^^^^^^^^^^^^^ 2      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 3
      the outer previous sentence.
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^ 3
                                  ^ 4
         <- White spaces here and the line break before them belongs to this sentence,
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 4
      not the previous one, since the previous trailing cannot contain line breaks.
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 4
    `);
  });

  test("2 > to-start", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
              I'm a sentence   .        I'm another sentence.
          | 0 ^ 1      |^^^ 2
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:109:1", 6, String.raw`
              I'm a sentence   .        I'm another sentence.
          ^^^^ 0
              ^^^^^^^^^ 1
    `);
  });

  test("2 > to-end", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
              I'm a sentence   .        I'm another sentence.
          | 0 ^ 1      |^^^ 2
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "end" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:120:1", 6, String.raw`
              I'm a sentence   .        I'm another sentence.
          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
    `);
  });

  test("2 > select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
              I'm a sentence   .        I'm another sentence.
          | 0 ^ 1      |^^^ 2
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:130:1", 6, String.raw`
              I'm a sentence   .        I'm another sentence.
              ^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
    `);
  });

  test("3 > select-inner", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a previous sentence.    
                         |^^^ 3 ^ 4
                                  ^ 5
              I'm a sentence   .        I'm another sentence.
          ^ 0 ^ 1      |^^^ 2
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", inner: true });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:161:1", 6, String.raw`
      I'm a previous sentence.    
      ^^^^^^^^^^^^^^^^^^^^^^^ 0   ^ 1
              I'm a sentence   .        I'm another sentence.
      ^^^^^^^^^^^^^^^^^^^^^^^^^ 1
    `);
  });

  test("3 > to-start", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a previous sentence.    
                         |^^^ 3 ^ 4
                                  ^ 5
              I'm a sentence   .        I'm another sentence.
          ^ 0 ^ 1      |^^^ 2
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:177:1", 6, String.raw`
      I'm a previous sentence.    
      |^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
              I'm a sentence   .        I'm another sentence.
      ^^^^^^^^^^^^^^^^^ 0
    `);
  });

  test("3 > to-start-inner", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a previous sentence.    
                         |^^^ 3 ^ 4
                                  ^ 5
              I'm a sentence   .        I'm another sentence.
          ^ 0 ^ 1      |^^^ 2
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start", inner: true });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:195:1", 6, String.raw`
      I'm a previous sentence.    
      |^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
              I'm a sentence   .        I'm another sentence.
      ^^^^^^^^^^^^^^^^^ 0
    `);
  });

  test("3 > to-end", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a previous sentence.    
                         |^^^ 3 ^ 4
                                  ^ 5
              I'm a sentence   .        I'm another sentence.
          ^ 0 ^ 1      |^^^ 2
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "end" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:210:1", 6, String.raw`
      I'm a previous sentence.    
                         ^^^^^^^^^^ 0
              I'm a sentence   .        I'm another sentence.
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
    `);
  });

  test("4 > select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a sentence.I'm another sentence
             ^^^^ 0 ^ 1       ^ 3        | 4
                     ^ 2

    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:243:1", 6, String.raw`
      I'm a sentence.I'm another sentence
      ^^^^^^^^^^^^^^^ 0
                     ^^^^^^^^^^^^^^^^^^^^^ 1

    `);
  });

  test("4 > to-start", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a sentence.I'm another sentence
             ^^^^ 0 ^ 1       ^ 3        | 4
                     ^ 2

    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:258:1", 6, String.raw`
      I'm a sentence.I'm another sentence
      |^^^^^^^^^^^^^^ 0
                     |^^^^^^^^^^^^^^^^^^^ 1

    `);
  });

  test("4 > to-end", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a sentence.I'm another sentence
             ^^^^ 0 ^ 1       ^ 3        | 4
                     ^ 2

    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "end" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:274:1", 6, String.raw`
      I'm a sentence.I'm another sentence
                 ^^^^ 0
                     ^^^^^^^^^^^^^^^^^^^^^ 1

    `);
  });

  test("5 > select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a sentence terminated by two line breaks
                        |^^^^^ 0                  ^ 1

      ^ 2
          I'm another sentence
       ^ 3         |^^^^^ 4
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:308:1", 6, String.raw`
      I'm a sentence terminated by two line breaks
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

          I'm another sentence
          ^^^^^^^^^^^^^^^^^^^^ 1
    `);
  });

  test("5 > to-start", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a sentence terminated by two line breaks
                        |^^^^^ 0                  ^ 1

      ^ 2
          I'm another sentence
       ^ 3         |^^^^^ 4
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:321:1", 6, String.raw`
      I'm a sentence terminated by two line breaks
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

          I'm another sentence
      ^^^^ 1
          ^^^^^^^^^ 2
    `);
  });

  test("5 > to-end", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a sentence terminated by two line breaks
                        |^^^^^ 0                  ^ 1

      ^ 2
          I'm another sentence
       ^ 3         |^^^^^ 4
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "end" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:338:1", 6, String.raw`
      I'm a sentence terminated by two line breaks
                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

      ^ 1
          I'm another sentence
      ^^^^^^^^^^^^^^^^^^^^^^^^ 1
    `);
  });

  test("6 > to-start", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a sentence terminated by two line breaks plus one more
                        |^^^^^ 0                                ^ 1

      ^ 2

      | 3
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:373:1", 6, String.raw`
      I'm a sentence terminated by two line breaks plus one more
      |^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0


      | 1
    `);
  });

  test("6 > to-end", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a sentence terminated by two line breaks plus one more
                        |^^^^^ 0                                ^ 1

      ^ 2

      | 3
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "end" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:386:1", 6, String.raw`
      I'm a sentence terminated by two line breaks plus one more
                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

      | 1

      | 2
    `);
  });

  test("6 > select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a sentence terminated by two line breaks plus one more
                        |^^^^^ 0                                ^ 1

      ^ 2

      | 3
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:400:1", 6, String.raw`
      I'm a sentence terminated by two line breaks plus one more
      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0


      | 1
    `);
  });

  test("7 > to-start", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a sentence at end of document

      | 0
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "start" });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:424:1", 6, String.raw`
      I'm a sentence at end of document
      |^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

    `);
  });

  test("7 > to-end", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a sentence at end of document

      | 0
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)", where: "end" });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:435:1", 6, String.raw`
      I'm a sentence at end of document
                                       ^ 0

    `);
  });

  test("7 > select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      I'm a sentence at end of document

      | 0
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.object", { input: "(?#predefined=sentence)" });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-sentence.md:446:1", 6, String.raw`
      I'm a sentence at end of document
      |^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

    `);
  });

  groupTestsByParentName(this);
});
