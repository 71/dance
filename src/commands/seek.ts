import * as vscode from "vscode";

import { Argument, InputOr } from ".";
import { ArgumentError, Context, Direction, keypress, moveTo, Pair, pair, Positions, Selections, Shift, surroundedBy, todo } from "../api";
import { SelectionBehavior } from "../state/modes";

/**
 * Update selections based on the text surrounding them.
 */
declare module "./seek";

/**
 * Select to character (excluded).
 *
 * @keys `t` (normal)
 *
 * #### Variants
 *
 * | Title                                    | Identifier                           | Keybinding       | Command                                                                        |
 * | ---------------------------------------- | ------------------------------------ | ---------------- | ------------------------------------------------------------------------------ |
 * | Extend to character (excluded)           | `character.extend`                   | `s-t` (normal)   | `[".seek.character", { "shift": "extend" }]`                                   |
 * | Select to character (excluded, backward) | `character.backward`                 | `a-t` (normal)   | `[".seek.character", { "direction": -1 }]`                                     |
 * | Extend to character (excluded, backward) | `character.extend.backward`          | `s-a-t` (normal) | `[".seek.character", { "shift": "extend", "direction": -1 }]`                  |
 * | Select to character (included)           | `character.included`                 | `f` (normal)     | `[".seek.character", { "include": true }]`                                     |
 * | Extend to character (included)           | `character.included.extend`          | `s-f` (normal)   | `[".seek.character", { "include": true, "shift": "extend" }]`                  |
 * | Select to character (included, backward) | `character.included.backward`        | `a-f` (normal)   | `[".seek.character", { "include": true, "direction": -1 }]`                    |
 * | Extend to character (included, backward) | `character.included.extend.backward` | `s-a-f` (normal) | `[".seek.character", { "include": true, "shift": "extend", "direction": -1 }]` |
 */
export async function character(
  _: Context,
  inputOr: InputOr<string>,

  repetitions: number,
  direction = Direction.Forward,
  shift = Shift.Select,
  include: Argument<boolean> = false,
) {
  const input = await inputOr(() => keypress(_));

  Selections.update.byIndex((_, selection, document) => {
    let position: vscode.Position | undefined = Selections.seekFrom(selection, direction);

    for (let i = 0; i < repetitions; i++) {
      position = Positions.offset(position, direction, document);

      if (position === undefined) {
        return undefined;
      }

      position = moveTo.excluded(direction, input, position, document);

      if (position === undefined) {
        return undefined;
      }
    }

    if (include) {
      position = Positions.offset(position, input.length * direction);

      if (position === undefined) {
        return undefined;
      }
    }

    return Selections.shift(selection, position, shift);
  });
}

const defaultEnclosingPatterns = [
  "\\[", "\\]",
  "\\(", "\\)",
  "\\{", "\\}",
  "/\\*", "\\*/",
  "\\bbegin\\b", "\\bend\\b",
];

/**
 * Select to next enclosing character.
 *
 * @keys `m` (normal)
 *
 * #### Variants
 *
 * | Title                                  | Identifier                  | Keybinding       | Command                                                       |
 * | -------------------------------------- | --------------------------- | ---------------- | ------------------------------------------------------------- |
 * | Extend to next enclosing character     | `enclosing.extend`          | `s-m` (normal)   | `[".seek.enclosing", { "shift": "extend" }]`                  |
 * | Select to previous enclosing character | `enclosing.backward`        | `a-m` (normal)   | `[".seek.enclosing", { "direction": -1 }]`                    |
 * | Extend to previous enclosing character | `enclosing.extend.backward` | `s-a-m` (normal) | `[".seek.enclosing", { "shift": "extend", "direction": -1 }]` |
 */
export function enclosing(
  _: Context,

  direction = Direction.Forward,
  shift = Shift.Select,
  open: Argument<boolean> = true,
  pairs: Argument<readonly string[]> = defaultEnclosingPatterns,
) {
  ArgumentError.validate(
    "pairs",
    (pairs.length & 1) === 0,
    "an even number of pairs must be given",
  );

  const selectionBehavior = _.selectionBehavior,
        compiledPairs = [] as Pair[];

  for (let i = 0; i < pairs.length; i += 2) {
    compiledPairs.push(pair(new RegExp(pairs[i], "mu"), new RegExp(pairs[i], "mu")));
  }

  // This command intentionally ignores repetitions to be consistent with
  // Kakoune.
  // It only finds one next enclosing character and drags only once to its
  // matching counterpart. Repetitions > 1 does exactly the same with rep=1,
  // even though executing the command again will jump back and forth.
  Selections.update.byIndex((_, selection, document) => {
    // First, find an enclosing char (which may be the current character).
    let currentCharacter = selection.active;

    if (selectionBehavior === SelectionBehavior.Caret) {
      if (direction === Direction.Backward && selection.isReversed) {
        // When moving backwards, the first character to consider is the
        // character to the left, not the right. However, we hackily special
        // case `|[foo]>` (> is anchor, | is active) to jump to the end in the
        // current group.
        currentCharacter = Positions.previous(currentCharacter, document) ?? currentCharacter;
      } else if (direction === Direction.Forward && !selection.isReversed && !selection.isEmpty) {
        // Similarly, we special case `<[foo]|` to jump back in the current
        // group.
        currentCharacter = Positions.previous(currentCharacter, document) ?? currentCharacter;
      }
    }

    if (selectionBehavior === SelectionBehavior.Caret && direction === Direction.Backward) {
      // When moving backwards, the first character to consider is the
      // character to the left, not the right.
      currentCharacter = Positions.previous(currentCharacter, document) ?? currentCharacter;
    }

    const enclosedRange = surroundedBy(compiledPairs, direction, currentCharacter, open, document);

    if (enclosedRange === undefined) {
      return undefined;
    }

    if (shift === Shift.Extend) {
      return new vscode.Selection(selection.anchor, enclosedRange.active);
    }

    return enclosedRange;
  });
}

/**
 * Select to next word start.
 *
 * Select the word and following whitespaces on the right of the end of each selection.
 *
 * @keys `w` (normal)
 *
 * #### Variants
 *
 * | Title                                        | Identifier                     | Keybinding       | Command                                                                   |
 * | -------------------------------------------- | ------------------------------ | ---------------- | ------------------------------------------------------------------------- |
 * | Extend to next word start                    | `wordStart.extend`             | `s-w` (normal)   | `[".seek.wordStart", { "shift": "extend" }]`                              |
 * | Select to previous word start                | `wordStart.backward`           | `b` (normal)     | `[".seek.wordStart", { "direction": -1 }]`                                |
 * | Extend to previous word start                | `wordStart.extend.backward`    | `s-b` (normal)   | `[".seek.wordStart", { "shift": "extend", "direction": -1 }]`             |
 * | Select to next non-whitespace word start     | `wordStart.ws`                 | `a-w` (normal)   | `[".seek.wordStart", { "ws": true }]`                                     |
 * | Extend to next non-whitespace word start     | `wordStart.ws.extend`          | `s-a-w` (normal) | `[".seek.wordStart", { "ws": true, "shift": "extend" }]`                  |
 * | Select to previous non-whitespace word start | `wordStart.ws.backward`        | `a-b` (normal)   | `[".seek.wordStart", { "ws": true, "direction": -1 }]`                    |
 * | Extend to previous non-whitespace word start | `wordStart.ws.extend.backward` | `s-a-b` (normal) | `[".seek.wordStart", { "ws": true, "shift": "extend", "direction": -1 }]` |
 */
export function wordStart(
  ws: Argument<boolean> = false,
  direction = Direction.Forward,
  shift = Shift.Select,
) {
  todo();
}

/**
 * Select to next word end.
 *
 * Select preceding whitespaces and the word on the right of the end of each selection.
 *
 * @keys `e` (normal)
 *
 * #### Variants
 *
 * | Title                                  | Identifier          | Keybinding       | Command                                                |
 * | -------------------------------------- | ------------------- | ---------------- | ------------------------------------------------------ |
 * | Extend to next word end                | `wordEnd.extend`    | `s-e` (normal)   | `[".seek.wordEnd", { "shift": "extend" }]`             |
 * | Select to next non-whitespace word end | `wordEnd.ws`        | `a-e` (normal)   | `[".seek.wordEnd", { "ws": true }]`                    |
 * | Extend to next non-whitespace word end | `wordEnd.ws.extend` | `s-a-e` (normal) | `[".seek.wordEnd", { "ws": true, "shift": "extend" }]` |
 */
export function wordEnd(
  ws: Argument<boolean> = false,
  shift = Shift.Select,
) {
  todo();
}
