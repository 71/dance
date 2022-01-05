import * as vscode from "vscode";

import { Context } from "../context";
import * as Positions from "../positions";
import { Direction } from "../types";

/**
 * Moves the given position towards the given direction until the given string
 * is found. If found, its start position will be returned; otherwise,
 * `undefined` will be returned.
 *
 * When navigating backward, the returned position **will include** the given
 * input, which is not the case when navigating forward. Please make sure that
 * this is what you want.
 */
export function moveTo(
  direction: Direction,
  string: string,
  origin: vscode.Position,
  document = Context.current.document,
) {
  let line = origin.line,
      character: number | undefined = origin.character;

  for (;;) {
    const text = document.lineAt(line).text;

    if (character === undefined) {
      character = text.length;
    }

    const idx = direction === Direction.Backward
      ? text.lastIndexOf(string, character)
      : text.indexOf(string, character);

    if (idx !== -1) {
      return new vscode.Position(line, idx);
    }

    // No match on this line, let's keep going.
    if (direction === Direction.Backward) {
      if (line === 0) {
        return undefined;
      }

      line--;
      character = undefined;
    } else {
      if (line === document.lineCount - 1) {
        return undefined;
      }

      line++;
      character = 0;
    }
  }
}

/**
 * Same as {@link moveTo}, but also ensures that the result is excluded by
 * translating the resulting position by `input.length` when going backward.
 */
export function moveToExcluded(
  direction: Direction,
  string: string,
  origin: vscode.Position,
  document?: vscode.TextDocument,
) {
  const result = moveTo(direction, string, origin, document);

  if (result !== undefined && direction === Direction.Backward) {
    return Positions.offset(result, string.length, document);
  }

  return result;
}

/**
 * Same as {@link moveTo}, but also ensures that the result is included by
 * translating the resulting position by `input.length` when going forward.
 */
export function moveToIncluded(
  direction: Direction,
  string: string,
  origin: vscode.Position,
  document?: vscode.TextDocument,
) {
  const result = moveTo(direction, string, origin, document);

  if (result !== undefined && direction === Direction.Forward) {
    return Positions.offset(result, string.length, document);
  }

  return result;
}
