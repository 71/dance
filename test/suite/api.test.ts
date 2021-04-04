// @ts-expect-error
import * as expect from "unexpected";

import * as assert from "assert";
import * as fs     from "fs";
import * as glob   from "glob";
import * as path   from "path";
import * as vscode from "vscode";

import { execAll, ExpectedDocument } from "./utils";
import { api, extensionState } from "../../src/extension";

interface Expect<T = any> {
  <T>(subject: T, assertion: string, ...args: readonly any[]): {
    readonly and: Expect.Continuation<T>;
  };

  readonly it: Expect.Continuation<T>;

  addAssertion<T>(
    pattern: string,
    handler: (expect: Expect<T>, subject: T, ...args: readonly any[]) => void,
  ): void;

  addType<T>(typeDefinition: {
    name: string;
    identify: (value: unknown) => boolean;

    base?: string;
    inspect?: (value: T, depth: number, output: Expect.Output, inspect: Expect.Inspect) => any;
  }): void;
}

namespace Expect {
  export interface Continuation<T = any> {
    (assertion: string, ...args: readonly any[]): { readonly and: Continuation<T> };
  }

  export interface Inspect {
    (value: any, depth: number): any;
  }

  export interface Output {
    text(text: string): Output;
    append(_: any): Output;
  }
}

declare const expect: Expect;

interface Test {
  functionName?: string;
  flags: string;
  n: number;
  code: string;
  before?: string;
  after?: string;
}

function toExpectedDocument(text: string | undefined) {
  return text === undefined ? undefined : ExpectedDocument.parse(text.replace(/·/g, " "));
}

function parseDocTests(contents: string, path: string) {
  const tests = [] as Test[],
        docContents = contents
          .split("\n")
          .map((line) => line.trimLeft())
          .filter((line) => line.startsWith("*") || line.startsWith("export function "))
          .map((line) => line.startsWith("*") ? line.slice(2) : "^" + line.slice(16))
          .join("\n");

  // eslint-disable-next-line max-len
  const re = /^\^(\w+)|^### Example\n+[\s\S]*?^```(.+)\n([\s\S]+?)^```\n+(?:^(?:Before|With):\n^```\n([\s\S]*?)^```\n+(?:^After:\n^```\n([\s\S]+?)^```)?)?/gm,
        pendingTests = [] as Test[];

  for (const [_, functionName, flags, code, before, after] of execAll(re, docContents)) {
    if (functionName === undefined) {
      pendingTests.push({ n: pendingTests.length, flags, code, before, after });
    } else {
      if (tests.length > 0 && tests[tests.length - 1].functionName === functionName) {
        pendingTests.forEach((test) => test.n += tests[tests.length - 1].n + 1);
      }
      pendingTests.forEach((test) => test.functionName = functionName);
      tests.push(...pendingTests.splice(0));
    }
  }

  assert.strictEqual(
    execAll(/^### Example/gm, docContents).length,
    tests.length,
    `cannot parse all tests in file ${path}`,
  );

  return tests;
}

const shortPos = (p: vscode.Position) => `${p.line}:${p.character}`;

expect.addType<vscode.Position>({
  name: "position",
  identify: (v) => v instanceof vscode.Position,
  base: "object",

  inspect: (value, _, output) => {
    output
      .text("Position(")
      .text(shortPos(value))
      .text(")");
  },
});

expect.addType<vscode.Selection>({
  name: "selection",
  identify: (v) => v instanceof vscode.Selection,
  base: "object",

  inspect: (value, _, output) => {
    output
      .text("Selection(")
      .text(shortPos(value.anchor))
      .text(" -> ")
      .text(shortPos(value.active))
      .text(")");
  },
});

expect.addAssertion<vscode.Position>(
  "<position> [not] to (have|be at) coords <number> <number>",
  (expect, subject, line: number, character: number) => {
    expect(subject, "[not] to satisfy", { line, character });
  },
);

expect.addAssertion<vscode.Selection>(
  "<selection> [not] to be empty",
  (expect, subject) => {
    expect(subject, "[not] to satisfy", { isEmpty: true });
  },
);

expect.addAssertion<vscode.Selection>(
  "<selection> [not] to be reversed",
  (expect, subject) => {
    expect(subject, "[not] to satisfy", { isReversed: true });
  },
);

expect.addAssertion<vscode.Selection>(
  "<selection> [not] to start at <position>",
  (expect, subject, position: vscode.Position) => {
    expect(subject, "[not] to satisfy", { start: position });
  },
);

expect.addAssertion<vscode.Selection>(
  "<selection> [not] to end at <position>",
  (expect, subject, position: vscode.Position) => {
    expect(subject, "[not] to satisfy", { end: position });
  },
);

expect.addAssertion<vscode.Selection>(
  "<selection> [not] to (have anchor|be anchored) at <position>",
  (expect, subject, position: vscode.Position) => {
    expect(subject, "[not] to satisfy", { anchor: position });
  },
);

expect.addAssertion<vscode.Selection>(
  "<selection> [not] to (have cursor|be active) at <position>",
  (expect, subject, position: vscode.Position) => {
    expect(subject, "[not] to satisfy", { active: position });
  },
);

const AsyncFunction = async function () {}.constructor as FunctionConstructor;

suite("API tests", function () {
  // Set up document.
  let document: vscode.TextDocument,
      editor: vscode.TextEditor;
  const cancellationToken = new vscode.CancellationTokenSource().token;

  this.beforeAll(async () => {
    document = await vscode.workspace.openTextDocument();
    editor = await vscode.window.showTextDocument(document);

    // Warm up to avoid inaccurately reporting long tests.
    const initialDocument = ExpectedDocument.parse(""),
          code = new AsyncFunction(...argNames, "await edit(() => {});");

    const context = new api.Context(extensionState.getEditorState(editor), cancellationToken);

    await initialDocument.apply(editor);
    await context.run(() => code(...argValues));
  });

  const argNames = [...Object.keys(api), "vscode", "assert", "expect"],
        argValues = [...Object.values(api), vscode, assert, expect];

  // Discover all tests.
  const basedir = path.join(this.file!, "../../../../src/api"),
        fileNames = glob.sync("**/*.ts", { cwd: basedir });

  for (const fileName of fileNames) {
    const filePath = path.join(basedir, fileName),
          contents = fs.readFileSync(filePath, "utf-8"),
          tests = parseDocTests(contents, fileName);

    if (tests.length === 0) {
      continue;
    }

    suite(fileName, function () {
      for (let i = 0; i < tests.length; i++) {
        const testInfo = tests[i];
        let testName = `function ${testInfo.functionName!}`;

        if (testInfo.n > 0 || (i + 1 < tests.length && tests[i + 1].n === 1)) {
          testName += `#${testInfo.n}`;
        }

        // Wrap code in block to allow redefinition of parameters.
        const code = new AsyncFunction(...argNames, `{\n${testInfo.code}\n}`),
              before = toExpectedDocument(testInfo.before),
              after = toExpectedDocument(testInfo.after);

        test(testName, async function () {
          const context = new api.Context(extensionState.getEditorState(editor), cancellationToken);

          await before?.apply(editor);
          await context.run(() => code(...argValues));

          after?.assertEquals(editor);
        });
      }
    });
  }
});
