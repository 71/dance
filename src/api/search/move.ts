import * as vscode from "vscode";

import { Context } from "../context";
import * as Positions from "../positions";
import { Direction } from "../types";

let didReachDocumentEdge = false;

/**
 * Moves the given position towards the given direction as long as the given
 * function returns a non-`undefined` value.
 *
 * @see {@link moveWithBackward}
 * @see {@link moveWithForward}
 */
export function moveWith<T>(
  direction: Direction,
  reduce: moveWith.Reduce<T>,
  startState: T,
  origin: vscode.Position,
  document?: vscode.TextDocument,
): vscode.Position {
  return direction === Direction.Backward
    ? moveWithBackward(reduce, startState, origin, document)
    : moveWithForward(reduce, startState, origin, document);
}

export declare namespace moveWith {
  /**
   * A reduce function passed to {@link moveWith}.
   */
  export interface Reduce<T> {
    (character: string, state: T): T | undefined;
  }
}

/**
 * Whether the last call to {@link moveWith} (and variants) reached the edge of
 * the document.
 */
export function moveWithReachedDocumentEdge() {
  return didReachDocumentEdge;
}

/**
 * Moves the given position backward as long as the state returned by the
 * given function is not `undefined`.
 *
 * ### Example
 *
 * ```js
 * // Go backward as long as the previous character is equal to the current
 * // character minus one.
 * assert.deepStrictEqual(
 *   moveWithBackward((c, i) => +c === i - 1 ? +c : undefined,
 *                    9, new vscode.Position(0, 7)),
 *   new vscode.Position(0, 5),
 * );
 * ```
 *
 * With:
 * ```
 * 1234578
 * ```
 */
export function moveWithBackward<T>(
  reduce: moveWith.Reduce<T>,
  startState: T,
  origin: vscode.Position,
  document = Context.current.document,
) {
  didReachDocumentEdge = false;

  const currentLineText = document.lineAt(origin).text;
  let state: T | undefined = startState;

  for (let i = origin.character - 1; i >= 0; i--) {
    if ((state = reduce(currentLineText[i], state)) === undefined) {
      return new vscode.Position(origin.line, i + 1);
    }
  }

  for (let line = origin.line - 1; line >= 0; line--) {
    const lineText = document.lineAt(line).text;

    if ((state = reduce("\n", state)) === undefined) {
      return new vscode.Position(line + 1, 0);
    }

    for (let i = lineText.length - 1; i >= 0; i--) {
      if ((state = reduce(lineText[i], state)) === undefined) {
        return new vscode.Position(line, i + 1);
      }
    }
  }

  didReachDocumentEdge = true;

  return new vscode.Position(0, 0);
}

/**
 * Moves the given position forward as long as the state returned by the given
 * function is not `undefined`.
 *
 * ### Example
 *
 * ```js
 * assert.deepStrictEqual(
 *   moveWithForward((c, i) => +c === i + 1 ? +c : undefined,
 *                   0, new vscode.Position(0, 0)),
 *   new vscode.Position(0, 5),
 * );
 * ```
 *
 * With:
 * ```
 * 1234578
 * ```
 */
export function moveWithForward<T>(
  reduce: moveWith.Reduce<T>,
  startState: T,
  origin: vscode.Position,
  document = Context.current.document,
) {
  didReachDocumentEdge = false;

  const currentLineText = document.lineAt(origin).text;
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

  didReachDocumentEdge = true;

  return document.lineAt(document.lineCount - 1).range.end;
}

/**
 * Same as {@link moveWith}, but using raw char codes.
 *
 * @see {@link moveWithByCharCodeBackward}
 * @see {@link moveWithByCharCodeForward}
 */
export function moveWithByCharCode<T>(
  direction: Direction,
  reduce: moveWithByCharCode.Reduce<T>,
  startState: T,
  origin: vscode.Position,
  document?: vscode.TextDocument,
): vscode.Position {
  return direction === Direction.Backward
    ? moveWithByCharCodeBackward(reduce, startState, origin, document)
    : moveWithByCharCodeForward(reduce, startState, origin, document);
}

export declare namespace moveWithByCharCode {
  /**
   * A reduce function passed to {@link moveWithByCharCode}.
   */
  export interface Reduce<T> {
    (charCode: number, state: T): T | undefined;
  }
}

/**
 * Same as {@link moveWithBackward}, but using raw char codes.
 */
export function moveWithByCharCodeBackward<T>(
  reduce: moveWithByCharCode.Reduce<T>,
  startState: T,
  origin: vscode.Position,
  document = Context.current.document,
) {
  didReachDocumentEdge = false;

  const currentLineText = document.lineAt(origin).text;
  let state: T | undefined = startState;

  for (let i = origin.character - 1; i >= 0; i--) {
    if ((state = reduce(currentLineText.charCodeAt(i), state)) === undefined) {
      return new vscode.Position(origin.line, i + 1);
    }
  }

  for (let line = origin.line - 1; line >= 0; line--) {
    const lineText = document.lineAt(line).text;

    if ((state = reduce(10 /* \n */, state)) === undefined) {
      return new vscode.Position(line + 1, 0);
    }

    for (let i = lineText.length - 1; i >= 0; i--) {
      if ((state = reduce(lineText.charCodeAt(i), state)) === undefined) {
        return new vscode.Position(line, i + 1);
      }
    }
  }

  didReachDocumentEdge = true;
  return new vscode.Position(0, 0);
}

/**
 * Same as {@link moveWithForward}, but using raw char codes.
 */
export function moveWithByCharCodeForward<T>(
  reduce: moveWithByCharCode.Reduce<T>,
  startState: T,
  origin: vscode.Position,
  document = Context.current.document,
) {
  didReachDocumentEdge = false;

  const currentLineText = document.lineAt(origin).text;
  let state: T | undefined = startState;

  for (let i = origin.character; i < currentLineText.length; i++) {
    if ((state = reduce(currentLineText.charCodeAt(i), state)) === undefined) {
      return new vscode.Position(origin.line, i);
    }
  }

  if ((state = reduce(10 /* \n */, state)) === undefined) {
    return new vscode.Position(origin.line, currentLineText.length);
  }

  for (let line = origin.line + 1; line < document.lineCount; line++) {
    const lineText = document.lineAt(line).text;

    for (let i = 0; i < lineText.length; i++) {
      if ((state = reduce(lineText.charCodeAt(i), state)) === undefined) {
        return new vscode.Position(line, i);
      }
    }

    if ((state = reduce(10 /* \n */, state)) === undefined) {
      return new vscode.Position(line, lineText.length);
    }
  }

  didReachDocumentEdge = true;
  return document.lineAt(document.lineCount - 1).range.end;
}

/**
 * Moves the given position towards the given direction as long as the given
 * predicate is true.
 *
 * @see {@link moveWhileBackward}
 * @see {@link moveWhileForward}
 */
export function moveWhile(
  direction: Direction,
  predicate: moveWhile.Predicate,
  origin: vscode.Position,
  document?: vscode.TextDocument,
): vscode.Position {
  return direction === Direction.Backward
    ? moveWhileBackward(predicate, origin, document)
    : moveWhileForward(predicate, origin, document);
}

export declare namespace moveWhile {
  /**
   * A predicate passed to {@link moveWhile}.
   */
  export interface Predicate {
    (character: string): boolean;
  }
}

/**
 * Whether the last call to {@link moveWhile} (and variants) reached the edge of
 * the document.
 */
export function moveWhileReachedDocumentEdge() {
  return didReachDocumentEdge;
}

/**
 * Moves the given position backward as long as the given predicate is true.
 *
 * ### Example
 *
 * ```js
 * assert.deepStrictEqual(
 *   moveWhileBackward((c) => /\w/.test(c), new vscode.Position(0, 3)),
 *   new vscode.Position(0, 0),
 * );
 *
 * assert.deepStrictEqual(
 *   moveWhileBackward((c) => c === "c", new vscode.Position(0, 3)),
 *   new vscode.Position(0, 2),
 * );
 *
 * assert.deepStrictEqual(
 *   moveWhileBackward((c) => c === "b", new vscode.Position(0, 3)),
 *   new vscode.Position(0, 3),
 * );
 * ```
 *
 * With:
 * ```
 * abc
 * ```
 */
export function moveWhileBackward(
  predicate: moveWhile.Predicate,
  origin: vscode.Position,
  document?: vscode.TextDocument,
): vscode.Position {
  return moveWithBackward((ch) => predicate(ch) ? null : undefined, null, origin, document);
}

/**
 * Moves the given position forward as long as the given predicate is true.
 *
 * ### Example
 *
 * ```js
 * assert.deepStrictEqual(
 *   moveWhileForward((c) => /\w/.test(c), new vscode.Position(0, 0)),
 *   new vscode.Position(0, 3),
 * );
 *
 * assert.deepStrictEqual(
 *   moveWhileForward((c) => c === "a", new vscode.Position(0, 0)),
 *   new vscode.Position(0, 1),
 * );
 *
 * assert.deepStrictEqual(
 *   moveWhileForward((c) => c === "b", new vscode.Position(0, 0)),
 *   new vscode.Position(0, 0),
 * );
 * ```
 *
 * With:
 * ```
 * abc
 * ```
 */
export function moveWhileForward(
  predicate: moveWhile.Predicate,
  origin: vscode.Position,
  document?: vscode.TextDocument,
): vscode.Position {
  return moveWithForward((ch) => predicate(ch) ? null : undefined, null, origin, document);
}

/**
 * Same as {@link moveWhile}, but using raw char codes.
 *
 * @see {@link moveWhileByCharCodeBackward}
 * @see {@link moveWhileByCharCodeForward}
 */
export function moveWhileByCharCode(
  direction: Direction,
  predicate: moveWhileByCharCode.Predicate,
  origin: vscode.Position,
  document?: vscode.TextDocument,
): vscode.Position {
  return direction === Direction.Backward
    ? moveWhileByCharCodeBackward(predicate, origin, document)
    : moveWhileByCharCodeForward(predicate, origin, document);
}

export declare namespace moveWhileByCharCode {
  /**
   * A predicate passed to {@link moveWhileByCharCode}.
   */
  export interface Predicate {
    (charCode: number): boolean;
  }
}

/**
 * Same as {@link moveWhileBackward}, but using raw char codes.
 */
export function moveWhileByCharCodeBackward(
  predicate: moveWhileByCharCode.Predicate,
  origin: vscode.Position,
  document?: vscode.TextDocument,
): vscode.Position {
  return moveWithByCharCodeBackward(
    (ch) => predicate(ch) ? null : undefined,
    null,
    origin,
    document,
  );
}

/**
 * Same as {@link moveWhileForward}, but using raw char codes.
 */
export function moveWhileByCharCodeForward(
  predicate: moveWhileByCharCode.Predicate,
  origin: vscode.Position,
  document?: vscode.TextDocument,
): vscode.Position {
  return moveWithByCharCodeForward(
    (ch) => predicate(ch) ? null : undefined,
    null,
    origin,
    document,
  );
}

/**
 * Moves the given position line-by-line towards the given direction as long as
 * the given function returns `undefined`, and returns the first non-`undefined`
 * value it returns or `undefined` if the edge of the document is reached.
 *
 * @see {@link lineByLineBackward}
 * @see {@link lineByLineForward}
 */
export function lineByLine<T>(
  direction: Direction,
  seek: lineByLine.Seek<T>,
  origin: vscode.Position,
  document?: vscode.TextDocument,
) {
  return direction === Direction.Backward
    ? lineByLineBackward(seek, origin, document)
    : lineByLineForward(seek, origin, document);
}

export declare namespace lineByLine {
  /**
   * A reduce function passed to {@link lineByLine}.
   */
  export interface Seek<T> {
    (lineText: string, lineStart: vscode.Position): T | undefined;
  }
}

/**
 * Whether the last call to {@link lineByLine} (and variants) reached the edge of
 * the document.
 */
export function lineByLineReachedDocumentEdge() {
  return didReachDocumentEdge;
}

/**
 * Moves the given position backward line-by-line as long as the given
 * function returns `undefined`, and returns the first non-`undefined`
 * value it returns or `undefined` if the start of the document is reached.
 */
export function lineByLineBackward<T>(
  seek: lineByLine.Seek<T>,
  origin: vscode.Position,
  document = Context.current.document,
) {
  didReachDocumentEdge = false;

  const originLine = document.lineAt(origin),
        originLineText = originLine.text.slice(0, origin.character),
        originResult = seek(originLineText, Positions.lineStart(origin.line));

  if (originResult !== undefined) {
    return originResult;
  }

  for (let line = origin.line - 1; line >= 0; line--) {
    const lineText = document.lineAt(line).text,
          result = seek(lineText, Positions.lineStart(line));

    if (result !== undefined) {
      return result;
    }
  }

  didReachDocumentEdge = true;

  return undefined;
}

/**
 * Moves the given position forward line-by-line as long as the given
 * function returns `undefined`, and returns the first non-`undefined`
 * value it returns or `undefined` if the end of the document is reached.
 */
export function lineByLineForward<T>(
  seek: lineByLine.Seek<T>,
  origin: vscode.Position,
  document = Context.current.document,
) {
  didReachDocumentEdge = false;

  const originLine = document.lineAt(origin),
        originLineText = originLine.text.slice(origin.character),
        originResult = seek(originLineText, origin);

  if (originResult !== undefined) {
    return originResult;
  }

  for (let line = origin.line + 1, lineCount = document.lineCount; line < lineCount; line++) {
    const lineText = document.lineAt(line).text,
          result = seek(lineText, Positions.lineStart(line));

    if (result !== undefined) {
      return result;
    }
  }

  didReachDocumentEdge = true;

  return undefined;
}

/**
 * Advances in the given direction as long as lines are empty, and returns the
 * position closest to the origin in a non-empty line. The origin line will
 * always be skipped.
 */
export function skipEmptyLines(
  direction: Direction,
  origin: number | vscode.Position,
  document = Context.current.document,
) {
  didReachDocumentEdge = false;

  let line = typeof origin === "number" ? origin : origin.line;

  while (line >= 0 && line < document.lineCount) {
    const lineLength = document.lineAt(line).text.length;

    if (lineLength > 0) {
      return new vscode.Position(
        line,
        direction === Direction.Backward ? lineLength : 0,
      );
    }

    line += direction;
  }

  didReachDocumentEdge = true;

  return Positions.edge(direction, document);
}

/**
 * Returns whether the last call to {@link skipEmptyLines} (and variants)
 * reached the edge of the document.
 */
export function skipEmptyLinesReachedDocumentEdge() {
  return didReachDocumentEdge;
}

/**
 * Same as {@link skipEmptyLines} with a `Backward` direction.
 */
export function skipEmptyLinesBackward(
  origin: number | vscode.Position,
  document?: vscode.TextDocument,
) {
  return skipEmptyLines(Direction.Backward, origin, document);
}

/**
 * Same as {@link skipEmptyLines} with a `Forward` direction.
 */
export function skipEmptyLinesForward(
  origin: number | vscode.Position,
  document?: vscode.TextDocument,
) {
  return skipEmptyLines(Direction.Forward, origin, document);
}
