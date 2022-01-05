import * as vscode from "vscode";

import { Context } from "./context";
import { Direction } from "./types";

/**
 * Returns the position right after the given position, or `undefined` if
 * `position` is the last position of the document.
 */
export function next(position: vscode.Position, document?: vscode.TextDocument) {
  document ??= Context.current.document;

  const line = position.line,
        character = position.character,
        textLineLen = document.lineAt(line).text.length;

  if (character < textLineLen) {
    return new vscode.Position(line, character + 1);
  }

  if (line === document.lineCount - 1) {
    return undefined;
  }

  return new vscode.Position(line + 1, 0);
}

/**
 * Returns the position right before the given position, or `undefined` if
 * `position` is the first position of the document.
 */
export function previous(position: vscode.Position, document?: vscode.TextDocument) {
  const line = position.line,
        character = position.character;

  if (character > 0) {
    return new vscode.Position(line, character - 1);
  }

  if (line === 0) {
    return undefined;
  }

  return new vscode.Position(
    line - 1,
    (document ?? Context.current.document).lineAt(line - 1).text.length,
  );
}

/**
 * Returns the position at a given (possibly negative) offset from the given
 * position, or `undefined` if such a position would go out of the bounds of the
 * document.
 */
export function offset(
  position: vscode.Position,
  by: number,
  document?: vscode.TextDocument,
) {
  if (by === 0) {
    return position;
  }

  if (by === 1) {
    return next(position, document);
  }

  if (by === -1) {
    return previous(position, document);
  }

  document ??= Context.current.document;

  const offset = document.offsetAt(position) + by;

  if (offset === -1) {
    return undefined;
  }

  return document.positionAt(document.offsetAt(position) + by);
}

/**
 * Same as {@link offset}, but clamps to document edges.
 */
export function offsetOrEdge(
  position: vscode.Position,
  by: number,
  document?: vscode.TextDocument,
) {
  const result = offset(position, by, document);

  if (result === undefined) {
    return by < 0 ? zero : last(document);
  }

  return result;
}

/**
 * The (0, 0) position.
 */
export const zero = new vscode.Position(0, 0);

/**
 * Returns the last position of the given document.
 */
export function last(document = Context.current.document) {
  return document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end;
}

/**
 * Returns the position at the given line and character.
 */
export function at(line: number, character: number) {
  return new vscode.Position(line, character);
}

/**
 * Returns the position at the start of the given line.
 */
export function lineStart(line: number) {
  return new vscode.Position(line, 0);
}

/**
 * Returns the position at the first non-blank character of the given line, or
 * the end of the line if the line is fully blank.
 */
export function nonBlankLineStart(line: number, document = Context.current.document) {
  return new vscode.Position(line, document.lineAt(line).firstNonWhitespaceCharacterIndex);
}

/**
 * Returns the position at the end of the given line.
 */
export function lineEnd(line: number, document = Context.current.document) {
  return new vscode.Position(line, document.lineAt(line).text.length);
}

/**
 * Returns the position after the end of the given line, i.e. the first
 * position of the next line.
 */
export function lineBreak(line: number, document = Context.current.document) {
  return line + 1 === document.lineCount ? lineEnd(line, document) : lineStart(line + 1);
}

/**
 * Returns the last position of the current document when going in the given
 * direction. If {@link Direction.Backward}, this is {@link zero}. If
 * {@link Direction.Forward}, this is {@link last(document)}.
 */
export function edge(direction: Direction, document?: vscode.TextDocument) {
  return direction === Direction.Backward ? zero : last(document);
}
