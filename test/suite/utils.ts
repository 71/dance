// Enhance stack traces with the TypeScript source pos instead of compiled JS.
// This is only included in tests to avoid introducing a production dependency.
import "source-map-support/register";

import * as assert from "assert";
import * as path   from "path";
import * as vscode from "vscode";

export function longestStringLength<T>(f: (v: T) => string, values: readonly T[]) {
  return values.reduce((longest, curr) => Math.max(longest, f(curr).length), 0);
}

export function execAll(re: RegExp, contents: string) {
  assert(re.global);

  const matches = [] as RegExpExecArray[];

  for (let match = re.exec(contents); match !== null; match = re.exec(contents)) {
    matches.push(match);
  }

  return matches;
}

/**
 * Resolves a path starting at the root of the Git repository.
 */
export function resolve(subpath: string) {
  // Current path is dance/out/test/suite/utils
  return path.join(__dirname, "../../..", subpath);
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

export class ExpectedDocument {
  public constructor(
    public readonly text: string,
    public readonly selections: vscode.Selection[] = [],
  ) {}

  public static parse(text: string) {
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
