import * as vscode from "vscode";

import { Context, Positions, Selections, Shift, showMenu } from "../api";

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
  shift = Shift.Jump,
) {
  if (count === 0) {
    return showMenu.byName("goto");
  }

  return lineStart(_, count, shift);
}

/**
 * Select line below.
 *
 * @keys `x` (normal)
 */
export function line_below(_: Context, count: number) {
  if (count === 0 || count === 1) {
    Selections.update.byIndex((_, selection) => {
      let line = Selections.activeLine(selection);

      if (Selections.isEntireLines(selection)) {
        line++;
      }

      return new vscode.Selection(line, 0, line + 1, 0);
    });
  } else {
    Selections.update.byIndex((_, selection, document) => {
      const line = Math.min(Selections.activeLine(selection) + count - 1, document.lineCount - 1);

      return new vscode.Selection(line, 0, line + 1, 0);
    });
  }
}

/**
 * Extend to line below.
 *
 * @keys `s-x` (normal)
 */
export function line_below_extend(_: Context, count: number) {
  if (count === 0 || count === 1) {
    Selections.update.byIndex((_, selection) => {
      const isFullLine = Selections.isEntireLine(selection),
            isFullLineDiff = isFullLine ? 1 : 0,
            isSameLine = isFullLine || Selections.isSingleLine(selection);

      const anchor = isSameLine ? selection.anchor.with(undefined, 0) : selection.anchor,
            active = selection.active.character === 0 && !selection.isReversed && !isSameLine
              ? selection.active.translate(1 + isFullLineDiff)
              : new vscode.Position(Selections.activeLine(selection) + 1 + isFullLineDiff, 0);

      return new vscode.Selection(anchor, active);
    });
  } else {
    Selections.update.byIndex((_, selection, document) => {
      const line = Math.min(Selections.activeLine(selection) + count - 1, document.lineCount - 1),
            isSameLine = Selections.isSingleLine(selection);

      const anchor = isSameLine ? selection.anchor.with(undefined, 0) : selection.anchor,
            active = new vscode.Position(line + 1, 0);

      return new vscode.Selection(anchor, active);
    });
  }
}

/**
 * Select line above.
 */
export function line_above(_: Context, count: number) {
  if (count === 0 || count === 1) {
    Selections.update.byIndex((_, selection) => {
      let line = Selections.activeLine(selection);

      if (!Selections.isEntireLines(selection)) {
        line++;
      }

      return new vscode.Selection(line, 0, line - 1, 0);
    });
  } else {
    Selections.update.byIndex((_, selection) => {
      const line = Math.max(Selections.activeLine(selection) - count + 1, 0);

      return new vscode.Selection(line, 0, line - 1, 0);
    });
  }
}

/**
 * Extend to line above.
 */
export function line_above_extend(_: Context, count: number) {
  // TODO: fix this logic
  if (count === 0 || count === 1) {
    Selections.update.byIndex((_, selection) => {
      const isFullLine = Selections.isEntireLine(selection),
            isFullLineDiff = isFullLine ? -1 : 0,
            isSameLine = isFullLine || Selections.isSingleLine(selection);

      const anchor = isSameLine ? selection.anchor.with(undefined, 0) : selection.anchor,
            active = selection.active.character === 0 && !selection.isReversed && !isSameLine
              ? selection.active.translate(-1 + isFullLineDiff)
              : new vscode.Position(Selections.activeLine(selection) - 1 + isFullLineDiff, 0);

      return new vscode.Selection(anchor, active);
    });
  } else {
    Selections.update.byIndex((_, selection) => {
      const line = Math.max(Selections.activeLine(selection) - count + 1, 0),
            isSameLine = Selections.isSingleLine(selection);

      const anchor = isSameLine ? selection.anchor.with(undefined, 0) : selection.anchor,
            active = new vscode.Position(line - 1, 0);

      return new vscode.Selection(anchor, active);
    });
  }
}

/**
 * Select to line start.
 *
 * @keys `a-h` (normal), `home` (normal)
 *
 * #### Variants
 *
 * | Title                | Identifier         | Keybinding                          | Command                                        |
 * | -------------------- | ------------------ | ----------------------------------- | ---------------------------------------------- |
 * | Extend to line start | `lineStart.extend` | `s-a-h` (normal), `s-home` (normal) | `[".select.lineStart", { "shift": "extend" }]` |
 */
export function lineStart(
  _: Context,

  count: number,
  shift = Shift.Select,
) {
  if (count > 0) {
    const selection = _.selections[0],
          newLine = Math.min(_.document.lineCount - 1, count),
          newSelection = Selections.shift(selection, Positions.lineStart(newLine), shift);

    return Selections.set([newSelection]);
  }

  Selections.update.byIndex((_, selection) =>
    Selections.shift(selection, Positions.lineStart(Selections.activeLine(selection)), shift),
  );
}

/**
 * Select to line end.
 *
 * @keys `a-l` (normal), `end` (normal)
 *
 * #### Variants
 *
 * | Title              | Identifier       | Keybinding                         | Command                                      |
 * | ------------------ | ---------------- | ---------------------------------- | -------------------------------------------- |
 * | Extend to line end | `lineEnd.extend` | `s-a-l` (normal), `s-end` (normal) | `[".select.lineEnd", { "shift": "extend" }]` |
 */
export function lineEnd(
  _: Context,

  count: number,
  shift = Shift.Select,
) {
  if (count > 0) {
    const selection = _.selections[0],
          newLine = Math.min(_.document.lineCount - 1, count),
          newSelection = Selections.shift(selection, Positions.lineEnd(newLine), shift);

    return Selections.set([newSelection]);
  }

  Selections.update.byIndex((_, selection, doc) =>
    Selections.shift(selection, Positions.lineEnd(Selections.activeLine(selection), doc), shift),
  );
}
