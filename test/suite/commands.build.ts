import * as assert from "assert";
import * as fs     from "fs/promises";
import * as path   from "path";

import { unindent } from "../../meta";
import { execAll, stringifyExpectedDocument } from "./build-utils";

export async function build() {
  const commandsDir = path.join(__dirname, "commands"),
        fileNames = await fs.readdir(commandsDir);

  for (const file of fileNames.filter((f) => f.endsWith(".md"))) {
    const filePath = path.resolve(commandsDir, file),
          contents = await fs.readFile(filePath, "utf-8"),
          { tests } = parseMarkdownTests(contents);

    await fs.writeFile(filePath.replace(/\.md$/, ".test.ts"), unindent(6)`\
      import * as vscode from "vscode";

      import { executeCommand, ExpectedDocument, groupTestsByParentName } from "../utils";

      suite("./test/suite/commands/${path.basename(file)}", function () {
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
        ${tests.map((test) => {
          return unindent(10)`
            test("${test.titleParts.join(" > ")}", async function () {
              // Set-up document to be in expected initial state.
              await ExpectedDocument.apply(editor, ${replaceInTest(
                test.comesAfter, stringifyExpectedDocument(test.comesAfter.code, 4))});

              // Perform all operations.${"\n"
                + stringifyOperations(test).replace(/^/gm, " ".repeat(4))}
              // Ensure document is as expected.
              ExpectedDocument.assertEquals(editor, "./test/suite/commands/${
                path.basename(file)}:${test.line + 1}:1", ${replaceInTest(
                test, stringifyExpectedDocument(test.code, 4))});
            });`;
        }).join("\n")}

        groupTestsByParentName(this);
      });
    `);
  }
}

interface TestOperation {
  command: string;
  args?: string;
}

interface Section {
  line: number;
  title: string;
  code: string;
  debug?: boolean;
  replacements?: [RegExp, string][];
  behavior: "caret" | "character";
}

interface Test extends Section {
  titleParts: string[];
  comesAfter: Section;
  operations: TestOperation[];
}

interface InitialDocument extends Section {
}

function parseMarkdownTests(contents: string) {
  const re = /^#+ (.+)\n(?:\[.+?\]\(#(.+?)\)\n)?([\s\S]+?)^```\n([\s\S]+?)^```\n/gm,
        opre = /^- *([\w.:]+)( +.+)?$|^> *(.+)$/gm,
        initial = [] as InitialDocument[],
        tests = [] as Test[],
        all = new Map<string, Test | InitialDocument>(),
        lines = contents.split("\n");
  let currentLine = 0;

  for (const [text, badTitle, comesAfterTitle, operationsText, after] of execAll(re, contents)) {
    const title = badTitle.replace(/\s/g, "-");

    assert(!all.has(title), `document state "${title}" is defined multiple times`);

    const titleParts = badTitle.split(" "),
          nesting = /^#+/.exec(text)![0].length;

    if (titleParts.length !== nesting && titleParts.length <= 6) {
      console.warn(`section "${title}" has ${titleParts} parts but a nesting of ${nesting}`);
    }

    const line = lines.indexOf(text.slice(0, text.indexOf("\n")), currentLine);
    currentLine = line + 1;

    if (comesAfterTitle === undefined) {
      if (nesting !== 1) {
        console.warn("an initial section should have a top-level header");
      }

      const flags = execAll(/^> *(.+)$/gm, operationsText).map(([_, flag]) => flag),
            behavior = getBehavior(flags) ?? "caret",
            data: InitialDocument = { title, code: after, behavior, line };

      applyFlags(flags, data);

      initial.push(data);
      all.set(title, data);
      continue;
    }

    const lastTitlePart = /\S+$/.exec(badTitle)![0],
          expectedTitle = comesAfterTitle + "-" + lastTitlePart;

    if (title !== expectedTitle) {
      console.warn(`section "${title}" should be called "${expectedTitle}"`);
    }

    if (!/^([a-z]+)(-([a-z]+|\d+))*$/.test(lastTitlePart)) {
      console.warn(`section "${title}" has an invalid name`);
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
          data: Test = { title, comesAfter, code: after, operations, behavior, titleParts, line };

    applyFlags(flags, data);

    tests.push(data);
    all.set(title, data);
  }

  assert.strictEqual(
    execAll(/^#+ /gm, contents).length,
    tests.length + initial.length,
    "not all tests were parsed",
  );

  return { setups: initial, tests };
}

function applyFlags(flags: readonly string[], section: Section) {
  for (const flag of flags) {
    if (flag.startsWith("/")) {
      const split = flag.slice(1).split(/(?<!\\)\//),
            pattern = split[0],
            replacement = split[1].replace(/\\\//g, "/"),
            flags = split[2] ?? "gu",
            re = new RegExp(pattern, flags);

      if (section.replacements === undefined) {
        section.replacements = [];
      }

      section.replacements.push([re, replacement]);

      continue;
    }

    switch (flag) {
    case "debug":
      section.debug = true;
      break;

    default:
      throw new Error("unrecognized flag " + JSON.stringify(flag));
    }
  }
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

function replaceInTest(test: Section | undefined, text: string) {
  while (test !== undefined) {
    if (test.replacements !== undefined) {
      for (const [re, replacement] of test.replacements) {
        text = text.replace(re, replacement);
      }
    }

    test = (test as Test).comesAfter;
  }

  return text;
}

function stringifyOperations(test: Test) {
  const operations = test.operations;
  let text = "",
      textEnd = "";

  if (test.debug) {
    text += "debugger;\n";
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

  return replaceInTest(test, text + textEnd);
}
