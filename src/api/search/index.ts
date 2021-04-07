import * as vscode from "vscode";
import * as regexp from "../../utils/regexp";
import { Context, Direction } from "..";

/**
 * Searches backward or forward for a pattern starting at the given position.
 *
 * @see search.backward,search.forward
 */
export function search(direction: Direction, re: RegExp, origin: vscode.Position) {
  return direction === Direction.Backward
    ? search.backward(re, origin)
    : search.forward(re, origin);
}

export namespace search {
  /**
   * The type of the result of a search: a `[startPosition, match]` pair if the
   * search succeeded, and `undefined` otherwise.
   */
  export type Result = [vscode.Position, RegExpMatchArray] | undefined;

  /**
   * Searches backward for a pattern starting at the given position.
   *
   * ### Example
   *
   * ```js
   * const [p1, [t1]] = search.backward(/\w/, new vscode.Position(0, 1));
   *
   * assert.deepStrictEqual(p1, new vscode.Position(0, 0));
   * assert.strictEqual(t1, "a");
   *
   * const [p2, [t2]] = search.backward(/\w/, new vscode.Position(0, 2));
   *
   * assert.deepStrictEqual(p2, new vscode.Position(0, 1));
   * assert.strictEqual(t2, "b");
   *
   * const [p3, [t3]] = search.backward(/\w+/, new vscode.Position(0, 2));
   *
   * assert.deepStrictEqual(p3, new vscode.Position(0, 0));
   * assert.strictEqual(t3, "ab");
   *
   * assert.strictEqual(
   *   search.backward(/\w/, new vscode.Position(0, 0)),
   *   undefined,
   * );
   * ```
   *
   * With:
   * ```
   * abc
   * ```
   */
  export function backward(re: RegExp, origin: vscode.Position): Result {
    const document = Context.current.document;

    if (regexp.canMatchLineFeed(re)) {
      // Find all matches before the origin and take the last one.
      const searchRange = new vscode.Range(new vscode.Position(0, 0), origin),
            match = regexp.execLast(re, document.getText(searchRange));

      if (match === null) {
        return undefined;
      }

      return [document.positionAt(match.index), match] as Result;
    }

    // Loop for a match line by line, starting at the current line.
    const currentLine = document.lineAt(origin),
          match = regexp.execLast(re, currentLine.text.slice(0, origin.character));

    if (match !== null) {
      const matchPosition = origin.with({ character: match.index });

      return [matchPosition, match] as Result;
    }

    for (let line = origin.line - 1; line >= 0; line--) {
      const textLine = document.lineAt(line),
            match = regexp.execLast(re, textLine.text);

      if (match === null) {
        continue;
      }

      const matchPosition = new vscode.Position(line, match.index);

      return [matchPosition, match] as Result;
    }

    return undefined;
  }

  /**
   * Searches forward for a pattern starting at the given position.
   *
   * ### Example
   *
   * ```js
   * const [p1, [t1]] = search.forward(/\w/, new vscode.Position(0, 0));
   *
   * assert.deepStrictEqual(p1, new vscode.Position(0, 0));
   * assert.strictEqual(t1, "a");
   *
   * const [p2, [t2]] = search.forward(/\w/, new vscode.Position(0, 1));
   *
   * assert.deepStrictEqual(p2, new vscode.Position(0, 1));
   * assert.strictEqual(t2, "b");
   *
   * const [p3, [t3]] = search.forward(/\w+/, new vscode.Position(0, 1));
   *
   * assert.deepStrictEqual(p3, new vscode.Position(0, 1));
   * assert.strictEqual(t3, "bc");
   *
   * assert.strictEqual(
   *   search.forward(/\w/, new vscode.Position(0, 3)),
   *   undefined,
   * );
   * ```
   *
   * With:
   * ```
   * abc
   * ```
   */
  export function forward(re: RegExp, origin: vscode.Position): Result {
    const document = Context.current.document;

    if (regexp.canMatchLineFeed(re)) {
      // Look for a match in all the rest of the document.
      const documentEnd = document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end,
            searchRange = new vscode.Range(origin, documentEnd),
            match = re.exec(document.getText(searchRange));

      if (match === null) {
        return undefined;
      }

      const matchPosition = document.positionAt(document.offsetAt(origin) + match.index);

      return [matchPosition, match] as Result;
    }

    // Look for a match line by line, starting at the current line.
    const currentLine = document.lineAt(origin),
          match = re.exec(currentLine.text.slice(origin.character));

    if (match !== null) {
      const matchPosition = origin.translate(0, match.index);

      return [matchPosition, match] as Result;
    }

    for (let line = origin.line + 1; line < document.lineCount; line++) {
      const textLine = document.lineAt(line),
            match = re.exec(textLine.text);

      if (match === null) {
        continue;
      }

      const matchPosition = new vscode.Position(line, match.index);

      return [matchPosition, match] as Result;
    }

    return undefined;
  }
}
