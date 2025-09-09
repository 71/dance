import * as vscode from "vscode";

import type { Argument, RegisterOr } from ".";
import { search as apiSearch, Context, Direction, EmptySelectionsError, manipulateSelectionsInteractively, Positions, promptRegexpOpts, Selections, Shift } from "../api";
import type { Register } from "../state/registers";
import { CharSet, getCharSetFunction } from "../utils/charset";
import { escapeForRegExp, newRegExp } from "../utils/regexp";

/**
 * Search for patterns and replace or add selections.
 */
declare module "./search";

/**
 * Search.
 *
 * @keys `/` (core: normal), `NumPad_Divide` (core: normal)
 *
 * | Title                    | Identifier        | Keybinding                                   | Command                                                |
 * | ------------------------ | ----------------- | -------------------------------------------- | ------------------------------------------------------ |
 * | Search (extend)          | `extend`          | `?` (kakoune: normal), `/` (helix: select)   | `[".search", {                shift: "extend", ... }]` |
 * | Search backward          | `backward`        | `a-/` (kakoune: normal), `?` (helix: normal) | `[".search", { direction: -1                 , ... }]` |
 * | Search backward (extend) | `backward.extend` | `a-?` (kakoune: normal), `?` (helix: select) | `[".search", { direction: -1, shift: "extend", ... }]` |
 */
export async function search(
  _: Context,
  register: RegisterOr<"slash", [Register.Flags.CanRead, Register.Flags.CanWrite]>,
  repetitions: number,

  add: Argument<boolean> = false,
  direction: Direction = Direction.Forward,
  interactive: Argument<boolean> = true,
  shift: Shift = Shift.Jump,

  argument: { re?: string | (RegExp & { originalSource?: string }) },
) {
  return manipulateSelectionsInteractively(_, "re", argument, interactive, {
    ...promptRegexpOpts("mu"),
    value: (await register.get())?.[0],
  }, async (re, selections) => {
    if (typeof re === "string") {
      re = newRegExp(re, "mu");
    }

    register.set([re.originalSource ?? re.source]);

    const newSelections = add ? selections.slice() : [],
          regexpMatches = [] as RegExpMatchArray[];

    newSelections.push(...Selections.mapByIndex((_i, selection, document) => {
      let newSelection = selection;

      for (let j = 0; j < repetitions; j++) {
        const searchResult = nextImpl(
          re as RegExp, direction, newSelection, undefined, undefined, document,
          /* allowWrapping= */ shift !== Shift.Extend, regexpMatches, regexpMatches.length);

        if (searchResult === undefined) {
          return undefined;
        }

        newSelection = searchResult;
      }

      if (shift === Shift.Jump) {
        return newSelection;
      }

      const position = direction === Direction.Forward ? newSelection.end : newSelection.start;

      return Selections.shift(selection, position, shift, _);
    }, selections));

    Selections.set(newSelections);
    _.extension.registers.updateRegExpMatches(regexpMatches);

    await register.set([re.originalSource ?? re.source]);

    return re;
  });
}

/**
 * Search current selection.
 *
 * @keys `a-*` (core: normal), `a-NumPad_Multiply` (core: normal)
 *
 * | Title                            | Identifier        | Keybinding                                                                         | Command                                             |
 * | -------------------------------- | ----------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------- |
 * | Search current selection (smart) | `selection.smart` | `*` (core: normal; helix: select), `NumPad_Multiply` (core: normal; helix: select) | `[".search.selection", { smart: true, +register }]` |
 */
export function selection(
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[],

  register: RegisterOr<"slash", Register.Flags.CanWrite>,
  smart: Argument<boolean> = false,
) {
  const texts = [] as string[],
        isWord = smart ? getCharSetFunction(CharSet.Word, document) : undefined;

  for (const selection of selections) {
    // Replace newlines with `\\n`. Otherwise, using `/` after `*` will bring up
    // a prompt which will remove newlines.
    let text = escapeForRegExp(document.getText(selection)).replace(/\n/g, "\\n");

    if (text.length === 0) {
      continue;
    }

    if (smart) {
      let firstLine: string | undefined,
          isBeginningOfWord = isWord!(text.charCodeAt(0));

      const firstLineStart = selection.start.character;

      if (isBeginningOfWord && firstLineStart > 0) {
        firstLine = document.lineAt(selection.start).text;
        isBeginningOfWord = !isWord!(firstLine.charCodeAt(firstLineStart - 1));
      }

      const lastLineEnd = selection.end.character,
            lastLine = selection.isSingleLine && firstLine !== undefined
              ? firstLine
              : document.lineAt(selection.end).text,
            isEndOfWord = lastLineEnd > 0 && lastLineEnd + 1 < lastLine.length
              && isWord!(lastLine.charCodeAt(lastLineEnd - 1))
              && !isWord!(lastLine.charCodeAt(lastLineEnd));

      if (isBeginningOfWord) {
        const prefix = text.charCodeAt(0) < 0x80 ? "\\b" : "(?<=^|\\P{L})";

        text = prefix + text;
      }

      if (isEndOfWord) {
        const suffix = text.charCodeAt(text.length - 1) < 0x80 ? "\\b" : "(?=\\P{L}|$)";

        text += suffix;
      }
    }

    texts.push(text);
  }

  if (texts.length === 0) {
    throw new Error("all selections are empty");
  }

  register.set(texts);
}

/**
 * Select next match.
 *
 * @keys `n` (core: normal)
 *
 * | Title                 | Identifier     | Keybinding                                       | Command                                               |
 * | --------------------- | -------------- | ------------------------------------------------ | ----------------------------------------------------- |
 * | Add next match        | `next.add`     | `s-n` (kakoune: normal), `n` (helix: select)     | `[".search.next", {                add: true, ... }]` |
 * | Select previous match | `previous`     | `a-n` (kakoune: normal), `s-n` (helix: normal)   | `[".search.next", { direction: -1           , ... }]` |
 * | Add previous match    | `previous.add` | `s-a-n` (kakoune: normal), `s-n` (helix: select) | `[".search.next", { direction: -1, add: true, ... }]` |
 */
export async function next(
  _: Context,
  document: vscode.TextDocument,
  register: RegisterOr<"slash", Register.Flags.CanRead>,
  repetitions: number,

  add: Argument<boolean> = false,
  direction: Direction = Direction.Forward,
) {
  const reStrs = await register.get();

  if (reStrs === undefined || reStrs.length === 0) {
    return;
  }

  const re = newRegExp(reStrs[0], "mu"),
        allRegexpMatches = [] as RegExpMatchArray[],
        selections = _.selections.slice();
  let mainSelection = selections[0];

  if (!add) {
    for (let j = 0; j < repetitions; j++) {
      const next = nextImpl(
        re, direction, mainSelection, undefined, undefined, document, /* allowWrapping= */ true,
        allRegexpMatches, allRegexpMatches.length);

      if (next === undefined) {
        return;
      }

      mainSelection = next;
    }

    selections[0] = mainSelection;
  } else {
    for (let i = 0; i < repetitions; i++) {
      const regexpMatches = [] as RegExpMatchArray[],
            next = nextImpl(
              re, direction, mainSelection, undefined, undefined, document,
              /* allowWrapping= */ true, regexpMatches, regexpMatches.length);

      if (next !== undefined) {
        selections.unshift(next);
        mainSelection = next;
      } else {
        const target = direction === Direction.Backward ? "previous" : "next",
              times = repetitions === 1 ? "time" : "times";

        throw new EmptySelectionsError(
          `main selection could not advance to ${target} match ${repetitions} ${times}`,
        );
      }

      allRegexpMatches.unshift(...regexpMatches);
    }
  }

  Selections.set(selections);
  _.extension.registers.updateRegExpMatches(allRegexpMatches);
}

function nextImpl(
  re: RegExp,
  direction: Direction,
  selection: vscode.Selection,
  searchStart: vscode.Position | undefined,
  searchEnd: vscode.Position | undefined,
  document: vscode.TextDocument,
  allowWrapping: boolean,
  matches: RegExpMatchArray[] | undefined,
  matchesIndex: number,
): vscode.Selection | undefined {
  searchStart ??= direction === Direction.Backward ? selection.start : selection.end;

  const searchResult = apiSearch(direction, re, searchStart, searchEnd);

  if (searchResult === undefined) {
    if (allowWrapping) {
      if (direction === Direction.Backward) {
        searchStart = Positions.last(document);
        searchEnd = Positions.zero;
      } else {
        searchStart = Positions.zero;
        searchEnd = Positions.last(document);
      }

      return nextImpl(
        re, direction, selection, searchStart, searchEnd, document, false, matches, matchesIndex);
    }

    return;
  }

  if (matches !== undefined) {
    matches[matchesIndex] = searchResult[1];
  }

  return Selections.fromLength(
    searchResult[0], searchResult[1][0].length, /* isReversed= */ false, document);
}
