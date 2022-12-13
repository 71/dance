import * as vscode from "vscode";

import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

suite("./test/suite/commands/seek-object-between.md", function () {
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
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "end" });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-between.md:20:1", 6, String.raw`
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
  });

  test("1 > to-end-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
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
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "end", shift: "extend" });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-between.md:42:1", 6, String.raw`
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
  });

  test("1 > to-end-inner", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
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
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "end", inner: true });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-between.md:64:1", 6, String.raw`
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
  });

  test("1 > to-end-inner-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
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
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "end", inner: true, shift: "extend" });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-between.md:86:1", 6, String.raw`
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
  });

  test("1 > to-start", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
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
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "start" });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-between.md:108:1", 6, String.raw`
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
  });

  test("1 > to-start-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
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
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "start", shift: "extend" });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-between.md:130:1", 6, String.raw`
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
  });

  test("1 > to-start-inner", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
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
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "start", inner: true });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-between.md:152:1", 6, String.raw`
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
  });

  test("1 > to-start-inner-extend", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
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
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", where: "start", inner: true, shift: "extend" });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-between.md:174:1", 6, String.raw`
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
  });

  test("1 > select", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
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
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)" });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-between.md:196:1", 6, String.raw`
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
  });

  test("1 > select-inner", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
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
    `);

    // Perform all operations.
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "character" });
    await executeCommand("dance.seek.object", { input: "\\((?#inner)\\)", inner: true });
    await executeCommand("dance.dev.setSelectionBehavior", { mode: "normal", value: "caret" });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-between.md:217:1", 6, String.raw`
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
  });

  test("2 > select-inner", async function () {
    // Set-up document to be in expected initial state.
    await ExpectedDocument.apply(editor, 6, String.raw`
      {
        "foo": {
          "bar": 0,
        },
        "baz": null,
         | 0
      }
    `);

    // Perform all operations.
    await executeCommand("dance.seek.object", { input: "\\{(?#inner)\\}", inner: true });

    // Ensure document is as expected.
    ExpectedDocument.assertEquals(editor, "./test/suite/commands/seek-object-between.md:250:1", 6, String.raw`
      {
       ^ 0
        "foo": {
          "bar": 0,
        },
        "baz": null,
                    ^ 0
      }
    `);
  });

  groupTestsByParentName(this);
});
