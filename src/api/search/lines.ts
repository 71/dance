import * as vscode from "vscode";

import { Context, lineByLine, Positions } from "..";

/**
 * Returns the range of lines matching the given `RegExp` before and after
 * the given origin position.
 */
export function matchingLines(
  re: RegExp,
  origin: number | vscode.Position,
  document = Context.current.document,
) {
  const start = matchingLines.backward(re, origin, document),
        end = matchingLines.forward(re, origin, document);

  return new vscode.Range(start, end);
}

export namespace matchingLines {
  /**
   * Returns the position of the first line matching the given `RegExp`,
   * starting at the `origin` line (included).
   */
  export function backward(
    re: RegExp,
    origin: number | vscode.Position,
    document = Context.current.document,
  ) {
    return lineByLine.backward(
      (text, position) => re.test(text) ? position : undefined,
      typeof origin === "number" ? Positions.lineStart(origin) : origin,
      document,
    ) ?? Positions.zero;
  }

  /**
   * Returns the position of the last line matching the given `RegExp`, starting
   * at the `origin` line (included).
   */
  export function forward(
    re: RegExp,
    origin: number | vscode.Position,
    document = Context.current.document,
  ) {
    return lineByLine.forward(
      (text, position) => re.test(text) ? position : undefined,
      typeof origin === "number" ? Positions.lineStart(origin) : origin,
      document,
    ) ?? Positions.lineStart(document.lineCount - 1);
  }
}
