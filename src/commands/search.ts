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
 * | Title                 | Identifier     | Keybinding     | Command                                         |
 * | --------------------- | -------------- | -------------- | ----------------------------------------------- |
 * | Search (add)          | `add`          | `?` (normal)   | `[".search", { "add": true }]`                  |
 * | Search backward       | `backward`     | `a-/` (normal) | `[".search", { "direction": -1 }]`              |
 * | Search backward (add) | `backward.add` | `a-?` (normal) | `[".search", { "direction": -1, "add": true }]` |
 */
export function search(
  _: Context,
  register: RegisterOr<"slash", Register.Flags.CanWrite>,
  repetitions: number,

  add: Argument<boolean> = false,
  direction: Direction = Direction.Forward,
  interactive: Argument<boolean> = true,

  input: Input<string | RegExp>,
  setInput: SetInput<RegExp>,
) {
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

    newSelections.push(...Selections.map.byIndex((_, selection, document) => {
      let newSelection = selection;

      for (let i = 0; i < repetitions; i++) {
        const searchOrigin = Selections.seekFrom(selection, direction),
              searchResult = api.search(direction, input as RegExp, searchOrigin);

        if (searchResult === undefined) {
          return undefined;
        }

        newSelection = Selections.fromLength(searchResult[0], searchResult[1][0].length,
                                             false /* isReversed */, document);
        regexpMatches.push(searchResult[1]);
      }

      return newSelection;
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
 * | Title                            | Identifier        | Keybinding   | Command                                    |
 * | -------------------------------- | ----------------- | ------------ | ------------------------------------------ |
 * | Search current selection (smart) | `selection.smart` | `*` (normal) | `[".search.selection", { "smart": true }]` |
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
 * | Title                 | Identifier     | Keybinding       | Command                                              |
 * | --------------------- | -------------- | ---------------- | ---------------------------------------------------- |
 * | Add next match        | `next.add`     | `s-n` (normal)   | `[".search.next", { "add": true }]`                  |
 * | Select previous match | `previous`     | `a-n` (normal)   | `[".search.next", { "direction": -1 }]`              |
 * | Add previous match    | `previous.add` | `s-a-n` (normal) | `[".search.next", { "direction": -1, "add": true }]` |
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

  const re = new RegExp(reStrs[0], "mu");

  if (!add) {
    Selections.update.byIndex((_, selection) => {
      for (let i = 0; i < repetitions; i++) {
        const next = nextImpl(re, direction, selection, undefined, undefined, document, true);

        if (next === undefined) {
          return undefined;
        }

        selection = next;
      }

      return selection;
    });

    return;
  }

  const selections = _.selections,
        allSelections = selections.slice();

  for (let i = 0; i < repetitions; i++) {
    const newSelections = [] as vscode.Selection[];

    for (const selection of selections) {
      const next = nextImpl(re, direction, selection, undefined, undefined, document, false);

      if (next !== undefined) {
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
  }

  Selections.set(allSelections);
}

function nextImpl(
  re: RegExp,
  direction: Direction,
  selection: vscode.Selection,
  searchStart: vscode.Position | undefined,
  searchEnd: vscode.Position | undefined,
  document: vscode.TextDocument,
  allowWrapping: boolean,
): vscode.Selection | undefined {
  searchStart ??= direction === Direction.Backward ? selection.start : selection.end;

  const searchResult = api.search(direction, re, searchStart, searchEnd);

  if (searchResult === undefined) {
    if (allowWrapping) {
      if (direction === Direction.Backward) {
        searchStart = Positions.last(document);
        searchEnd = selection.end;
      } else {
        searchStart = Positions.zero;
        searchEnd = selection.start;
      }

      return nextImpl(re, -direction, selection, searchStart, searchEnd, document, false);
    }

    return;
  }

  return Selections.fromLength(searchResult[0], searchResult[1][0].length,
                               false /* isReversed */, document);
}
