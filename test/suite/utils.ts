// Enhance stack traces with the TypeScript source pos instead of compiled JS.
// This is only included in tests to avoid introducing a production dependency.
import "source-map-support/register";

import * as assert from "assert";
import Mocha       from "mocha";
import * as path   from "path";
// @ts-expect-error
import * as unexpected from "unexpected";
import * as vscode from "vscode";

import { Context, SelectionBehavior, Selections } from "../../src/api";
import type { Extension } from "../../src/state/extension";

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
    inspect?(value: T, depth: number, output: Expect.Output, inspect: Expect.Inspect): any;
    equal?(a: T, b: T, equal: (a: any, b: any) => boolean): boolean;
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

/**
 * Resolves a path starting at the root of the Git repository.
 */
export function resolve(subpath: string) {
  // Current path is dance/out/test/suite/utils
  return path.join(__dirname, "../../..", subpath);
}

/**
 * Add depth to command-like suites for nicer reporting.
 */
export function groupTestsByParentName(toplevel: Mocha.Suite) {
  for (const test of toplevel.tests) {
    const parts = test.title.split(" > "),
          testName = parts.pop()!,
          suiteName = parts.join(" "),
          suite = toplevel.suites.find((s) => s.title === suiteName)
            ?? Mocha.Suite.create(toplevel, suiteName);

    suite.addTest(test);
    test.title = testName;
  }

  toplevel.tests.splice(0);
}

/**
 * Executes a VS Code command, attempting to better recover errors.
 */
export async function executeCommand(command: string, ...args: readonly any[]) {
  const extension =
    vscode.extensions.getExtension<{ extension: Extension }>("gregoire.dance")!.exports.extension;

  extension.runPromiseSafely = async (f) => {
    try {
      return await f();
    } catch (e) {
      error = e;
      throw e;
    }
  };

  let result: unknown,
      error: unknown;

  try {
    result = await vscode.commands.executeCommand(command, ...args);
  } catch (e) {
    if (error === undefined
        || !(e instanceof Error
             && e.message.startsWith("Running the contributed command")
             && e.message.endsWith("failed."))) {
      error = e;
    }
  } finally {
    // @ts-expect-error
    delete extension.runPromiseSafely;
  }

  if (command.startsWith("dance") && args.length === 1 && args[0].$expect instanceof RegExp) {
    assert.notStrictEqual(error, undefined, "an error was expected, but no error was raised");

    const pattern = args[0].$expect,
          message = "" + ((error as any)?.message ?? error);

    assert.match(
      message,
      pattern,
      `error ${JSON.stringify(message)} does not match expected pattern ${pattern}`,
    );
  } else if (error !== undefined) {
    throw error;
  }

  return result;
}

export const expect: Expect = unexpected.clone();

const shortPos = (p: vscode.Position) => `${p.line}:${p.character}`;

expect.addType<vscode.Position>({
  name: "position",
  identify: (v) => v instanceof vscode.Position,
  base: "object",

  inspect(value, _, output) {
    output
      .text("Position(")
      .text(shortPos(value))
      .text(")");
  },
  equal(a, b) {
    return a.isEqual(b);
  },
});

expect.addType<vscode.Range>({
  name: "range",
  identify: (v) => v instanceof vscode.Range,
  base: "object",

  inspect(value, _, output) {
    output
      .text("Range(")
      .text(shortPos(value.start))
      .text(" -> ")
      .text(shortPos(value.end))
      .text(")");
  },
  equal(a, b) {
    return a.isEqual(b);
  },
});

expect.addType<vscode.Selection>({
  name: "selection",
  identify: (v) => v instanceof vscode.Selection,
  base: "range",

  inspect(value, _, output) {
    output
      .text("Selection(")
      .text(shortPos(value.anchor))
      .text(" -> ")
      .text(shortPos(value.active))
      .text(")");
  },
  equal(a, b) {
    return a.isEqual(b);
  },
});

expect.addAssertion<vscode.Position>(
  "<position> [not] to (have|be at) coords <number> <number>",
  (expect, subject, line: number, character: number) => {
    expect(subject, "[not] to satisfy", { line, character });
  },
);

expect.addAssertion<vscode.Range>(
  "<range> [not] to be empty at coords <number> <number>",
  (expect, subject, line: number, character: number) => {
    expect(subject, "[not] to start at", new vscode.Position(line, character))
      .and("[not] to be empty");
  },
);

expect.addAssertion<vscode.Range>(
  "<range> [not] to be empty",
  (expect, subject) => {
    expect(subject, "[not] to satisfy", { isEmpty: true });
  },
);

expect.addAssertion<vscode.Range>(
  "<range> [not] to start at <position>",
  (expect, subject, position: vscode.Position) => {
    expect(subject, "[not] to satisfy", { start: expect.it("to equal", position) });
  },
);

expect.addAssertion<vscode.Range>(
  "<range> [not] to end at <position>",
  (expect, subject, position: vscode.Position) => {
    expect(subject, "[not] to satisfy", { end: expect.it("to equal", position) });
  },
);

expect.addAssertion<vscode.Range>(
  "<range> [not] to start at coords <number> <number>",
  (expect, subject, line: number, character: number) => {
    expect(subject, "[not] to start at", new vscode.Position(line, character));
  },
);

expect.addAssertion<vscode.Range>(
  "<range> [not] to end at coords <number> <number>",
  (expect, subject, line: number, character: number) => {
    expect(subject, "[not] to end at", new vscode.Position(line, character));
  },
);

expect.addAssertion<vscode.Selection>(
  "<selection> [not] to be reversed",
  (expect, subject) => {
    expect(subject, "[not] to satisfy", { isReversed: true });
  },
);

expect.addAssertion<vscode.Selection>(
  "<selection> [not] to (have anchor|be anchored) at <position>",
  (expect, subject, position: vscode.Position) => {
    expect(subject, "[not] to satisfy", { anchor: expect.it("to equal", position) });
  },
);

expect.addAssertion<vscode.Selection>(
  "<selection> [not] to (have cursor|be active) at <position>",
  (expect, subject, position: vscode.Position) => {
    expect(subject, "[not] to satisfy", { active: expect.it("to equal", position) });
  },
);

expect.addAssertion<vscode.Selection>(
  "<selection> [not] to (have anchor|be anchored) at coords <number> <number>",
  (expect, subject, line: number, character: number) => {
    expect(subject, "[not] to be anchored at", new vscode.Position(line, character));
  },
);

expect.addAssertion<vscode.Selection>(
  "<selection> [not] to (have cursor|be active) at coords <number> <number>",
  (expect, subject, line: number, character: number) => {
    expect(subject, "[not] to be active at", new vscode.Position(line, character));
  },
);

function stringifySelection(document: vscode.TextDocument, selection: vscode.Selection) {
  const content = document.getText(),
        startOffset = document.offsetAt(selection.start);

  if (selection.isEmpty) {
    return content.slice(0, startOffset) + "|" + content.slice(startOffset);
  }

  let endOffset = document.offsetAt(selection.end),
      endString = selection.isReversed ? "<" : "|";
  const startString = selection.isReversed ? "|" : ">";

  if (selection.end.character === 0) {
    // Selection ends at line break.
    endString = "↵" + endString;
    endOffset--;
  }

  return (
    content.slice(0, startOffset)
    + startString
    + content.slice(startOffset, endOffset)
    + endString
    + content.slice(endOffset)
  );
}

export class ExpectedDocument {
  public constructor(
    public readonly text: string,
    public readonly selections: readonly vscode.Selection[] = [],
  ) {
    const lineCount = text.split("\n").length;

    for (const selection of selections) {
      expect(selection.end.line, "to be less than", lineCount);
    }
  }

  public static snapshot(editor: vscode.TextEditor) {
    return new this(editor.document.getText(), editor.selections);
  }

  public static apply(editor: vscode.TextEditor, indent: number, text: string) {
    return this.parseIndented(indent, text).apply(editor);
  }

  public static assertEquals(
    editor: vscode.TextEditor,
    message: string | undefined,
    indent: number,
    text: string,
  ) {
    return this.parseIndented(indent, text).assertEquals(editor, message);
  }

  public static parseIndented(indent: number, text: string) {
    if (text.length < indent) {
      // Empty document.
      return new ExpectedDocument("");
    }

    // Remove first line break.
    text = text.slice(1);

    // Remove final line break (indent - (two spaces) + line break).
    text = text.slice(0, text.length - (indent - 2 + 1));

    // Remove indentation.
    text = text.replace(new RegExp(`^ {${indent}}`, "gm"), "");

    return ExpectedDocument.parse(text);
  }

  public static parse(text: string) {
    text = text.replace(/·/g, " ");

    const selections = [] as vscode.Selection[],
          lines = [] as string[];
    let previousLineStart = 0;

    for (let line of text.split("\n")) {
      let hasIndicator = false;

      line = line.replace(/([|^]+) *(\d+)|(\d+) *([|^]+)/g, (match, c1, n1, n2, c2, offset) => {
        const carets = (c1 ?? c2) as string,
              selectionIndex = +(n1 ?? n2),
              prevSelection = selections[selectionIndex],
              empty = carets === "|" && prevSelection === undefined,
              start = new vscode.Position(lines.length - 1, offset),
              end = offset + carets.length === lines[lines.length - 1].length + 1 && !empty
                ? new vscode.Position(lines.length, 0)  // Select end of line character.
                : new vscode.Position(lines.length - 1, offset + (empty ? 0 : carets.length));

        if (prevSelection === undefined) {
          selections[selectionIndex] = carets[0] === "|"
            ? new vscode.Selection(end, start)
            : new vscode.Selection(start, end);
        } else {
          selections[selectionIndex] = prevSelection.isEmpty || prevSelection.isReversed
            ? new vscode.Selection(end, prevSelection.start)
            : new vscode.Selection(prevSelection.start, end);
        }
        hasIndicator = true;

        return " ".repeat(match.length);
      });

      if (hasIndicator && /^ +$/.test(line)) {
        continue;
      }

      if (lines.length > 0) {
        previousLineStart += lines[lines.length - 1].length + 1;
        //            Accounting for the newline character. ^^^
      }

      lines.push(line);
    }

    return new this(lines.join("\n"), selections);
  }

  public async apply(editor: vscode.TextEditor) {
    await editor.edit((builder) => {
      const start = new vscode.Position(0, 0),
            end = editor.document.lineAt(editor.document.lineCount - 1).rangeIncludingLineBreak.end;

      builder.replace(new vscode.Range(start, end), this.text);
    });

    if (this.selections.length > 0) {
      editor.selections = this.selections;
    }
  }

  public assertEquals(editor: vscode.TextEditor, message = "") {
    const document = editor.document;

    assert.strictEqual(
      document.getText(),
      this.text,
      message + (message ? "\n" : "") + `Document text is not as expected.`,
    );

    const expectedSelections = this.selections.slice() as (vscode.Selection | undefined)[];

    if (expectedSelections.length === 0) {
      return;
    }

    expect(editor.selections, "to have items satisfying", expect.it("to satisfy", {
      end: expect.it("to satisfy", {
        line: expect.it("to be less than", document.lineCount),
      }),
    }));

    // Ensure resulting selections are right.
    let mergedSelections = Selections.mergeOverlapping(editor.selections).slice();

    if (Context.currentOrUndefined?.selectionBehavior === SelectionBehavior.Character) {
      mergedSelections = Selections.toCharacterMode(mergedSelections, document);
    }

    const actualSelections = mergedSelections.slice() as (vscode.Selection | undefined)[];

    // First, we set correct selections to `undefined` to ignore them in the
    // checks below.
    let hasUnexpectedSelection = false;

    for (let i = 0; i < expectedSelections.length && i < actualSelections.length; i++) {
      if (expectedSelections[i]!.isEqual(actualSelections[i]!)) {
        expectedSelections[i] = actualSelections[i] = undefined;
      } else {
        hasUnexpectedSelection = true;
      }
    }

    if (!hasUnexpectedSelection && expectedSelections.length === actualSelections.length) {
      return;
    }

    const commonText: string[] = [message === "" ? "Selections are not as expected." : message],
          expectedText: string[] = [],
          actualText: string[] = [];

    // Then, we report selections that are correct, but have the wrong index.
    for (let i = 0; i < expectedSelections.length; i++) {
      const expectedSelection = expectedSelections[i];

      if (expectedSelection === undefined) {
        continue;
      }

      for (let j = 0; j < actualSelections.length; j++) {
        const actualSelection = actualSelections[j];

        if (actualSelection === undefined) {
          continue;
        }

        if (expectedSelection.isEqual(actualSelection)) {
          commonText.push(`Expected selection found at index #${j} to be at index #${i}.`);
          expectedSelections[i] = actualSelections[j] = undefined;
          break;
        }
      }
    }

    // Then, we diff selections that exist in both arrays.
    const sortedExpectedSelections = expectedSelections
      .map((x, i) => [i, x!] as const)
      .filter((x) => x[1] !== undefined)
      .sort((a, b) => a[1].start.compareTo(b[1].start));
    const sortedActualSelections = actualSelections
      .map((x, i) => [i, x!] as const)
      .filter((x) => x[1] !== undefined)
      .sort((a, b) => a[1].start.compareTo(b[1].start));

    for (let i = 0; i < sortedExpectedSelections.length && i < sortedActualSelections.length; i++) {
      const [expectedIndex, expectedSelection] = sortedExpectedSelections[i],
            [actualIndex, actualSelection] = sortedActualSelections[i];

      const error = actualIndex === expectedIndex
        ? `Selection #${actualIndex} is not as expected:`
        : `Actual selection #${actualIndex} differs from expected selection #${expectedIndex}:`;

      actualText.push(error);
      expectedText.push(error);

      actualText.push(stringifySelection(document, actualSelection).replace(/^/gm, "  "));
      expectedText.push(stringifySelection(document, expectedSelection).replace(/^/gm, "  "));
    }

    // Finally, we report selections that are expected and not found, and those
    // that were found but were not expected.
    for (let i = sortedActualSelections.length; i < sortedExpectedSelections.length; i++) {
      const [index, expectedSelection] = sortedExpectedSelections[i];

      expectedText.push(
        `Missing selection #${index}:\n${
          stringifySelection(document, expectedSelection).replace(/^(?=.)/gm, "  ")}`);
      actualText.push(`Missing selection #${index}:\n`);
    }

    for (let i = sortedExpectedSelections.length; i < sortedActualSelections.length; i++) {
      const [index, actualSelection] = sortedActualSelections[i];

      actualText.push(
        `Unexpected selection #${index}:\n${
          stringifySelection(document, actualSelection).replace(/^(?=.)/gm, "  ")}`);
      expectedText.push(`Unexpected selection #${index}:\n`);
    }

    // Show error:
    assert.strictEqual(
      actualText.join("\n"),
      expectedText.join("\n"),
      commonText.join("\n"),
    );

    // Sometimes the error messages end up being the same; ensure this isn't the
    // case below.
    assert.fail(commonText.join("\n") + "\n" + actualText.join("\n"));
  }
}
