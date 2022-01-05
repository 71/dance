import * as vscode from "vscode";

import { lineByLineBackward, lineByLineForward } from "./move";
import { Context } from "../context";
import * as Positions from "../positions";

/**
 * Returns the range of lines matching the given {@link RegExp} before and after
 * the given origin position.
 */
export function matchingLines(
  re: RegExp,
  origin: number | vscode.Position,
  document = Context.current.document,
) {
  const start = matchingLinesBackward(re, origin, document),
        end = matchingLinesForward(re, origin, document);

  return new vscode.Range(start, end);
}

/**
 * Returns the position of the first line matching the given {@link RegExp},
 * starting at the `origin` line (included).
 */
export function matchingLinesBackward(
  re: RegExp,
  origin: number | vscode.Position,
  document = Context.current.document,
) {
  return lineByLineBackward(
    (text, position) => re.test(text) ? position : undefined,
    typeof origin === "number" ? Positions.lineStart(origin) : origin,
    document,
  ) ?? Positions.zero;
}

/**
 * Returns the position of the last line matching the given {@link RegExp},
 * starting at the `origin` line (included).
 */
export function matchingLinesForward(
  re: RegExp,
  origin: number | vscode.Position,
  document = Context.current.document,
) {
  return lineByLineForward(
    (text, position) => re.test(text) ? position : undefined,
    typeof origin === "number" ? Positions.lineStart(origin) : origin,
    document,
  ) ?? Positions.lineStart(document.lineCount - 1);
}
