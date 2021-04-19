import * as vscode from "vscode";
import * as api from "../api";

import { Argument } from ".";
import { Context, Direction, Lines, Positions, Selections, Shift, showMenu, todo } from "../api";
import { SelectionBehavior } from "../state/modes";
import { PerEditorState } from "../state/editors";

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

interface PreferredColumnsState {
  disposable: vscode.Disposable;
  expectedSelections: readonly vscode.Selection[];
  preferredColumns: number[];
}

const preferredColumnsToken =
  PerEditorState.registerState<PreferredColumnsState>(/* isDisposable= */ false);

/**
 * Select vertically.
 *
 * #### Variants
 *
 * | Title                | Identifier    | Keybinding                        | Command                                                          |
 * | -----------          | ------------- | --------------------------------- | ---------------------------------------------------------------- |
 * | Jump down            | `down.jump`   | `j` (normal)  , `down` (normal)   | `[".select.vertically", { "direction":  1, "shift": "jump"   }]` |
 * | Extend down          | `down.extend` | `s-j` (normal), `s-down` (normal) | `[".select.vertically", { "direction":  1, "shift": "extend" }]` |
 * | Jump up              | `up.jump`     | `k` (normal)  , `up` (normal)     | `[".select.vertically", { "direction": -1, "shift": "jump"   }]` |
 * | Extend up            | `up.extend`   | `s-k` (normal), `s-up` (normal)   | `[".select.vertically", { "direction": -1, "shift": "extend" }]` |
 *
 * The following keybindings are also defined:
 *
 * | Keybinding                     | Command                                                         |
 * | ------------------------------ | --------------------------------------------------------------- |
 * | `c-f` (normal), `c-f` (insert) | `[".select.vertically", { "by": "page"    , "direction":  1 }]` |
 * | `c-d` (normal), `c-d` (insert) | `[".select.vertically", { "by": "halfPage", "direction":  1 }]` |
 * | `c-b` (normal), `c-b` (insert) | `[".select.vertically", { "by": "page"    , "direction": -1 }]` |
 * | `c-u` (normal), `c-u` (insert) | `[".select.vertically", { "by": "halfPage", "direction": -1 }]` |
 */
export function vertically(
  _: Context,
  selections: readonly vscode.Selection[],

  repetitions: number,
  direction = Direction.Forward,
  shift = Shift.Select,
  by?: Argument<"page" | "halfPage">,
) {
  // Adjust repetitions if a `by` parameter is given.
  if (by !== undefined) {
    const visibleRange = _.editor.visibleRanges[0];

    if (by === "page") {
      repetitions *= visibleRange.end.line - visibleRange.start.line;
    } else if (by === "halfPage") {
      repetitions *= ((visibleRange.end.line - visibleRange.start.line) / 2) | 0;
    }
  }

  const document = _.document,
        isCharacterMode = _.selectionBehavior === SelectionBehavior.Character;

  const activeEnd = (selection: vscode.Selection) => {
    const active = selection.active;

    if (active === selection.end && Selections.endsWithEntireLine(selection)) {
      return Lines.length(active.line - 1, document) + 1;
    } else if (active === selection.start && isCharacterMode) {
      return active.character + 1;
    }

    return active.character;
  };

  // Get or create the `PreferredColumnsState` for this editor.
  const editorState = _.getState();
  let preferredColumnsState = editorState.get(preferredColumnsToken);

  if (preferredColumnsState === undefined) {
    // That disposable will be automatically disposed of when the selections in
    // the editor change due to an action outside of the current command. When
    // it is disposed, it will clear the preferred columns for this editor.
    const disposable = _.extension
      .createAutoDisposable()
      .disposeOnEvent(editorState.onEditorWasClosed)
      .addDisposable(vscode.window.onDidChangeTextEditorSelection((e) => {
        if (editorState.editor !== e.textEditor) {
          return;
        }

        const expectedSelections = preferredColumnsState!.expectedSelections;

        if (e.selections.length === expectedSelections.length
            && e.selections.every((sel, i) => sel.isEqual(expectedSelections[i]))) {
          return;
        }

        editorState.store(preferredColumnsToken, undefined);
        disposable.dispose();
      }));

    editorState.store(
      editorState,
      preferredColumnsState = {
        disposable,
        expectedSelections: [],
        preferredColumns: selections.map((sel) => activeEnd(sel)),
      },
    );
  }

  Selections.update.byIndex((i, selection) => {
    const activeLine = Selections.activeLine(selection),
          targetLine = Lines.clamp(activeLine + repetitions * direction, document),
          targetLineLength = Lines.length(targetLine, document);

    if (targetLineLength === 0) {
      let targetPosition = Positions.lineStart(targetLine);

      if (isCharacterMode) {
        targetPosition = Positions.next(targetPosition, document) ?? targetPosition;
      }

      return Selections.shift(selection, targetPosition, shift);
    }

    let targetColumn: number;

    const preferredColumns = preferredColumnsState!.preferredColumns,
          preferredColumn = i < preferredColumns.length
            ? preferredColumns[i]
            : activeEnd(selection);

    if (preferredColumn <= targetLineLength) {
      targetColumn = preferredColumn;
    } else if (isCharacterMode && targetLine + 1 < document.lineCount) {
      return Selections.shift(selection, new vscode.Position(targetLine + 1, 0), shift);
    } else {
      targetColumn = targetLineLength;
    }

    let newPosition = new vscode.Position(targetLine, targetColumn);

    if (isCharacterMode && shift !== Shift.Jump) {
      const edge = shift === Shift.Extend ? selection.anchor : selection.active;

      if (newPosition.isBefore(edge)) {
        // Selection is going up or down above the cursor: we must account for
        // the translation to character mode.
        newPosition = Positions.previous(newPosition, document) ?? newPosition;
      }
    }

    return Selections.shift(selection, newPosition, shift);
  });

  preferredColumnsState.expectedSelections = editorState.editor.selections;
}

/**
 * Select horizontally.
 *
 * #### Variants
 *
 * | Title        | Identifier     | Keybinding                         | Command                                                            |
 * | ------------ | -------------- | ---------------------------------- | ------------------------------------------------------------------ |
 * | Jump right   | `right.jump`   | `l` (normal)  , `right` (normal)   | `[".select.horizontally", { "direction":  1, "shift": "jump"   }]` |
 * | Extend right | `right.extend` | `s-l` (normal), `s-right` (normal) | `[".select.horizontally", { "direction":  1, "shift": "extend" }]` |
 * | Jump left    | `left.jump`    | `h` (normal)  , `left` (normal)    | `[".select.horizontally", { "direction": -1, "shift": "jump"   }]` |
 * | Extend left  | `left.extend`  | `s-h` (normal), `s-left` (normal)  | `[".select.horizontally", { "direction": -1, "shift": "extend" }]` |
 */
export function horizontally(
  _: Context,

  repetitions: number,
  direction = Direction.Forward,
  shift = Shift.Select,
) {
  const mayNeedAdjustment = direction === Direction.Backward
                         && _.selectionBehavior === SelectionBehavior.Character;

  Selections.update.byIndex((_i, selection) => {
    let active = selection.active === selection.start
      ? Selections.activeStart(selection, _)
      : Selections.activeEnd(selection, _);

    if (mayNeedAdjustment) {
      if (shift === Shift.Extend && Selections.isSingleCharacter(selection)) {
        active = selection.start;
      } else if (shift === Shift.Jump && selection.active === selection.start) {
        active = Positions.next(active, _.document) ?? active;
      }
    }

    return Selections.shift(
      selection,
      Positions.offset(active, direction * repetitions, _.document) ?? active,
      shift,
    );
  });
}

/**
 * Select to.
 *
 * If a count is specified, this command will shift to the start of the given
 * line. If no count is specified, this command will shift open the `goto` menu.
 *
 * #### Variants
 *
 * | Title     | Identifier  | Keybinding     | Command                                 |
 * | --------- | ----------- | -------------- | --------------------------------------- |
 * | Go to     | `to.jump`   | `g` (normal)   | `[".select.to", { "shift": "jump" }]`   |
 * | Extend to | `to.extend` | `s-g` (normal) | `[".select.to", { "shift": "extend" }]` |
 */
export function to(
  _: Context,
  count: number,
  argument: object,
  shift = Shift.Select,
) {
  if (count === 0) {
    // TODO: Make just merely opening the menu not count as a command execution
    // and do not record it.
    return showMenu.byName("goto", [argument]);
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
      const lastLine = document.lineCount - 1;
      let line = Math.min(Selections.activeLine(selection) + count - 1, lastLine);

      if (Selections.isEntireLines(selection) && line < lastLine) {
        line++;
      }

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
      let line = Math.max(Selections.activeLine(selection) - count + 1, 0);

      if (!Selections.isEntireLines(selection)) {
        line++;
      }

      return new vscode.Selection(line, 0, line - 1, 0);
    });
  }
}

/**
 * Extend to line above.
 */
export function line_above_extend(_: Context, count: number) {
  if (count === 0 || count === 1) {
    Selections.update.byIndex((_, selection) => {
      if (selection.isSingleLine) {
        let line = Selections.activeLine(selection);

        if (!Selections.isEntireLines(selection)) {
          line++;
        }

        return new vscode.Selection(line, 0, line - 1, 0);
      }

      if (selection.active === selection.end && Selections.isEntireLine(selection)) {
        const line = Selections.activeLine(selection);

        return new vscode.Selection(line + 1, 0, line - 1, 0);
      }

      const isFullLine = Selections.activeLineIsFullySelected(selection),
            isFullLineDiff = isFullLine ? -1 : 0,
            active = new vscode.Position(Selections.activeLine(selection) + isFullLineDiff, 0);

      return new vscode.Selection(selection.anchor, active);
    });
  } else {
    Selections.update.byIndex((_, selection, document) => {
      let line = Math.max(Selections.activeLine(selection) - count, 0),
          anchor = selection.anchor;

      if (selection.active === selection.end) {
        anchor = selection.active;
      }

      if (selection.isSingleLine) {
        anchor = Positions.lineBreak(selection.anchor.line, document);
        line++;
      } else if (!Selections.startsWithEntireLine(selection)) {
        line++;
      }

      return new vscode.Selection(anchor, new vscode.Position(line, 0));
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
 * | Title                             | Identifier                   | Keybinding                          | Command                                                           |
 * | --------------------              | ------------------           | ----------------------------------- | ----------------------------------------------------------------- |
 * | Jump to line start                | `lineStart.jump`             |                                     | `[".select.lineStart", { "shift": "jump" }]`                      |
 * | Extend to line start              | `lineStart.extend`           | `s-a-h` (normal), `s-home` (normal) | `[".select.lineStart", { "shift": "extend" }]`                    |
 * | Jump to line start (skip blank)   | `lineStart.skipBlank.jump`   |                                     | `[".select.lineStart", { "skipBlank": true, "shift": "jump" }]`   |
 * | Extend to line start (skip blank) | `lineStart.skipBlank.extend` |                                     | `[".select.lineStart", { "skipBlank": true, "shift": "extend" }]` |
 * | Jump to first line                | `firstLine.jump`             |                                     | `[".select.lineStart", { "count": 0, "shift": "jump" }]`          |
 * | Extend to first line              | `firstLine.extend`           |                                     | `[".select.lineStart", { "count": 0, "shift": "extend" }]`        |
 */
export function lineStart(
  _: Context,

  count: number,
  shift = Shift.Select,
  skipBlank = false,
) {
  if (count > 0) {
    const selection = _.selections[0],
          newLine = Math.min(_.document.lineCount, count) - 1,
          newPosition = skipBlank
            ? Positions.nonBlankLineStart(newLine, _.document)
            : Positions.lineStart(newLine),
          newSelection = Selections.shiftTowards(selection, newPosition, shift, api.Backward);

    Selections.set([newSelection]);
    Selections.reveal();

    return;
  }

  Selections.update.byIndex((_, selection) =>
    Selections.shiftTowards(
      selection,
      skipBlank
        ? Positions.nonBlankLineStart(Selections.activeLine(selection))
        : Positions.lineStart(Selections.activeLine(selection)),
      shift,
      api.Backward,
    ),
  );
}

/**
 * Select to line end.
 *
 * @keys `a-l` (normal), `end` (normal)
 *
 * #### Variants
 *
 * | Title                    | Identifier           | Keybinding                         | Command                                                        |
 * | ------------------------ | -------------------- | ---------------------------------- | -------------------------------------------------------------- |
 * | Extend to line end       | `lineEnd.extend`     | `s-a-l` (normal), `s-end` (normal) | `[".select.lineEnd", { "shift": "extend" }]`                   |
 * | Jump to last character   | `documentEnd.jump`   |                                    | `[".select.lineEnd", { "count": MAX_INT, "shift": "jump" }]`   |
 * | Extend to last character | `documentEnd.extend` |                                    | `[".select.lineEnd", { "count": MAX_INT, "shift": "extend" }]` |
 */
export function lineEnd(
  _: Context,

  count: number,
  shift = Shift.Select,
) {
  if (count > 0) {
    const selection = _.selections[0],
          newLine = Math.min(_.document.lineCount, count) - 1,
          newSelection = Selections.shift(selection, Positions.lineEnd(newLine), shift);

    Selections.set([newSelection]);
    Selections.reveal();

    return;
  }

  Selections.update.byIndex((_, selection, doc) =>
    Selections.shift(selection, Positions.lineEnd(Selections.activeLine(selection), doc), shift),
  );
}

/**
 * Select to last line.
 *
 * #### Variants
 *
 * | Title               | Identifier        | Command                                       |
 * | ------------------- | ----------------- | --------------------------------------------- |
 * | Jump to last line   | `lastLine.jump`   | `[".select.lastLine", { "shift": "jump" }]`   |
 * | Extend to last line | `lastLine.extend` | `[".select.lastLine", { "shift": "extend" }]` |
 */
export function lastLine(_: Context, document: vscode.TextDocument, shift = Shift.Select) {
  let line = document.lineCount - 1;

  // In case of trailing line break, go to the second last line.
  if (line > 0 && document.lineAt(document.lineCount - 1).text.length === 0) {
    line--;
  }

  Selections.set([Selections.shift(_.mainSelection, Positions.lineStart(line), shift)]);
}

/**
 * Select to first visible line.
 *
 * #### Variants
 *
 * | Title                        | Identifier                | Command                                               |
 * | ---------------------------- | ------------------------- | ----------------------------------------------------- |
 * | Jump to first visible line   | `firstVisibleLine.jump`   | `[".select.firstVisibleLine", { "shift": "jump" }]`   |
 * | Extend to first visible line | `firstVisibleLine.extend` | `[".select.firstVisibleLine", { "shift": "extend" }]` |
 */
export function firstVisibleLine(_: Context, shift = Shift.Select) {
  const selection = _.mainSelection,
        toPosition = Positions.lineStart(api.firstVisibleLine(_.editor));

  Selections.set([Selections.shift(selection, toPosition, shift)]);
}

/**
 * Select to middle visible line.
 *
 * #### Variants
 *
 * | Title                         | Identifier                 | Command                                                |
 * | ----------------------------- | -------------------------- | ------------------------------------------------------ |
 * | Jump to middle visible line   | `middleVisibleLine.jump`   | `[".select.middleVisibleLine", { "shift": "jump" }]`   |
 * | Extend to middle visible line | `middleVisibleLine.extend` | `[".select.middleVisibleLine", { "shift": "extend" }]` |
 */
export function middleVisibleLine(_: Context, shift = Shift.Select) {
  const selection = _.mainSelection,
        toPosition = Positions.lineStart(api.middleVisibleLine(_.editor));

  Selections.set([Selections.shift(selection, toPosition, shift)]);
}

/**
 * Select to last visible line.
 *
 * #### Variants
 *
 * | Title                       | Identifier               | Command                                              |
 * | --------------------------- | ------------------------ | ---------------------------------------------------- |
 * | Jump to last visible line   | `lastVisibleLine.jump`   | `[".select.lastVisibleLine", { "shift": "jump" }]`   |
 * | Extend to last visible line | `lastVisibleLine.extend` | `[".select.lastVisibleLine", { "shift": "extend" }]` |
 */
export function lastVisibleLine(_: Context, shift = Shift.Select) {
  const selection = _.mainSelection,
        toPosition = Positions.lineStart(api.lastVisibleLine(_.editor));

  Selections.set([Selections.shift(selection, toPosition, shift)]);
}

/**
 * Select to last modification.
 *
 * #### Variants
 *
 * | Title                       | Identifier                | Command                                               |
 * | --------------------------- | ------------------------- | ----------------------------------------------------- |
 * | Jump to last modification   | `lastModification.jump`   | `[".select.lastModification", { "shift": "jump" }]`   |
 * | Extend to last modification | `lastModification.extend` | `[".select.lastModification", { "shift": "extend" }]` |
 */
export function lastModification(_: Context, shift = Shift.Select) {
  const selection = _.mainSelection,
        toPosition = todo();

  Selections.set([Selections.shift(selection, toPosition, shift)]);
}
