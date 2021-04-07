import * as vscode from "vscode";

import { Context, Direction } from "..";

/**
 * Moves the given position towards the given direction until the given string
 * is found. If found, its start position will be returned; otherwise,
 * `undefined` will be returned.
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
      ? text.lastIndexOf(string, character - 1)
      : text.indexOf(string, character + 1);

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
 * Repeatedly calls `moveTo` in a direction.
 */
export function repeatedly<R, F extends (...args: [...readonly any[], R]) => R | undefined>(
  repetitions: number,
  func: F,
  ...args: Parameters<F>
) {
  let value = args.splice(args.length - 1)[0] as R | undefined;

  for (let i = 0; i < repetitions && value !== undefined; i++) {
    value = func(...args, value);
  }

  return value;
}
