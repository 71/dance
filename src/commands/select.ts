import * as vscode from "vscode";

import { Argument } from ".";
import { Context, Direction, Selections, showMenu, todo } from "../api";

/**
 * Update selections based on their position in the document.
 */
declare module "./select";

/**
 * Select whole buffer.
 *
 * @keys `%` (normal)
 */
export function buffer(_: Context) {
  Selections.set([Selections.wholeBuffer()]);
}

/**
 * Select to line.
 *
 * @keys `g` (normal)
 */
export function toLine(
  _: Context,
  count: number,
) {
  if (count === 0) {
    return showMenu.byName("goto");
  }

  todo();
}

/**
 * Select line.
 */
export function line(
  count: number,

  direction = Direction.Forward,
) {
  if (count === 0 || count === 1) {
    todo();
  }

  todo();
}

/**
 * Extend line.
 */
export function line_extend(
  count: number,

  direction = Direction.Forward,
) {
  todo();
}

/**
 * Select to line start.
 *
 * @keys `a-h` (normal), `home` (normal)
 *
 * #### Variants
 *
 * | Title                | Identifier           | Keybinding                          | Command                                       |
 * | -------------------- | -------------------- | ----------------------------------- | --------------------------------------------- |
 * | Extend to line start | `toLineStart.extend` | `s-a-h` (normal), `s-home` (normal) | `[".select.toLineStart", { "extend": true }]` |
 */
export function toLineStart(
  document: vscode.TextDocument,

  count: number,
  extend: Argument<boolean> = false,
) {
  if (count > 0) {
    return todo();
  }

  todo();
}

/**
 * Select to line end.
 *
 * @keys `a-l` (normal), `end` (normal)
 *
 * #### Variants
 *
 * | Title              | Identifier         | Keybinding                         | Command                                     |
 * | ------------------ | ------------------ | ---------------------------------- | ------------------------------------------- |
 * | Extend to line end | `toLineEnd.extend` | `s-a-l` (normal), `s-end` (normal) | `[".select.toLineEnd", { "extend": true }]` |
 */
export function toLineEnd(
  document: vscode.TextDocument,

  count: number,
  extend: Argument<boolean> = false,
) {
  if (count > 0) {
    return todo();
  }

  todo();
}
