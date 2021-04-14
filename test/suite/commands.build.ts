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
          { headerTitle, initialCode, tests } = parseMarkdownTests(contents),
          testNamePadding = longestStringLength((x) => x.title, tests),
          comesAfterPadding = longestStringLength((x) => x.comesAfter, tests);

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
        });

        // Each test sets up using its previous document, and notifies its
        // dependents that it is done by writing its document to \`documents\`.
        // This ensures that tests are executed in the right order, and that we skip
        // tests whose dependencies failed.
        const notifyDependents: Record<string, (document: ExpectedDocument | undefined) => void> = {},
              documents: Record<string, Promise<ExpectedDocument | undefined>> = {
                "${headerTitle}": Promise.resolve(${stringifyExpectedDocument(initialCode, 18, 12)}),

                ${tests.map(({ title }) =>
                  `"${title}": new Promise((resolve) => notifyDependents["${title}"] = resolve),`,
                ).join("\n" + " ".repeat(16))}
              };

        ${tests.map((test) => {
          const comesAfter = test.comesAfter.padEnd(comesAfterPadding),
                title = test.title.padEnd(testNamePadding);

          return unindent(4, `
            test("transition ${comesAfter} > ${title}", async function () {
              const beforeDocument = await documents["${test.comesAfter}"];

              if (beforeDocument === undefined) {
                notifyDependents["${test.title}"](undefined);
                this.skip();
              }

              const afterDocument = ${stringifyExpectedDocument(test.code, 16, 6)};

              try {
                // Set-up document to be in expected initial state.
                await beforeDocument.apply(editor);

                // Perform all operations.${"\n"
                  + stringifyOperations(test).replace(/^/g, " ".repeat(16))}
                // Ensure document is as expected.
                afterDocument.assertEquals(editor);

                // Test passed, allow dependent tests to run.
                notifyDependents["${title}"](afterDocument);
              } catch (e) {
                notifyDependents["${title}"](undefined);

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
  comesAfter: string;
  operations: TestOperation[];
  flags: TestOperation[];
  code: string;
}

function parseMarkdownTests(contents: string) {
  const header = /^# (.+)\n([\s\S]+?)^```\n([\s\S]+?)^```\n/m.exec(contents);

  assert(header);

  const [_, badHeaderTitle, headerFlagsString, initialCode] = header,
        headerTitle = badHeaderTitle.replace(/\s/g, "-"),
        headerFlags = execAll(/^> *(.+)$/gm, headerFlagsString).map(([_, flag]) => flag);

  contents = contents.slice(header[0].length);

  const re = /^# (.+)\n\[.+?\]\(#(.+?)\)\n([\s\S]+?)^```\n([\s\S]+?)^```\n/gm,
        opre = /^([->]) *([\w.:]+)( +.+)?$/gm,
        tests = [] as Test[];

  for (const [_, badTitle, comesAfter, operationsText, after] of execAll(re, contents)) {
    const title = badTitle.replace(/\s/g, "-"),
          operations = [] as TestOperation[],
          flags = [] as TestOperation[];

    for (const [_, pre, command, args] of execAll(opre, operationsText)) {
      if (pre === ">") {
        flags.push({ command, args });
      } else {
        operations.push({ command, args });
      }
    }

    tests.push({ title, comesAfter, code: after, operations, flags });
  }

  assert.strictEqual(execAll(/^# /gm, contents).length, tests.length);

  return { headerTitle, headerFlags, initialCode, tests };
}

function stringifyOperations(test: Test) {
  const operations = test.operations;
  let text = "";

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i],
          argsString = operation.args ? `, ${operation.args}` : "";
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
      text += `await Promise.all([${promises.map((x) => `\n  ${x},`)}]);`;
    }
  }

  return text;
}
