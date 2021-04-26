import * as assert from "assert";
import * as fs     from "fs/promises";
import * as path   from "path";

import { unindent } from "../../meta";
import { execAll, longestStringLength, stringifyExpectedDocument } from "./build-utils";

export async function build() {
  const commandsDir = path.join(__dirname, "commands"),
        fileNames = await fs.readdir(commandsDir);

  for (const file of fileNames.filter((f) => f.endsWith(".md"))) {
    const filePath = path.resolve(commandsDir, file),
          contents = await fs.readFile(filePath, "utf-8"),
          { setups, tests } = parseMarkdownTests(contents),
          testNamePadding = longestStringLength((x) => x.title, tests),
          comesAfterPadding = longestStringLength((x) => x.comesAfter.title, tests);

    await fs.writeFile(filePath.replace(/\.md$/, ".test.ts"), unindent(6, `\
      import * as vscode from "vscode";

      import { ExpectedDocument } from "../utils";

      const executeCommand = vscode.commands.executeCommand;

      suite("${path.basename(file)}", function () {
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
        // dependents that it is done by writing its document to \`documents\`.
        // This ensures that tests are executed in the right order, and that we skip
        // tests whose dependencies failed.
        const notifyDependents: Record<string, (document: ExpectedDocument | undefined) => void> = {},
              documents: Record<string, Promise<ExpectedDocument | undefined>> = {
                ${setups.map(({ title, code }) =>
                  `"${title}": Promise.resolve(${stringifyExpectedDocument(code, 18, 12)}),`,
                ).join("\n" + " ".repeat(16))}

                ${tests.map(({ title }) =>
                  `"${title}": new Promise((resolve) => notifyDependents["${title}"] = resolve),`,
                ).join("\n" + " ".repeat(16))}
              };
        ${tests.map((test) => {
          const paddedComesAfter = test.comesAfter.title.padEnd(comesAfterPadding),
                paddedTitle = test.title.padEnd(testNamePadding);

          return unindent(4, `
            test("transition ${paddedComesAfter} > ${paddedTitle}", async function () {
              const beforeDocument = await documents["${test.comesAfter.title}"];

              if (beforeDocument === undefined) {
                notifyDependents["${test.title}"](undefined);
                this.skip();
              }

              const afterDocument = ${stringifyExpectedDocument(test.code, 16, 6)};

              try {
                // Set-up document to be in expected initial state.
                await beforeDocument.apply(editor);

                // Perform all operations.${"\n"
                  + stringifyOperations(test).replace(/^/gm, " ".repeat(16))}
                // Ensure document is as expected.
                afterDocument.assertEquals(editor);

                // Test passed, allow dependent tests to run.
                notifyDependents["${test.title}"](afterDocument);
              } catch (e) {
                notifyDependents["${test.title}"](undefined);

                throw e;
              }
            });`);
        }).join("\n")}
      });
    `));
  }
}

interface TestOperation {
  command: string;
  args?: string;
}

interface Test {
  title: string;
  comesAfter: Test | InitialDocument;
  operations: TestOperation[];
  flags: string[];
  code: string;
  behavior: "caret" | "character";
}

interface InitialDocument {
  title: string;
  flags: string[];
  code: string;
  behavior: "caret" | "character";
}

function parseMarkdownTests(contents: string) {
  const re = /^# (.+)\n(?:\[.+?\]\(#(.+?)\)\n)?([\s\S]+?)^```\n([\s\S]+?)^```\n/gm,
        opre = /^- *([\w.:]+)( +.+)?$|^> *(.+)$/gm,
        initial = [] as InitialDocument[],
        tests = [] as Test[],
        all = new Map<string, Test | InitialDocument>();

  for (const [_, badTitle, comesAfterTitle, operationsText, after] of execAll(re, contents)) {
    const title = badTitle.replace(/\s/g, "-");

    assert(!all.has(title), `document state "${title}" is defined multiple times`);

    if (comesAfterTitle === undefined) {
      const flags = execAll(/^> *(.+)$/gm, operationsText).map(([_, flag]) => flag),
            behavior = getBehavior(flags) ?? "caret",
            data: InitialDocument = { title, flags, code: after, behavior };

      initial.push(data);
      all.set(title, data);
      continue;
    }

    const operations = [] as TestOperation[],
          flags = [] as string[];

    for (const [_, command, args, flag] of execAll(opre, operationsText)) {
      if (flag) {
        flags.push(flag);
      } else {
        operations.push({ command, args });
      }
    }

    const comesAfter = all.get(comesAfterTitle);

    assert(comesAfter !== undefined, `test "${title}" depends on unknown test "${comesAfterTitle}"`);

    const behavior = getBehavior(flags) ?? comesAfter.behavior,
          data: Test = { title, comesAfter, code: after, operations, flags, behavior };

    tests.push(data);
    all.set(title, data);
  }

  assert.strictEqual(
    execAll(/^# /gm, contents).length,
    tests.length + initial.length,
    "not all tests were parsed",
  );

  return { setups: initial, tests };
}

function getBehavior(flags: string[]) {
  const indexOfCharacter = flags.indexOf("behavior <- character");

  if (indexOfCharacter !== -1) {
    flags.splice(indexOfCharacter, 1);

    return "character";
  }

  const indexOfCaret = flags.indexOf("behavior <- caret");

  if (indexOfCaret !== -1) {
    flags.splice(indexOfCaret, 1);

    return "caret";
  }

  return undefined;
}

function stringifyOperations(test: Test) {
  const operations = test.operations;
  let text = "",
      textEnd = "";

  for (const flag of test.flags) {
    switch (flag) {
    case "debug":
      text += "debugger;\n";
      break;

    default:
      throw new Error("unrecognized flag " + JSON.stringify(flag));
    }
  }

  if (test.behavior === "character") {
    text += `await executeCommand("dance.dev.setSelectionBehavior", `
          + `{ mode: "normal", value: "character" });\n`;
    textEnd += `await executeCommand("dance.dev.setSelectionBehavior", `
             + `{ mode: "normal", value: "caret" });\n`;
  }

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i],
          argsString = operation.args ? `,${operation.args}` : "";
    let command = operation.command;

    if (command[0] === ".") {
      command = `dance${command}`;
    }

    const promises = [
      `executeCommand(${JSON.stringify(command)}${argsString})`,
    ];

    while (i + 1 < operations.length && operations[i + 1].command.startsWith("type:")) {
      const text = operations[++i].command[5];

      promises.push(
        `new Promise((resolve) => setTimeout(() => executeCommand("type", { text: ${
          JSON.stringify(text)} }).then(resolve), ${promises.length * 20}))`,
      );
    }

    if (promises.length === 1) {
      text += `await ${promises[0]};\n`;
    } else {
      text += `await Promise.all([${promises.map((x) => `\n  ${x},`)}]);\n`;
    }
  }

  return text + textEnd;
}
