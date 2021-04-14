// Enhance stack traces with the TypeScript source pos instead of compiled JS.
// This is only included in tests to avoid introducing a production dependency.
import "source-map-support/register";

import * as assert from "assert";
import * as path   from "path";
// @ts-expect-error
import * as expect from "unexpected";
import * as vscode from "vscode";

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

export declare const expect: Expect;

/**
 * Resolves a path starting at the root of the Git repository.
 */
export function resolve(subpath: string) {
  // Current path is dance/out/test/suite/utils
  return path.join(__dirname, "../../..", subpath);
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
  "<selection> [not] to be empty at coords <number> <number>",
  (expect, subject, line: number, character: number) => {
    expect(subject, "[not] to start at", new vscode.Position(line, character))
      .and("[not] to be empty");
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

export class ExpectedDocument {
  public constructor(
    public readonly text: string,
    public readonly selections: vscode.Selection[] = [],
  ) {}

  public static parseIndented(indent: number, text: string) {
    return ExpectedDocument.parse(
      text.replace(new RegExp(`^ {${indent}}`, "gm"), "").replace(/ +$/, ""),
    );
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
              end = offset + carets.length === lines[lines.length - 1].length + 1
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

        return " ".repeat(match[0].length);
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

  public assertEquals(editor: vscode.TextEditor) {
    const document = editor.document;

    assert.strictEqual(
      document.getText(),
      this.text,
      `Document text is not as expected.`,
    );

    const expectedSelections = this.selections;

    if (expectedSelections.length === 0) {
      return;
    }

    // Ensure resulting selections are right.
    assert.strictEqual(
      editor.selections.length,
      expectedSelections.length,
      `Expected ${expectedSelections.length} selection(s), but had ${editor.selections.length}.`,
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
        `Expected Selection #${i} to match ('>' is anchor, '|' is cursor).`,
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
  }
}
