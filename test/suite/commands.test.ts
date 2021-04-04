import * as assert from "assert";
import * as fs     from "fs";
import * as path   from "path";
import * as vscode from "vscode";

import { Command } from "../../commands";
import { CommandDescriptor } from "../../src/commands";
import { extensionState } from "../../src/extension";
import { SelectionBehavior } from "../../src/state/extension";
import { ExpectedDocument, execAll, longestStringLength } from "./utils";

export namespace testCommands {
  export interface Mutation {
    readonly commands: readonly (string | { readonly command: string; readonly args: any[] })[];
    readonly contentAfterMutation: string;
  }

  export interface Options {
    readonly initialContent: string;
    readonly mutations: readonly Mutation[];
    readonly selectionBehavior: SelectionBehavior;
    readonly allowErrors: boolean;
  }
}

interface TestOperation {
  command: string;
  args: any[];
}

interface Test {
  title: string;
  comesAfter: string;
  operations: TestOperation[];
  flags: TestOperation[];
  code: string;
}

/**
 * Used to indicate the anchor ("{0}") and active ("|{0}") carets of each
 * selection in the document. e.g. "a{0}bcd|{0}ef" indicates "bcd" selected.
 */
const selectionMarkerRegexp = /(\|)?{(\d+)}/g;

/*
 * Used to mark the end of line, which helps to indicate trailing whitespace
 * on a line or (trailing) empty lines (if placed by itself on a line).
 */
const eolMarkerRegexp = /{EOL}/g;

function getPlainContent(templatedContent: string) {
  return templatedContent
    .trimRight()
    .replace(eolMarkerRegexp, "")
    .replace(selectionMarkerRegexp, "");
}

function getSelections(document: vscode.TextDocument, templatedContent: string) {
  const anchorPositions = [] as vscode.Position[];
  const activePositions = [] as vscode.Position[];

  let match: RegExpExecArray | null = null;
  let diff = 0;

  const contentAndSelections = templatedContent.trimRight().replace(eolMarkerRegexp, "");

  while ((match = selectionMarkerRegexp.exec(contentAndSelections))) {
    const index = +match[2];

    if (match[1] === "|") {
      activePositions[index] = document.positionAt(match.index - diff);

      if (anchorPositions[index] === undefined) {
        anchorPositions[index] = activePositions[index];
      }
    } else {
      anchorPositions[index] = document.positionAt(match.index - diff);
    }

    diff += match[0].length;
  }

  return Array.from(anchorPositions, (anchor, i) => {
    if (!anchor) {
      throw new Error(`Selection ${i} is not specified.`);
    }
    return new vscode.Selection(anchor, activePositions[i]);
  });
}

function stringifySelection(document: vscode.TextDocument, selection: vscode.Selection) {
  const content = document.getText();
  const startOffset = document.offsetAt(selection.start),
        endOffset = document.offsetAt(selection.end),
        [startString, endString] = selection.isReversed ? ["|", "<"] : [">", "|"];

  if (selection.isEmpty) {
    return content.substring(0, startOffset) + "|" + content.substring(startOffset);
  } else {
    return (
      content.substring(0, startOffset)
      + startString
      + content.substring(startOffset, endOffset)
      + endString
      + content.substring(endOffset)
    );
  }
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

    for (const [_, pre, command, argsString] of execAll(opre, operationsText)) {
      const parsedArgs = argsString === undefined ? [] : JSON.parse(argsString),
            args = Array.isArray(parsedArgs) ? parsedArgs : [parsedArgs];

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

async function performOperations(test: Test) {
  const operations = test.operations;

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];
    let command = operation.command;

    if (command[0] === ".") {
      command = `dance${command}`;
    }

    const promises = [vscode.commands.executeCommand(command, ...operation.args)];

    while (i + 1 < operations.length && operations[i + 1].command.startsWith("type:")) {
      const text = operations[++i].command[5];

      promises.push(
        new Promise((resolve) =>
          setTimeout(
            () => vscode.commands.executeCommand("type", { text }).then(resolve),
            promises.length * 20,
          ),
        ),
      );
    }

    await Promise.all(promises);
  }
}

async function testCommands(
  editor: vscode.TextEditor,
  { initialContent, mutations, selectionBehavior, allowErrors }: testCommands.Options,
) {
  // @ts-ignore
  extensionState._selectionBehavior = selectionBehavior;
  CommandDescriptor.throwOnError = !allowErrors;

  const content = getPlainContent(initialContent);
  const document = editor.document;

  await editor.edit((builder) =>
    builder.replace(
      new vscode.Range(
        new vscode.Position(0, 0),
        document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end,
      ),
      content,
    ),
  );

  // Set up initial selections.
  const initialSelections = getSelections(document, initialContent);

  editor.selections = initialSelections;

  // For each mutation...
  let mutationIndex = 1;

  for (const { commands, contentAfterMutation } of mutations) {
    // Execute commands.
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      const { command: commandName, args }
        = typeof command === "string" ? { command, args: [] } : command;

      const promise = vscode.commands.executeCommand(commandName, ...args);

      while (
        i < commands.length - 1
        && typeof commands[i + 1] === "string"
        && (commands[i + 1] as string).startsWith("type:")
      ) {
        await new Promise((resolve) => {
          setTimeout(() => {
            vscode.commands
              .executeCommand("type", { text: (commands[i + 1] as string)[5] })
              .then(resolve);
          }, 20);
        });

        i++;
      }

      await promise;
    }

    // Ensure resulting text is valid.
    const prefix = mutations.length === 1 ? "" : `After ${mutationIndex} mutation(s):\n  `;

    const expectedContent = getPlainContent(contentAfterMutation);

    assert.strictEqual(
      document.getText(),
      expectedContent,
      `${prefix}Document text is not as expected.`,
    );

    // Set up expected selections.
    const expectedSelections = getSelections(document, contentAfterMutation);

    // Ensure resulting selections are right.
    assert.strictEqual(
      editor.selections.length,
      expectedSelections.length,
      `${prefix}Expected ${expectedSelections.length} selection(s), `
      + `but had ${editor.selections.length}.`,
    );

    for (let i = 0; i < expectedSelections.length; i++) {
      if (editor.selections[i].isEqual(expectedSelections[i])) {
        continue;
      }

      const expected = stringifySelection(document, expectedSelections[i]);
      const actual = stringifySelection(document, editor.selections[i]);

      assert.strictEqual(
        actual,
        expected,
        `${prefix}Expected Selection #${i} to match ('>' is anchor, '|' is cursor).`,
      );
      // If stringified results are the same, throw message using strict equal.
      assert.deepStrictEqual(
        editor.selections[i],
        expectedSelections[i],
        `(Actual Selection #${i} is at same spots in document as expected, `
        + `but with different numbers)`,
      );
      assert.fail();
    }

    mutationIndex++;
  }
}

suite("Commands tests", function () {
  let document: vscode.TextDocument;
  let editor: vscode.TextEditor;

  this.beforeAll(async () => {
    document = await vscode.workspace.openTextDocument();
    editor = await vscode.window.showTextDocument(document);
  });

  // Make sure that errors aren't caught and displayed as messages during tests.
  extensionState.runSafely = (f) => f();
  extensionState.runPromiseSafely = (f) => f();

  suite("misc", function () {
    test("work correctly", async function () {
      await testCommands(editor, {
        initialContent: `{0}f|{0}oo`,
        mutations: [{ contentAfterMutation: `{0}fo|{0}o`, commands: [Command.rightExtend] }],
        selectionBehavior: SelectionBehavior.Character,
        allowErrors: false,
      });
    });

    test("catch errors correctly", async function () {
      try {
        await testCommands(editor, {
          initialContent: `|{0}foo`,
          mutations: [{ contentAfterMutation: `|{0}foo`, commands: [Command.rightExtend] }],
          selectionBehavior: SelectionBehavior.Character,
          allowErrors: false,
        });
      } catch (err) {
        if (
          err instanceof Error
          && err.message === `Expected Selection #0 to match ('>' is anchor, '|' is cursor).`
        ) {
          return;
        }

        throw err;
      }

      assert.fail(`Expected error.`);
    });
  });

  const basedir = this.file!.replace("\\out\\", "\\").replace("/out/", "/").replace(".test.js", ""),
        fileNames = fs.readdirSync(basedir),
        fileNamePadding = longestStringLength((x) => x, fileNames);

  for (const file of fileNames) {
    if (file.endsWith(".md")) {
      const fullPath = path.join(basedir, file),
            contents = fs.readFileSync(fullPath, "utf-8"),
            { headerTitle, initialCode, tests } = parseMarkdownTests(contents),
            initialDocument = ExpectedDocument.parse(initialCode),
            testNamePadding = longestStringLength((x) => x.title, tests),
            comesAfterPadding = longestStringLength((x) => x.comesAfter, tests);

      suite(file, function () {
        // Use promises to:
        // 1. Ensure that tests are executed in the right order.
        // 2. Skip tests when their dependencies do not pass.
        const testStatuses: Record<string, [Promise<boolean>, (success: boolean) => void]> = {
          [headerTitle]: [Promise.resolve(true), undefined!],
        };
        const documents: Record<string, ExpectedDocument> = {
          [headerTitle]: initialDocument,
        };

        for (const testInfo of tests) {
          let setSuccess: (success: boolean) => void;
          const successPromise = new Promise<boolean>((resolve) => setSuccess = resolve);

          testStatuses[testInfo.title] = [successPromise, setSuccess!];
          documents[testInfo.title] = ExpectedDocument.parse(testInfo.code);
        }

        // Define tests.
        for (const testInfo of tests) {
          const comesAfter = testInfo.comesAfter.padEnd(comesAfterPadding),
                title = testInfo.title.padEnd(testNamePadding);

          test(`transition ${comesAfter} > ${title}`, async function () {
            // Wait for previous test to complete, and skip current test if it
            // failed.
            const notifyStatus = testStatuses[testInfo.title][1],
                  dependencySucceeded = await testStatuses[testInfo.comesAfter][0];

            if (!dependencySucceeded) {
              notifyStatus(false);
              this.skip();
            }

            const beforeDocument = documents[testInfo.comesAfter],
                  afterDocument = documents[testInfo.title];

            try {
              // Ensure the document looks as expected after applying the
              // specified operations.
              await beforeDocument.apply(editor);
              await performOperations(testInfo);

              afterDocument.assertEquals(editor);
              notifyStatus(true);
            } catch (e) {
              notifyStatus(false);

              throw e;
            }
          });
        }
      });

      continue;
    }

    const fullPath = path.join(basedir, file.padEnd(fileNamePadding));
    const friendlyPath = fullPath.substr(/dance.test.suite/.exec(fullPath)!.index);
    const selectionBehavior = file.endsWith(".caret")
      ? SelectionBehavior.Caret
      : SelectionBehavior.Character;

    const content = fs
      .readFileSync(fullPath.trimRight(), { encoding: "utf8" })
      .replace(/^\/\/[^=].*\n/gm, ""); // Remove //-comments.
    const sections = content.split(/(^\/\/== [\w.]+(?: > [\w.]+)?$\n(?:^\/\/= .+$\n)*)/gm);
    const nodes = new Map<string, string>();
    const results = new Map<string, Promise<boolean>>();
    const initialContent = sections[0].trim() + "\n";

    nodes.set("root", initialContent);
    nodes.set("0", initialContent);
    results.set("root", Promise.resolve(true));
    results.set("0", Promise.resolve(true));

    // Find longest section name for padding.
    let longestSectionNameLength = 0;

    for (let i = 1; i < sections.length; i += 2) {
      const [_, sectionIn, sectionOut] = /^\/\/== ([\w.]+)(?: > ([\w.]+))?$/m.exec(sections[i])!;

      longestSectionNameLength = Math.max(
        longestSectionNameLength,
        sectionIn.length,
        sectionOut?.length ?? 0,
      );
    }

    // Run all tests in the file.
    for (let i = 1; i < sections.length; i += 2) {
      const metadata = sections[i],
            content = sections[i + 1];

      const [full, from, to] = /^\/\/== ([\w.]+)(?: > ([\w.]+))?$/m.exec(metadata)!;
      const commands = metadata
        .substr(full.length)
        .split("\n")
        .map((x) => x.substr(3).trim())
        .filter((x) => x)
        .map((str) => (str[0] === "{" ? JSON.parse(str) : str));
      const contentAfterMutation = content;
      const initialContent = nodes.get(from)!;

      if (to === undefined) {
        assert(commands.length === 0, `Cannot define commands in base section.`);

        nodes.set(from, contentAfterMutation);
        results.set(from, Promise.resolve(true));

        continue;
      }

      assert(typeof initialContent === "string");
      assert(!nodes.has(to));

      let setSuccess: (success: boolean) => void;

      nodes.set(to, contentAfterMutation);
      results.set(to, new Promise<boolean>((resolve) => (setSuccess = resolve)));

      test(`${friendlyPath}: mutation ${from.padEnd(longestSectionNameLength)} > ${to.padEnd(
        longestSectionNameLength,
      )} is applied correctly`, async function () {
        if (!(await results.get(from)!)) {
          setSuccess(false);
          this.skip();
        }

        let success = false;

        try {
          await testCommands(editor, {
            initialContent,
            mutations: [{ contentAfterMutation, commands }],
            selectionBehavior,
            allowErrors: true,
          });

          success = true;
        } finally {
          setSuccess(success);
        }
      });
    }
  }
});
