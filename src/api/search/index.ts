import * as vscode from "vscode";

import { Context } from "../context";
import * as Positions from "../positions";
import { Direction } from "../types";
import { canMatchLineFeed, execLast, matchesStaticStrings, smartExec } from "../../utils/regexp";

/**
 * Searches backward or forward for a pattern starting at the given position.
 *
 * @see {@link searchBackward}
 * @see {@link searchForward}
 */
export function search(
  direction: Direction,
  re: RegExp,
  origin: vscode.Position,
  end?: vscode.Position,
  document?: vscode.TextDocument,
) {
  return direction === Direction.Backward
    ? searchBackward(re, origin, end, document)
    : searchForward(re, origin, end, document);
}

export declare namespace search {
  /**
   * The type of the result of a search: a `[startPosition, match]` pair if the
   * search succeeded, and `undefined` otherwise.
   */
  export type Result = [vscode.Position, RegExpMatchArray] | undefined;
}

/**
 * Searches backward for a pattern starting at the given position.
 *
 * ### Example
 *
 * ```ts
 * const [p1, [t1]] = searchBackward(/\w/, new vscode.Position(0, 1))!;
 *
 * expect(p1, "to be at coords", 0, 0);
 * expect(t1, "to be", "a");
 *
 * const [p2, [t2]] = searchBackward(/\w/, new vscode.Position(0, 2))!;
 *
 * expect(p2, "to be at coords", 0, 1);
 * expect(t2, "to be", "b");
 *
 * const [p3, [t3]] = searchBackward(/\w+/, new vscode.Position(0, 2))!;
 *
 * expect(p3, "to be at coords", 0, 0);
 * expect(t3, "to be", "ab");
 *
 * expect(
 *   searchBackward(/\w/, new vscode.Position(0, 0)),
 *   "to be undefined",
 * );
 * ```
 *
 * With:
 * ```
 * abc
 * ```
 */
export function searchBackward(
  re: RegExp,
  origin: vscode.Position,
  end?: vscode.Position,
  document = Context.current.document,
): search.Result {
  end ??= Positions.zero;

  const searchStart = document.offsetAt(end),
        searchEnd = document.offsetAt(origin),
        possibleSearchLength = searchEnd - searchStart;

  if (possibleSearchLength < 0) {
    return;
  }

  if (possibleSearchLength > 2_000) {
    const staticMatches = matchesStaticStrings(re);

    if (staticMatches !== undefined) {
      return searchOneOfBackward(re, staticMatches, origin, end, document);
    }

    if (!canMatchLineFeed(re)) {
      return searchSingleLineRegExpBackward(re, origin, end, document);
    }
  }

  return searchNaiveBackward(re, origin, end, document);
}

/**
 * Searches forward for a pattern starting at the given position.
 *
 * ### Example
 *
 * ```ts
 * const [p1, [t1]] = searchForward(/\w/, new vscode.Position(0, 0))!;
 *
 * expect(p1, "to be at coords", 0, 0);
 * expect(t1, "to be", "a");
 *
 * const [p2, [t2]] = searchForward(/\w/, new vscode.Position(0, 1))!;
 *
 * expect(p2, "to be at coords", 0, 1);
 * expect(t2, "to be", "b");
 *
 * const [p3, [t3]] = searchForward(/\w+/, new vscode.Position(0, 1))!;
 *
 * expect(p3, "to be at coords", 0, 1);
 * expect(t3, "to be", "bc");
 *
 * expect(
 *   searchForward(/\w/, new vscode.Position(0, 3)),
 *   "to be undefined",
 * );
 * ```
 *
 * With:
 * ```
 * abc
 * ```
 */
export function searchForward(
  re: RegExp,
  origin: vscode.Position,
  end?: vscode.Position,
  document = Context.current.document,
): search.Result {
  end ??= Positions.last(document);

  const searchStart = document.offsetAt(origin),
        searchEnd = document.offsetAt(end),
        possibleSearchLength = searchEnd - searchStart;

  if (possibleSearchLength < 0) {
    return;
  }

  if (possibleSearchLength > 2_000) {
    const staticMatches = matchesStaticStrings(re);

    if (staticMatches !== undefined) {
      return searchOneOfForward(re, staticMatches, origin, end, document);
    }

    if (!canMatchLineFeed(re)) {
      return searchSingleLineRegExpForward(re, origin, end, document);
    }
  }

  return searchNaiveForward(re, origin, end, document);
}

function maxLines(strings: readonly string[]) {
  let max = 1;

  for (const string of strings) {
    let lines = 1;

    for (let i = 0, len = string.length; i < len; i++) {
      if (string.charCodeAt(i) === 10 /* \n */) {
        lines++;
      }
    }

    if (lines > max) {
      max = lines;
    }
  }

  return max;
}

function searchNaiveBackward(
  re: RegExp,
  origin: vscode.Position,
  end: vscode.Position,
  document: vscode.TextDocument,
) {
  re.lastIndex = 0;

  // Find all matches before the origin and take the last one.
  const searchRange = new vscode.Range(end, origin),
        match = execLast(re, document.getText(searchRange));

  if (match === null) {
    return;
  }

  return [Positions.offset(end, match.index), match] as search.Result;
}

function searchNaiveForward(
  re: RegExp,
  origin: vscode.Position,
  end: vscode.Position,
  document: vscode.TextDocument,
) {
  re.lastIndex = 0;

  // Look for a match in all the rest of the document.
  const searchRange = new vscode.Range(origin, end),
        match = smartExec(re, document.getText(searchRange));

  if (match === null) {
    return;
  }

  const matchPosition = document.positionAt(document.offsetAt(origin) + match.index);

  return [matchPosition, match] as search.Result;
}

function searchSingleLineRegExpBackward(
  re: RegExp,
  origin: vscode.Position,
  end: vscode.Position,
  document: vscode.TextDocument,
) {
  re.lastIndex = 0;

  // Loop for a match line by line, starting at the current line.
  const currentLine = document.lineAt(origin),
        match = execLast(re, currentLine.text.slice(0, origin.character));

  if (match !== null) {
    return [new vscode.Position(origin.line, match.index), match] as search.Result;
  }

  const endLine = end.line;

  for (let line = origin.line - 1; line > endLine; line--) {
    const textLine = document.lineAt(line),
          match = execLast(re, textLine.text);

    if (match !== null) {
      return [new vscode.Position(line, match.index), match] as search.Result;
    }
  }

  const endMatch = execLast(re, document.lineAt(endLine).text.slice(end.character));

  if (endMatch !== null) {
    const endCharacter = end.character + endMatch.index;

    return [new vscode.Position(endLine, endCharacter), endMatch] as search.Result;
  }

  return;
}

function searchSingleLineRegExpForward(
  re: RegExp,
  origin: vscode.Position,
  end: vscode.Position,
  document: vscode.TextDocument,
) {
  re.lastIndex = 0;

  // Loop for a match line by line, starting at the current line.
  const currentLine = document.lineAt(origin),
        match = smartExec(re, currentLine.text.slice(origin.character));

  if (match !== null) {
    return [origin.translate(undefined, match.index), match] as search.Result;
  }

  const endLine = end.line;

  for (let line = origin.line + 1; line < endLine; line++) {
    const textLine = document.lineAt(line),
          match = smartExec(re, textLine.text);

    if (match !== null) {
      return [new vscode.Position(line, match.index), match] as search.Result;
    }
  }

  const endMatch = smartExec(re, document.lineAt(endLine).text.slice(0, end.character));

  if (endMatch !== null) {
    return [new vscode.Position(endLine, endMatch.index), endMatch] as search.Result;
  }

  return;
}

function searchOneOfBackward(
  re: RegExp,
  oneOf: readonly string[],
  origin: vscode.Position,
  end: vscode.Position,
  document: vscode.TextDocument,
) {
  const lineRange = maxLines(oneOf);

  if (lineRange === 1) {
    return searchSingleLineRegExpBackward(re, origin, end, document);
  }

  const endLine = end.line;

  if (origin.line - endLine < lineRange) {
    return;
  }

  re.lastIndex = 0;

  const originLine = origin.line,
        lines = [document.lineAt(originLine).text.slice(0, origin.character)],
        joiner = document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";

  for (let i = 1; i < lineRange; i++) {
    lines.unshift(document.lineAt(originLine - i).text);
  }

  const lineToSlice = end.character === 0 ? -1 : endLine;

  for (let line = originLine - lineRange + 1; line >= endLine; line--) {
    lines[0] = document.lineAt(line).text;

    if (line === lineToSlice) {
      lines[0] = lines[0].slice(end.character);
    }

    const text = lines.join(joiner),
          match = smartExec(re, text);

    if (match !== null) {
      return [new vscode.Position(line, match.index), match] as search.Result;
    }

    for (let i = lineRange; i > 0; i--) {
      lines[i] = lines[i + 1];
    }
  }

  return;
}

function searchOneOfForward(
  re: RegExp,
  oneOf: readonly string[],
  origin: vscode.Position,
  end: vscode.Position,
  document: vscode.TextDocument,
) {
  const lineRange = maxLines(oneOf);

  if (lineRange === 1) {
    return searchSingleLineRegExpForward(re, origin, end, document);
  }

  const endLine = end.line;

  if (origin.line + lineRange >= endLine) {
    return;
  }

  re.lastIndex = 0;

  const originLine = origin.line,
        lines = [document.lineAt(originLine).text.slice(origin.character)],
        joiner = document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";

  for (let i = 1; i < lineRange; i++) {
    lines.push(document.lineAt(originLine + i).text);
  }

  for (let line = originLine, loopEnd = endLine - lineRange + 1; line < loopEnd; line++) {
    const text = lines.join(joiner),
          match = smartExec(re, text);

    if (match !== null) {
      const character = line === originLine ? origin.character + match.index : match.index;

      return [new vscode.Position(line, character), match] as search.Result;
    }

    for (let i = 1; i < lineRange; i++) {
      lines[i - 1] = lines[i];
    }

    lines[lines.length - 1] = document.lineAt(line + lineRange).text;

    if (line === loopEnd - 1) {
      lines[lines.length - 1] = lines[lines.length - 1].slice(0, end.character);
    }
  }

  return;
}
