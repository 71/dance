import * as vscode from "vscode";
import { Direction } from "../../utils/selection-helper";
import { Context } from "../context";

/**
 * Moves the given position towards the given direction as long as the given
 * function returns a non-`undefined` value.
 *
 * @see moveWhile.backward,takeWhile.forward
 */
export function moveWith<T>(
  direction: Direction,
  reduce: moveWith.Reduce<T>,
  startState: T,
  origin: vscode.Position,
): vscode.Position {
  return direction === Direction.Backward
    ? moveWith.backward(reduce, startState, origin)
    : moveWith.forward(reduce, startState, origin);
}

export namespace moveWith {
  /**
   * A reduce function passed to `moveWith`.
   */
  export interface Reduce<T> {
    (character: string, state: T): T | undefined;
  }

  /**
   * Moves the given position backward as long as the given predicate is true.
   *
   * ### Example
   *
   * ```js
   * assert.deepStrictEqual(
   *   moveWith.backward((c, i) => +c === +i - 1 ? c : undefined,
   *                     "8", new vscode.Position(0, 8)),
   *   new vscode.Position(0, 7),
   * );
   * ```
   *
   * With:
   * ```
   * 1234578
   * ```
   */
  export function backward<T>(reduce: moveWith.Reduce<T>, startState: T, origin: vscode.Position) {
    const document = Context.current.document,
          currentLineText = document.lineAt(origin).text;
    let state: T | undefined = startState;

    for (let i = origin.character - 1; i >= 0; i--) {
      if ((state = reduce(currentLineText[i], state)) === undefined) {
        return new vscode.Position(origin.line, i + 1);
      }
    }

    for (let line = origin.line - 1; line >= 0; line--) {
      const lineText = document.lineAt(line).text;

      if ((state = reduce("\n", state)) === undefined) {
        return new vscode.Position(line, 0);
      }

      for (let i = lineText.length - 1; i >= 0; i--) {
        if ((state = reduce(lineText[i], state)) === undefined) {
          return i === lineText.length - 1
            ? new vscode.Position(line + 1, 0)
            : new vscode.Position(line, i + 1);
        }
      }
    }

    return new vscode.Position(0, 0);
  }

  /**
   * Moves the given position forward as long as the given predicate is true.
   *
   * ### Example
   *
   * ```js
   * assert.deepStrictEqual(
   *   moveWith.forward((c, i) => +c === +i + 1 ? c : undefined,
   *                    "1", new vscode.Position(0, 8)),
   *   new vscode.Position(0, 7),
   * );
   * ```
   *
   * With:
   * ```
   * 1234578
   * ```
   */
  export function forward<T>(reduce: moveWith.Reduce<T>, startState: T, origin: vscode.Position) {
    const document = Context.current.document,
          currentLineText = document.lineAt(origin).text;
    let state: T | undefined = startState;

    for (let i = origin.character; i < currentLineText.length; i++) {
      if ((state = reduce(currentLineText[i], state)) === undefined) {
        return new vscode.Position(origin.line, i);
      }
    }

    if ((state = reduce("\n", state)) === undefined) {
      return new vscode.Position(origin.line, currentLineText.length);
    }

    for (let line = origin.line + 1; line < document.lineCount; line++) {
      const lineText = document.lineAt(line).text;

      for (let i = 0; i < lineText.length; i++) {
        if ((state = reduce(lineText[i], state)) === undefined) {
          return new vscode.Position(line, i);
        }
      }

      if ((state = reduce("\n", state)) === undefined) {
        return new vscode.Position(line, lineText.length);
      }
    }

    return document.lineAt(document.lineCount - 1).range.end;
  }
}

/**
 * Moves the given position towards the given direction as long as the given
 * predicate is true.
 *
 * @see moveWhile.backward,takeWhile.forward
 */
export function moveWhile(
  direction: Direction,
  predicate: moveWhile.Predicate,
  origin: vscode.Position,
): vscode.Position {
  return direction === Direction.Backward
    ? moveWhile.backward(predicate, origin)
    : moveWhile.forward(predicate, origin);
}

export namespace moveWhile {
  /**
   * A predicate passed to `moveWhile`.
   */
  export interface Predicate {
    (character: string): boolean;
  }

  /**
   * Moves the given position backward as long as the given predicate is true.
   *
   * ### Example
   *
   * ```js
   * assert.deepStrictEqual(
   *   moveWhile.backward((c) => /\w/.test(c), new vscode.Position(0, 3)),
   *   new vscode.Position(0, 0),
   * );
   *
   * assert.deepStrictEqual(
   *   moveWhile.backward((c) => c === 'c', new vscode.Position(0, 3)),
   *   new vscode.Position(0, 2),
   * );
   *
   * assert.deepStrictEqual(
   *   moveWhile.backward((c) => c === 'b', new vscode.Position(0, 3)),
   *   new vscode.Position(0, 3),
   * );
   * ```
   *
   * With:
   * ```
   * abc
   * ```
   */
  export function backward(predicate: Predicate, origin: vscode.Position): vscode.Position {
    return moveWith.backward((ch) => predicate(ch) ? null : undefined, null, origin);
  }

  /**
   * Moves the given position forward as long as the given predicate is true.
   *
   * ### Example
   *
   * ```js
   * assert.deepStrictEqual(
   *   moveWhile.forward((c) => /\w/.test(c), new vscode.Position(0, 0)),
   *   new vscode.Position(0, 3),
   * );
   *
   * assert.deepStrictEqual(
   *   moveWhile.forward((c) => c === 'a', new vscode.Position(0, 0)),
   *   new vscode.Position(0, 1),
   * );
   *
   * assert.deepStrictEqual(
   *   moveWhile.forward((c) => c === 'b', new vscode.Position(0, 0)),
   *   new vscode.Position(0, 0),
   * );
   * ```
   *
   * With:
   * ```
   * abc
   * ```
   */
  export function forward(predicate: Predicate, origin: vscode.Position): vscode.Position {
    return moveWith.forward((ch) => predicate(ch) ? null : undefined, null, origin);
  }
}
