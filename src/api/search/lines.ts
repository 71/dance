import * as vscode from "vscode";
import { Context } from "../context";
import { Positions } from "../positions";
import { lineByLine } from "./move";

export function matchingLines(
  re: RegExp,
  origin: vscode.Position,
  document = Context.current.document,
) {
  const start = matchingLines.backward(re, origin, document),
        end = matchingLines.forward(re, origin, document);

  return new vscode.Range(start, end);
}

export namespace matchingLines {
  export function backward(
    re: RegExp,
    origin: vscode.Position,
    document = Context.current.document,
  ) {
    return lineByLine.backward(
      (text, position) => re.test(text) ? position : undefined,
      origin,
      document,
    ) ?? Positions.zero;
  }

  export function forward(
    re: RegExp,
    origin: vscode.Position,
    document = Context.current.document,
  ) {
    return lineByLine.forward(
      (text, position) => re.test(text) ? position : undefined,
      origin,
      document,
    ) ?? Positions.lineStart(document.lineCount - 1);
  }
}
