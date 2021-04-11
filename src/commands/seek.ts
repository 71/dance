import * as vscode from "vscode";

import { Argument, InputOr } from ".";
import { Context, Direction, keypress, moveTo, Positions, Selections, Shift, todo } from "../api";

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

      position = moveTo(direction, input, position, document);

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
