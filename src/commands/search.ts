import * as vscode from "vscode";
import * as api from "../api";

import { Argument, Input, RegisterOr, SetInput } from ".";
import { Context, Direction, EmptySelectionsError, Positions, prompt, Selections } from "../api";
import { Register } from "../state/registers";
import { manipulateSelectionsInteractively } from "../utils/misc";
import { escapeForRegExp } from "../utils/regexp";
import { CharSet, getCharSetFunction } from "../utils/charset";

/**
 * Search for patterns and replace or add selections.
 */
declare module "./search";

let lastSearchInput: RegExp | undefined;

/**
 * Search.
 *
 * @keys `/` (normal)
 *
 * | Title                    | Identifier        | Keybinding     | Command                                           |
 * | ------------------------ | ----------------- | -------------- | ------------------------------------------------- |
 * | Search (extend)          | `extend`          | `?` (normal)   | `[".search", {                shift: "extend" }]` |
 * | Search backward          | `backward`        | `a-/` (normal) | `[".search", { direction: -1                  }]` |
 * | Search backward (extend) | `backward.extend` | `a-?` (normal) | `[".search", { direction: -1, shift: "extend" }]` |
 */
export function search(
  _: Context,
  register: RegisterOr<"slash", Register.Flags.CanWrite>,
  repetitions: number,

  add: Argument<boolean> = false,
  direction: Direction = Direction.Forward,
  interactive: Argument<boolean> = true,
  shift: api.Shift = api.Shift.Jump,

  input: Input<string | RegExp>,
  setInput: SetInput<RegExp>,
) {
  // TODO: handle shift
  return manipulateSelectionsInteractively(_, input, setInput, interactive, {
    ...prompt.regexpOpts("mug"),
    value: lastSearchInput?.source,
  }, (input, selections) => {
    if (typeof input === "string") {
      input = new RegExp(input, "mug");
    }

    lastSearchInput = input;
    register.set([]);

    const newSelections = add ? selections.slice() : [],
          regexpMatches = [] as RegExpMatchArray[];

    newSelections.push(...Selections.map.byIndex((i, selection, document) => {
      let newSelection = selection;

      for (let j = 0; j < repetitions; j++) {
        const searchResult = nextImpl(
          input as RegExp, direction, newSelection, undefined, undefined, document,
          /* allowWrapping= */ shift !== api.Shift.Extend, regexpMatches, i);

        if (searchResult === undefined) {
          return undefined;
        }

        newSelection = searchResult;
      }

      if (shift === api.Shift.Jump) {
        return newSelection;
      }

      const position = direction === Direction.Forward ? newSelection.end : newSelection.start;

      return Selections.shift(selection, position, shift, _);
    }, selections));

    Selections.set(newSelections);
    _.extension.registers.updateRegExpMatches(regexpMatches);

    return register.set([input.source]).then(() => input as RegExp);
  });
}

/**
 * Search current selection.
 *
 * @keys `a-*` (normal)
 *
 * | Title                            | Identifier        | Keybinding   | Command                                  |
 * | -------------------------------- | ----------------- | ------------ | ---------------------------------------- |
 * | Search current selection (smart) | `selection.smart` | `*` (normal) | `[".search.selection", { smart: true }]` |
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
    let text = escapeForRegExp(document.getText(selection));

    if (smart) {
      const firstLine = document.lineAt(selection.start).text,
            firstLineStart = selection.start.character;

      if (firstLineStart === 0 || !isWord!(firstLine.charCodeAt(firstLineStart - 1))) {
        text = `\\b${text}`;
      }

      const lastLine = selection.isSingleLine ? firstLine : document.lineAt(selection.end).text,
            lastLineEnd = selection.end.character;

      if (lastLineEnd >= lastLine.length || !isWord!(lastLine.charCodeAt(lastLineEnd))) {
        text = `${text}\\b`;
      }
    }

    texts.push(text);
  }

  register.set(texts);
}

/**
 * Select next match.
 *
 * @keys `n` (normal)
 *
 * | Title                 | Identifier     | Keybinding       | Command                                          |
 * | --------------------- | -------------- | ---------------- | ------------------------------------------------ |
 * | Add next match        | `next.add`     | `s-n` (normal)   | `[".search.next", {                add: true }]` |
 * | Select previous match | `previous`     | `a-n` (normal)   | `[".search.next", { direction: -1            }]` |
 * | Add previous match    | `previous.add` | `s-a-n` (normal) | `[".search.next", { direction: -1, add: true }]` |
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

  const re = new RegExp(reStrs[0], "mu"),
        allRegexpMatches = [] as RegExpMatchArray[];

  if (!add) {
    Selections.update.byIndex((i, selection) => {
      for (let j = 0; j < repetitions; j++) {
        const next = nextImpl(
          re, direction, selection, undefined, undefined, document, /* allowWrapping= */ true,
          allRegexpMatches, i);

        if (next === undefined) {
          return undefined;
        }

        selection = next;
      }

      return selection;
    });

    _.extension.registers.updateRegExpMatches(allRegexpMatches);
    return;
  }

  const selections = _.selections.slice(),
        allSelections = selections.slice();

  for (let i = 0; i < repetitions; i++) {
    const newSelections = [] as vscode.Selection[],
          regexpMatches = [] as RegExpMatchArray[];

    for (let j = 0; j < selections.length; j++) {
      const selection = selections[j],
            next = nextImpl(
              re, direction, selection, undefined, undefined, document, /* allowWrapping= */ true,
              regexpMatches, i);

      if (next !== undefined) {
        selections[j] = next;
        newSelections.push(next);
      }
    }

    if (newSelections.length === 0) {
      const target = direction === Direction.Backward ? "previous" : "next",
            times = repetitions === 1 ? "time" : "times";

      throw new EmptySelectionsError(
        `no selection could advance to ${target} match ${repetitions} ${times}`,
      );
    }

    allSelections.unshift(...newSelections);
    allRegexpMatches.unshift(...regexpMatches);
  }

  Selections.set(allSelections);
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

  const searchResult = api.search(direction, re, searchStart, searchEnd);

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
