import * as vscode from "vscode";
import { SelectionBehavior } from "../state/extension";
import { Direction, Shift } from ".";
import { Context } from "./context";
import { NotASelectionError } from "./errors";
import { Positions } from "./positions";
import { execRange, splitRange } from "../utils/regexp";
import { Lines } from "./lines";

/**
 * Sets the selections of the given editor.
 *
 * @param editor A `vscode.TextEditor` whose selections will be updated, or
 *   `undefined` to update the selections of the active text editor.
 *
 * ### Example
 *
 * ```js
 * const start = new vscode.Position(0, 6),
 *       end = new vscode.Position(0, 11);
 *
 * setSelections([new vscode.Selection(start, end)]);
 * ```
 *
 * Before:
 * ```
 * hello world
 * ^ 0
 * ```
 *
 * After:
 * ```
 * hello world
 *       ^^^^^ 0
 * ```
 *
 * ### Example
 * ```js
 * assert.throws(() => setSelections([]), EmptySelectionsError);
 * assert.throws(() => setSelections([1]), NotASelectionError);
 * ```
 */
export function setSelections(selections: readonly vscode.Selection[]) {
  NotASelectionError.throwIfNotASelectionArray(selections);

  Context.current.selections = selections;
  Selections.reveal(selections[0]);

  return selections;
}

/**
 * Removes selections that do not match the given predicate.
 *
 * @param selections The `vscode.Selection` array to filter from, or `undefined`
 *   to filter the selections of the active text editor.
 *
 * ### Example
 *
 * ```js
 * const atChar = (character) => new vscode.Position(0, character);
 *
 * assert.deepStrictEqual(
 *   filterSelections((text) => !isNaN(+text)),
 *   [new vscode.Selection(atChar(4), atChar(7))],
 * );
 * ```
 *
 * With:
 * ```
 * foo 123
 * ^^^ 0
 *     ^^^ 1
 * ```
 */
export function filterSelections(
  predicate: filterSelections.Predicate<boolean>,
  selections?: readonly vscode.Selection[],
): vscode.Selection[];

/**
 * Removes selections that do not match the given async predicate.
 *
 * @param selections The `vscode.Selection` array to filter from, or `undefined`
 *   to filter the selections of the active text editor.
 *
 * ### Example
 *
 * ```js
 * const atChar = (character) => new vscode.Position(0, character);
 *
 * assert.deepStrictEqual(
 *   await filterSelections(async (text) => !isNaN(+text)),
 *   [new vscode.Selection(atChar(4), atChar(7))],
 * );
 * ```
 *
 * With:
 * ```
 * foo 123
 * ^^^ 0
 *     ^^^ 1
 * ```
 */
export function filterSelections(
  predicate: filterSelections.Predicate<Thenable<boolean>>,
  selections?: readonly vscode.Selection[],
): Thenable<vscode.Selection[]>;

export function filterSelections(
  predicate: filterSelections.Predicate<boolean> | filterSelections.Predicate<Thenable<boolean>>,
  selections?: readonly vscode.Selection[],
) {
  return filterSelections.byIndex(
    (i, selection, document) => predicate(document.getText(selection), selection, i) as any,
    selections,
  ) as any;
}

export namespace filterSelections {
  /**
   * A predicate passed to `filterSelections`.
   */
  export interface Predicate<T extends boolean | Thenable<boolean>> {
    (text: string, selection: vscode.Selection, index: number): T;
  }

  /**
   * A predicate passed to `filterSelections.byIndex`.
   */
  export interface ByIndexPredicate<T extends boolean | Thenable<boolean>> {
    (index: number, selection: vscode.Selection, document: vscode.TextDocument): T;
  }

  /**
   * Removes selections that do not match the given predicate.
   *
   * @param selections The `vscode.Selection` array to filter from, or
   *   `undefined` to filter the selections of the active text editor.
   */
  export function byIndex(
    predicate: ByIndexPredicate<boolean>,
    selections?: readonly vscode.Selection[],
  ): vscode.Selection[];

  /**
   * Removes selections that do not match the given async predicate.
   *
   * @param selections The `vscode.Selection` array to filter from, or
   *   `undefined` to filter the selections of the active text editor.
   */
  export function byIndex(
    predicate: ByIndexPredicate<Thenable<boolean>>,
    selections?: readonly vscode.Selection[],
  ): Thenable<vscode.Selection[]>;

  export function byIndex(
    predicate: ByIndexPredicate<boolean> | ByIndexPredicate<Thenable<boolean>>,
    selections?: readonly vscode.Selection[],
  ) {
    const context = Context.current,
          document = context.document;

    if (selections === undefined) {
      selections = context.selections;
    }

    const firstSelection = selections[0],
          firstResult = predicate(0, firstSelection, document);

    if (typeof firstResult === "boolean") {
      if (selections.length === 1) {
        return firstResult ? [firstResult] : [];
      }

      const resultingSelections = firstResult ? [firstSelection] : [];

      for (let i = 1; i < selections.length; i++) {
        const selection = selections[i];

        if (predicate(i, selection, document) as boolean) {
          resultingSelections.push(selection);
        }
      }

      return resultingSelections;
    } else {
      if (selections.length === 1) {
        return context.then(firstResult, (value) => value ? [firstSelection] : []);
      }

      const promises = [firstResult];

      for (let i = 1; i < selections.length; i++) {
        const selection = selections[i];

        promises.push(predicate(i, selection, document) as Thenable<boolean>);
      }

      const savedSelections = selections.slice();  // In case the original
      //                                              selections are mutated.

      return context.then(Promise.all(promises), (results) => {
        const resultingSelections = [];

        for (let i = 0; i < results.length; i++) {
          if (results[i]) {
            resultingSelections.push(savedSelections[i]);
          }
        }

        return resultingSelections;
      });
    }
  }
}

/**
 * Applies a function to all the given selections, and returns the array of all
 * of its non-`undefined` results.
 *
 * @param selections The `vscode.Selection` array to map from, or `undefined`
 *   to map the selections of the active text editor.
 *
 * ### Example
 *
 * ```js
 * assert.deepStrictEqual(
 *   mapSelections((text) => isNaN(+text) ? undefined : +text),
 *   [123],
 * );
 * ```
 *
 * With:
 * ```
 * foo 123
 * ^^^ 0
 *     ^^^ 1
 * ```
 */
export function mapSelections<T>(
  f: mapSelections.Mapper<T | undefined>,
  selections?: readonly vscode.Selection[],
): vscode.Selection[];

/**
 * Applies an async function to all the given selections, and returns the array
 * of all of its non-`undefined` results.
 *
 * @param selections The `vscode.Selection` array to map from, or `undefined`
 *   to map the selections of the active text editor.
 *
 * ### Example
 *
 * ```js
 * assert.deepStrictEqual(
 *   await mapSelections(async (text) => isNaN(+text) ? undefined : +text),
 *   [123],
 * );
 * ```
 *
 * With:
 * ```
 * foo 123
 * ^^^ 0
 *     ^^^ 1
 * ```
 */
export function mapSelections<T>(
  f: mapSelections.Mapper<Thenable<T | undefined>>,
  selections?: readonly vscode.Selection[],
): Thenable<vscode.Selection[]>;

export function mapSelections<T>(
  f: mapSelections.Mapper<T | undefined> | mapSelections.Mapper<Thenable<T | undefined>>,
  selections?: readonly vscode.Selection[],
) {
  return mapSelections.byIndex(
    (i, selection, document) => f(document.getText(selection), selection, i),
    selections,
  ) as any;
}

export namespace mapSelections {
  /**
   * A mapper function passed to `mapSelections`.
   */
  export interface Mapper<T> {
    (text: string, selection: vscode.Selection, index: number): T;
  }

  /**
   * A mapper function passed to `mapSelections.byIndex`.
   */
  export interface ByIndexMapper<T> {
    (index: number, selection: vscode.Selection, document: vscode.TextDocument): T | undefined;
  }

  /**
   * Applies a function to all the given selections, and returns the array of
   * all of its non-`undefined` results.
   *
   * @param selections The `vscode.Selection` array to map from, or `undefined`
   *   to map the selections of the active text editor.
   */
  export function byIndex<T>(
    f: ByIndexMapper<T | undefined>,
    selections?: readonly vscode.Selection[],
  ): vscode.Selection[];

  /**
   * Applies an async function to all the given selections, and returns the
   * array of all of its non-`undefined` results.
   *
   * @param selections The `vscode.Selection` array to map from, or `undefined`
   *   to map the selections of the active text editor.
   */
  export function byIndex<T>(
    f: ByIndexMapper<Thenable<T | undefined>>,
    selections?: readonly vscode.Selection[],
  ): Thenable<vscode.Selection[]>;

  export function byIndex<T>(
    f: ByIndexMapper<T | undefined> | ByIndexMapper<Thenable<T | undefined>>,
    selections?: readonly vscode.Selection[],
  ) {
    const context = Context.current,
          document = context.document;

    if (selections === undefined) {
      selections = context.selections;
    }

    const firstSelection = selections[0],
          firstResult = f(0, firstSelection, document);

    if (firstResult === undefined || typeof (firstResult as Thenable<T>)?.then !== "function") {
      const results = firstResult !== undefined ? [firstResult as T] : [];

      for (let i = 1; i < selections.length; i++) {
        const selection = selections[i],
              value = f(i, selection, document) as T | undefined;

        if (value !== undefined) {
          results.push(value);
        }
      }

      return results;
    } else {
      if (selections.length === 1) {
        return context.then(firstResult as Thenable<T | undefined>, (result) => {
          return result !== undefined ? [result] : [];
        });
      }

      const promises = [firstResult as Thenable<T | undefined>];

      for (let i = 1; i < selections.length; i++) {
        const selection = selections[i],
              promise = f(i, selection, document) as Thenable<T | undefined>;

        promises.push(promise);
      }

      return context.then(Promise.all(promises), (results) => {
        const filteredResults = [];

        for (let i = 0; i < results.length; i++) {
          const result = results[i];

          if (result !== undefined) {
            filteredResults.push(result);
          }
        }

        return filteredResults;
      });
    }
  }
}

/**
 * Sets the selections of the current editor after transforming them according
 * to the given function.
 *
 * ### Example
 *
 * ```js
 * const reverseUnlessNumber = (text, sel) =>
 *   isNaN(+text) ? new vscode.Selection(sel.active, sel.anchor) : undefined;
 *
 * updateSelections(reverseUnlessNumber);
 * ```
 *
 * Before:
 * ```
 * foo 123
 * ^^^ 0
 *     ^^^ 1
 * ```
 *
 * After:
 * ```
 * foo 123
 * |^^ 0
 * ```
 *
 * ### Example
 *
 * ```js
 * assert.throws(() => updateSelections(() => undefined), EmptySelectionsError);
 * ```
 *
 * With:
 * ```
 * foo 123
 * ^^^ 0
 * ```
 */
export function updateSelections(
  f: mapSelections.Mapper<vscode.Selection | undefined>,
): vscode.Selection[];

/**
 * Sets the selections of the current editor after transforming them according
 * to the given async function.
 *
 * ### Example
 *
 * ```js
 * const reverseIfNumber = async (text, sel) =>
 *   !isNaN(+text) ? new vscode.Selection(sel.active, sel.anchor) : undefined;
 *
 * await updateSelections(reverseIfNumber);
 * ```
 *
 * Before:
 * ```
 * foo 123
 * ^^^ 0
 *     ^^^ 1
 * ```
 *
 * After:
 * ```
 * foo 123
 *     |^^ 0
 * ```
 */
export function updateSelections(
  f: mapSelections.Mapper<Thenable<vscode.Selection | undefined>>,
): Thenable<vscode.Selection[]>;

export function updateSelections(
  f: mapSelections.Mapper<vscode.Selection | undefined>
   | mapSelections.Mapper<Thenable<vscode.Selection | undefined>>,
): any {
  const selections = mapSelections(f as any);

  if (Array.isArray(selections)) {
    return setSelections(selections);
  }

  return (selections as Thenable<vscode.Selection[]>).then(setSelections);
}

export namespace updateSelections {
  /**
   * Sets the selections of the current editor after transforming them according
   * to the given function.
   */
  export function byIndex(
    f: mapSelections.ByIndexMapper<vscode.Selection | undefined>,
  ): vscode.Selection[];

  /**
   * Sets the selections of the current editor after transforming them according
   * to the given async function.
   */
  export function byIndex(
    f: mapSelections.ByIndexMapper<Thenable<vscode.Selection | undefined>>,
  ): Thenable<vscode.Selection[]>;

  export function byIndex(
    f: mapSelections.ByIndexMapper<vscode.Selection | undefined>
     | mapSelections.ByIndexMapper<Thenable<vscode.Selection | undefined>>,
  ): any {
    const selections = mapSelections.byIndex(f as any);

    if (Array.isArray(selections)) {
      return setSelections(selections);
    }

    return (selections as Thenable<vscode.Selection[]>).then(setSelections);
  }
}

/**
 * Rotates selections in the given direction.
 *
 * ### Example
 *
 * ```js
 * setSelections(rotateSelections(1));
 * ```
 *
 * Before:
 * ```
 * foo bar baz
 * ^^^ 0   ^^^ 2
 *     ^^^ 1
 * ```
 *
 * After:
 * ```
 * foo bar baz
 * ^^^ 1   ^^^ 0
 *     ^^^ 2
 * ```
 *
 * ### Example
 *
 * ```js
 * setSelections(rotateSelections(-1));
 * ```
 *
 * Before:
 * ```
 * foo bar baz
 * ^^^ 0   ^^^ 2
 *     ^^^ 1
 * ```
 *
 * After:
 * ```
 * foo bar baz
 * ^^^ 2   ^^^ 1
 *     ^^^ 0
 * ```
 */
export function rotateSelections(
  by: Direction | number,
  selections: readonly vscode.Selection[] = Context.current.selections,
) {
  const len = selections.length;

  // Handle negative values for `by`:
  by = (by % len) + len;

  if (by === len) {
    return selections.slice();
  }

  const newSelections = new Array<vscode.Selection>(selections.length);

  for (let i = 0; i < len; i++) {
    newSelections[(i + by) % len] = selections[i];
  }

  return newSelections;
}

/**
 * Returns an array containing all the unique lines included in the given or
 * active selections. Though the resulting array is not sorted, it is likely
 * that consecutive lines will be consecutive in the array as well.
 *
 * ### Example
 *
 * ```js
 * expect(selectionsLines()).to.have.members([0, 1, 3, 4, 5, 6]);
 * ```
 *
 * With:
 * ```
 * ab
 * ^^ 0
 * cd
 * ^ 1
 * ef
 * gh
 * ^ 2
 *  ^ 3
 * ij
 * ^ 3
 * kl
 * | 4
 * mn
 *  ^^ 5
 * op
 * ```
 */
export function selectionsLines(
  selections: readonly vscode.Selection[] = Context.current.selections,
) {
  const lines: number[] = [];

  for (const selection of selections) {
    const startLine = selection.start.line,
          endLine = Selections.endLine(selection);

    // The first and last lines of the selection may contain other selections,
    // so we check for duplicates with them. However, the intermediate
    // lines are known to belong to one selection only, so there's no need
    // for that with them.
    if (lines.indexOf(startLine) === -1) {
      lines.push(startLine);
    }

    for (let i = startLine + 1; i < endLine; i++) {
      lines.push(i);
    }

    if (endLine !== startLine && lines.indexOf(endLine) === -1) {
      lines.push(endLine);
    }
  }

  return lines;
}

/**
 * Returns the selections obtained by splitting the contents of all the given
 * selections using the given RegExp.
 */
export function splitSelections(re: RegExp, selections = Context.current.selections) {
  const document = Context.current.document;

  return Selections.map((text, selection) => {
    const offset = document.offsetAt(selection.start);

    return splitRange(text, re).map(([start, end]) =>
      Selections.fromStartEnd(offset + start, offset + end, selection.isReversed),
    );
  }, selections).flat();
}

/**
 * Returns the selections obtained by finding all the matches within the given
 * selections using the given RegExp.
 */
export function selectWithinSelections(re: RegExp, selections = Context.current.selections) {
  if (!re.global) {
    re = new RegExp(re.source, re.flags + "g");
  }

  const document = Context.current.document;

  return Selections.map((text, selection) => {
    const offset = document.offsetAt(selection.start);

    return execRange(text, re).map(([start, end]) =>
      Selections.fromStartEnd(offset + start, offset + end, selection.isReversed),
    );
  }, selections).flat();
}

/**
 * Reveals selections in the current editor.
 */
export function revealSelections(selection?: vscode.Selection) {
  const editor = Context.current.editor;

  editor.revealRange(selection ?? (editor as vscode.TextEditor).selection);
}

/**
 * Operations on `vscode.Selection`s.
 */
export namespace Selections {
  export const filter = filterSelections,
               lines = selectionsLines,
               map = mapSelections,
               reveal = revealSelections,
               rotate = rotateSelections,
               selectWithin = selectWithinSelections,
               set = setSelections,
               split = splitSelections,
               update = updateSelections;

  export declare const current: readonly vscode.Selection[];

  Object.defineProperty(Selections, "current", {
    get() {
      return Context.current.selections;
    },
  });

  /**
   * Returns a selection spanning the entire buffer.
   */
  export function wholeBuffer(document = Context.current.document) {
    return new vscode.Selection(Positions.zero, Positions.last(document));
  }

  /**
   * Returns the active position (or cursor) of a selection.
   */
  export function active(selection: vscode.Selection) {
    return selection.active;
  }

  /**
   * Returns the anchor position of a selection.
   */
  export function anchor(selection: vscode.Selection) {
    return selection.anchor;
  }

  /**
   * Returns the start position of a selection.
   */
  export function start(selection: vscode.Range) {
    return selection.start;
  }

  /**
   * Returns the end position of a selection.
   */
  export function end(selection: vscode.Range) {
    return selection.end;
  }

  /**
   * Returns the given selection if it faces forward (`active >= anchor`), or
   * the reverse of the given selection otherwise.
   */
  export function forward(selection: vscode.Selection) {
    const active = selection.active,
          anchor = selection.anchor;

    return active.isAfterOrEqual(anchor) ? selection : new vscode.Selection(active, anchor);
  }

  /**
   * Returns the given selection if it faces backward (`active <= anchor`), or
   * the reverse of the given selection otherwise.
   */
  export function backward(selection: vscode.Selection) {
    const active = selection.active,
          anchor = selection.anchor;

    return active.isBeforeOrEqual(anchor) ? selection : new vscode.Selection(active, anchor);
  }

  /**
   * Returns a new empty selection starting and ending at the given position.
   */
  export function empty(position: vscode.Position) {
    return new vscode.Selection(position, position);
  }

  /**
   * Returns whether the two given ranges overlap.
   */
  export function overlap(a: vscode.Range, b: vscode.Range) {
    const aStart = a.start,
          aEnd = a.end,
          bStart = b.start,
          bEnd = b.end;

    return !(aStart.line < bStart.line
            || (aEnd.line === bEnd.line && aEnd.character < bStart.character))
        && !(bStart.line < aStart.line
            || (bEnd.line === aEnd.line && bEnd.character < aStart.character));
  }

  /**
   * Returns the line of the end of the given selection. If the selection ends
   * at the first character of a line and is not empty, this is equal to
   * `end.line - 1`. Otherwise, this is `end.line`.
   */
  export function endLine(selection: vscode.Selection | vscode.Range) {
    const startLine = selection.start.line,
          end = selection.end,
          endLine = end.line,
          endCharacter = end.character;

    if (startLine !== endLine && endCharacter === 0) {
      // If the selection ends after a line break, do not consider the next line
      // selected. This is because a selection has to end on the very first
      // caret position of the next line in order to select the last line break.
      // For example, `vscode.TextLine.rangeIncludingLineBreak` does this:
      // https://github.com/microsoft/vscode/blob/c8b27b9db6afc26cf82cf07a9653c89cdd930f6a/src/vs/workbench/api/common/extHostDocumentData.ts#L273
      return endLine - 1;
    }

    return endLine;
  }

  /**
   * Returns the character of the end of the given selection. If the selection
   * ends at the first character of a line and is not empty, this is equal to
   * the length of the previous line plus one. Otherwise, this is
   * `end.character`.
   *
   * @see endLine
   */
  export function endCharacter(
    selection: vscode.Selection | vscode.Range,
    document?: vscode.TextDocument,
  ) {
    const startLine = selection.start.line,
          end = selection.end,
          endLine = end.line,
          endCharacter = end.character;

    if (startLine !== endLine && endCharacter === 0) {
      return (document ?? Context.current.document).lineAt(endLine - 1).text.length + 1;
    }

    return endCharacter;
  }

  /**
   * Returns the line of the active position of the given selection. If the
   * selection faces forward (the active position is the end of the selection),
   * returns `endLine(selection)`. Otherwise, returns `active.line`.
   */
  export function activeLine(selection: vscode.Selection) {
    if (selection.isReversed) {
      return selection.active.line;
    }

    return endLine(selection);
  }

  /**
   * Returns the character of the active position of the given selection.
   *
   * @see activeLine
   */
  export function activeCharacter(selection: vscode.Selection, document?: vscode.TextDocument) {
    if (selection.isReversed) {
      return selection.active.character;
    }

    return endCharacter(selection, document);
  }

  /**
   * Returns whether the selection spans a single line. This differs from
   * `selection.isSingleLine` because it also handles cases where the selection
   * wraps an entire line (its end position is on the first character of the
   * next line).
   */
  export function isSingleLine(selection: vscode.Selection) {
    return selection.start.line === endLine(selection);
  }

  /**
   * Returns whether the given selection has length `1`.
   */
  export function isSingleCharacter(
    selection: vscode.Selection | vscode.Range,
    document = Context.current.document,
  ) {
    const start = selection.start,
          end = selection.end;

    if (start.line === end.line) {
      return start.character === end.character - 1;
    }

    if (start.line === end.line - 1) {
      return end.character === 0 && document.lineAt(start.line).text.length === start.character;
    }

    return false;
  }

  /**
   * Returns whether the given selection has length `1` and corresponds to an
   * empty selection extended by one character by `fromCharacterMode`.
   */
  export function isNonDirectional(selection: vscode.Selection, context = Context.current) {
    return context.selectionBehavior === SelectionBehavior.Character
        && !selection.isReversed
        && isSingleCharacter(selection, context.document);
  }

  /**
   * The position from which a seek operation should start. This is equivalent
   * to `selection.active` except when the selection is non-directional, in
   * which case this is whatever position is **furthest** from the given
   * direction (in order to include the current character in the search).
   */
  export function seekFrom(
    selection: vscode.Selection,
    direction: Direction,
    position = selection.active,
    context = Context.current,
  ) {
    if (context.selectionBehavior === SelectionBehavior.Character) {
      const doc = context.document;

      return direction === Direction.Forward
        ? (position === selection.start ? position : Positions.previous(position, doc) ?? position)
        : (position === selection.end ? position : Positions.next(position, doc) ?? position);
    }

    return position;
  }

  /**
   * Returns the start position of the active character of the selection.
   *
   * If the current character behavior is `Caret`, this is `selection.active`.
   */
  export function activeStart(selection: vscode.Selection, context = Context.current) {
    const active = selection.active;

    if (context.selectionBehavior !== SelectionBehavior.Character) {
      return active;
    }

    const start = selection.start;

    if (isSingleCharacter(selection, context.document)) {
      return start;
    }

    return active === start ? start : Positions.previous(active, context.document)!;
  }

  /**
   * Returns the end position of the active character of the selection.
   *
   * If the current character behavior is `Caret`, this is `selection.active`.
   */
  export function activeEnd(selection: vscode.Selection, context = Context.current) {
    const active = selection.active;

    if (context.selectionBehavior !== SelectionBehavior.Character) {
      return active;
    }

    const end = selection.end;

    if (isSingleCharacter(selection, context.document)) {
      return end;
    }

    return active === end ? end : Positions.next(active, context.document)!;
  }

  /**
   * Returns `activeStart(selection)` if `direction === Backward`, and
   * `activeEnd(selection)` otherwise.
   */
  export function activeTowards(
    selection: vscode.Selection,
    direction: Direction,
    context = Context.current,
  ) {
    return direction === Direction.Backward
      ? activeStart(selection, context)
      : activeEnd(selection, context);
  }

  /**
   * Shifts the given selection to the given position using the specified
   * `Shift` behavior:
   * - If `Shift.Jump`, `result.active == result.anchor == position`.
   * - If `Shift.Select`, `result.active == position`, `result.anchor == selection.active`.
   * - If `Shift.Extend`, `result.active == position`, `result.anchor == selection.anchor`.
   *
   * ### Example
   *
   * ```js
   * const s1 = selection().empty(0, 0),
   *       shifted1 = Selections.shift(s1, position(0, 4), Select);
   *
   * expect(shifted1, "to be ");
   * ```
   *
   * With
   *
   * ```
   * line with 23 characters
   * ```
   *
   * ### Example
   *
   * ```js
   * Context.current._selectionBehavior = 2;  // Character
   * ```
   */
  export function shift(
    selection: vscode.Selection,
    position: vscode.Position,
    shift: Shift,
    context = Context.current,
  ) {
    let anchor = shift === Shift.Jump
      ? position
      : shift === Shift.Select
        ? selection.active
        : selection.anchor;

    if (context.selectionBehavior === SelectionBehavior.Character && shift !== Shift.Jump) {
      const direction = anchor.isAfter(position) ? Direction.Backward : Direction.Forward;

      anchor = seekFrom(selection, direction, anchor, context);
    }

    return new vscode.Selection(anchor, position);
  }

  /**
   * Same as `shift`, but also extends the active character towards the given
   * direction in character selection mode. If `direction === Forward`, the
   * active character will be selected such that
   * `activeEnd(selection) === active`. If `direction === Backward`, the
   * active character will be selected such that
   * `activeStart(selection) === active`.
   */
  export function shiftTowards(
    selection: vscode.Selection,
    position: vscode.Position,
    shift: Shift,
    direction: Direction,
    context = Context.current,
  ) {
    if (context.selectionBehavior === SelectionBehavior.Character
        && direction === Direction.Backward) {
      position = Positions.next(position) ?? position;
    }

    return Selections.shift(selection, position, shift, context);
  }

  /**
   * Returns whether the given selection spans an entire line.
   *
   * ### Example
   *
   * ```js
   * expect(Selections.isEntireLine(Selections.current[0]), "to be true");
   * expect(Selections.isEntireLine(Selections.current[1]), "to be false");
   * ```
   *
   * With:
   * ```
   * abc
   * ^^^^ 0
   * def
   * ^^^ 1
   * ```
   *
   * ### Example
   * Use `isEntireLines` for multi-line selections.
   *
   * ```js
   * expect(Selections.isEntireLine(Selections.current[0]), "to be false");
   * ```
   *
   * With:
   * ```
   * abc
   * ^^^^ 0
   * def
   * ^^^^ 0
   * ```
   */
  export function isEntireLine(selection: vscode.Selection | vscode.Range) {
    const start = selection.start,
          end = selection.end;

    return start.character === 0 && end.character === 0 && start.line === end.line - 1;
  }

  /**
   * Returns whether the given selection spans one or more entire lines.
   *
   * ### Example
   *
   * ```js
   * expect(Selections.isEntireLines(Selections.current[0]), "to be true");
   * expect(Selections.isEntireLines(Selections.current[1]), "to be true");
   * expect(Selections.isEntireLines(Selections.current[2]), "to be false");
   * ```
   *
   * With:
   * ```
   * abc
   * ^^^^ 0
   * def
   * ^^^^ 0
   * ghi
   * ^^^^ 1
   * jkl
   * ^^^^ 2
   * mno
   * ^^^ 2
   * ```
   */
  export function isEntireLines(selection: vscode.Selection | vscode.Range) {
    const start = selection.start,
          end = selection.end;

    return start.character === 0 && end.character === 0 && start.line !== end.line;
  }

  export function endsWithEntireLine(selection: vscode.Selection | vscode.Range) {
    const end = selection.end;

    return end.character === 0 && selection.start.line !== end.line;
  }

  export function isMovingTowardsAnchor(selection: vscode.Selection, direction: Direction) {
    return direction === Direction.Backward
      ? selection.active === selection.end
      : selection.active === selection.start;
  }

  /**
   * Returns the length of the given selection.
   *
   * ### Example
   *
   * ```js
   * expect(Selections.length(Selections.current[0]), "to be", 7);
   * expect(Selections.length(Selections.current[1]), "to be", 1);
   * expect(Selections.length(Selections.current[2]), "to be", 0);
   * ```
   *
   * With:
   * ```
   * abc
   * ^^^^ 0
   * def
   * ^^^ 0
   * ghi
   * ^ 1
   *   | 2
   * ```
   */
  export function length(
    selection: vscode.Selection | vscode.Range,
    document = Context.current.document,
  ) {
    const start = selection.start,
          end = selection.end;

    if (start.line === end.line) {
      return end.character - start.character;
    }

    return document.offsetAt(end) - document.offsetAt(start);
  }

  /**
   * Returns a selection starting at the given position or offset and with the
   * specified length.
   */
  export function fromLength(
    start: number | vscode.Position,
    length: number,
    reversed = false,
    document = Context.current.document,
  ) {
    let startOffset: number,
        startPosition: vscode.Position;

    if (length === 0) {
      if (typeof start === "number") {
        startPosition = document.positionAt(start);
      } else {
        startPosition = start;
      }

      return new vscode.Selection(startPosition, startPosition);
    }

    if (typeof start === "number") {
      startOffset = start;
      startPosition = document.positionAt(start);
    } else {
      startOffset = document.offsetAt(start);
      startPosition = start;
    }

    const endPosition = document.positionAt(startOffset + length);

    return reversed
      ? new vscode.Selection(endPosition, startPosition)
      : new vscode.Selection(startPosition, endPosition);
  }

  /**
   * Returns a new selection given its start and end positions. If `reversed` is
   * false, the returned solution will be such that `start === anchor` and
   * `end === active`. Otherwise, the returned solution will be such that
   * `start === active` and `end === anchor`.
   *
   * ### Example
   *
   * ```js
   * const p0 = new vscode.Position(0, 0),
   *       p1 = new vscode.Position(0, 1);
   *
   * expect(Selections.fromStartEnd(p0, p1, false), "to satisfy", {
   *   start: p0,
   *   end: p1,
   *   anchor: p0,
   *   active: p1,
   *   isReversed: false,
   * });
   *
   * expect(Selections.fromStartEnd(p0, p1, true), "to satisfy", {
   *   start: p0,
   *   end: p1,
   *   anchor: p1,
   *   active: p0,
   *   isReversed: true,
   * });
   * ```
   */
  export function fromStartEnd(
    start: vscode.Position | number,
    end: vscode.Position | number,
    reversed: boolean,
    document?: vscode.TextDocument,
  ) {
    if (typeof start === "number") {
      if (document === undefined) {
        document = Context.current.document;
      }

      start = document.positionAt(start);
    }

    if (typeof end === "number") {
      if (document === undefined) {
        document = Context.current.document;
      }

      end = document.positionAt(end);
    }

    return reversed ? new vscode.Selection(end, start) : new vscode.Selection(start, end);
  }

  /**
   * Transforms a list of caret-mode selections (that is, regular selections as
   * manipulated internally) into a list of character-mode selections (that is,
   * selections modified to include a block character in them).
   *
   * This function should be used before setting the selections of a
   * `vscode.TextEditor` if the selection behavior is `Character`.
   *
   * ### Example
   * Forward-facing, non-empty selections are reduced by one character.
   *
   * ```js
   * expect(Selections.toCharacterMode([selection().anchor(0, 0).active(0, 1)]), "to satisfy", [
   *   expect.it("to be empty at coords", 0, 0),
   * ]);
   *
   * expect(Selections.toCharacterMode([selection().anchor(0, 1).active(1, 0)]), "to satisfy", [
   *   expect.it("to be empty at coords", 0, 1),
   * ]);
   *
   * expect(Selections.toCharacterMode([selection().anchor(0, 0).active(1, 1)]), "to satisfy", [
   *   expect.it("to have anchor at coords", 0, 0).and("to have cursor at coords", 1, 0),
   * ]);
   *
   * // Same lines as above, but with anchor and active reversed: nothing changes.
   * expect(Selections.toCharacterMode([selection().active(0, 0).anchor(0, 1)]), "to satisfy", [
   *   selection().active(0, 0).anchor(0, 1),
   * ]);
   *
   * expect(Selections.toCharacterMode([selection().active(0, 1).anchor(1, 0)]), "to satisfy", [
   *   selection().active(0, 1).anchor(1, 0),
   * ]);
   *
   * expect(Selections.toCharacterMode([selection().active(0, 0).anchor(1, 1)]), "to satisfy", [
   *   selection().active(0, 0).anchor(1, 1),
   * ]);
   * ```
   *
   * With:
   * ```
   * a
   * b
   * ```
   */
  export function toCharacterMode(
    selections: readonly vscode.Selection[],
    document?: vscode.TextDocument,
  ) {
    const characterModeSelections = [] as vscode.Selection[];

    for (const selection of selections) {
      const selectionActive = selection.active,
            selectionActiveLine = selectionActive.line,
            selectionActiveCharacter = selectionActive.character,
            selectionAnchor = selection.anchor,
            selectionAnchorLine = selectionAnchor.line,
            selectionAnchorCharacter = selectionAnchor.character;
      let active = selectionActive,
          anchor = selectionAnchor,
          changed = false;

      if (selectionAnchorLine === selectionActiveLine) {
        if (selectionAnchorCharacter === selectionActiveCharacter) {
          // Selection is empty: go to previous position.
          anchor = active = Positions.previous(active, document) ?? active;
          changed = active !== selectionActive;
        } else if (selectionAnchorCharacter + 1 === selectionActiveCharacter) {
          // Selection is one-character long: make it empty.
          active = selectionAnchor;
          changed = true;
        } else if (selectionAnchorCharacter - 1 === selectionActiveCharacter) {
          // Selection is reversed and one-character long: make it empty.
          anchor = selectionActive;
          changed = true;
        } else if (selectionAnchorCharacter < selectionActiveCharacter) {
          // Selection is strictly forward-facing: make it shorter.
          active = new vscode.Position(selectionActiveLine, selectionActiveCharacter - 1);
          changed = true;
        } else {
          // Selection is reversed: do nothing.
        }
      } else if (selectionAnchorLine < selectionActiveLine) {
        // Selection is strictly forward-facing: make it shorter.
        if (selectionActiveCharacter > 0) {
          active = new vscode.Position(selectionActiveLine, selectionActiveCharacter - 1);
          changed = true;
        } else {
          // The active character is the first one, so we have to get some
          // information from the document.
          if (document === undefined) {
            document = Context.current.document;
          }

          const activePrevLine = selectionActiveLine - 1,
                activePrevLineLength = document.lineAt(activePrevLine).text.length;

          active = new vscode.Position(activePrevLine, activePrevLineLength);
          changed = true;
        }
      } else if (selectionAnchorLine === selectionActiveLine + 1
                 && selectionAnchorCharacter === 0
                 && selectionActiveCharacter === Lines.length(selectionActiveLine, document)) {
        // Selection is reversed and one-character long: make it empty.
        anchor = selectionActive;
        changed = true;
      } else {
        // Selection is reversed: do nothing.
      }

      characterModeSelections.push(changed ? new vscode.Selection(anchor, active) : selection);
    }

    return characterModeSelections;
  }

  /**
   * Reverses the changes made by `toCharacterMode` by increasing by one the
   * length of every empty or forward-facing selection.
   *
   * This function should be used on the selections of a `vscode.TextEditor` if
   * the selection behavior is `Character`.
   *
   * ### Example
   * Selections remain empty in empty documents.
   *
   * ```js
   * expect(Selections.fromCharacterMode([selection().empty(0, 0)]), "to satisfy", [
   *   expect.it("to be empty at coords", 0, 0),
   * ]);
   * ```
   *
   * With:
   * ```
   * ```
   *
   * ### Example
   * Empty selections automatically become 1-character selections.
   *
   * ```js
   * expect(Selections.fromCharacterMode([selection().empty(0, 0)]), "to satisfy", [
   *   expect.it("to have anchor at coords", 0, 0).and("to have cursor at coords", 0, 1),
   * ]);
   *
   * // At the end of the line, it selects the line ending:
   * expect(Selections.fromCharacterMode([selection().empty(0, 1)]), "to satisfy", [
   *   expect.it("to have anchor at coords", 0, 1).and("to have cursor at coords", 1, 0),
   * ]);
   *
   * // But it does nothing at the end of the document:
   * expect(Selections.fromCharacterMode([selection().empty(2, 0)]), "to satisfy", [
   *   expect.it("to be empty at coords", 2, 0),
   * ]);
   * ```
   *
   * With:
   * ```
   * a
   * b
   * ```
   */
  export function fromCharacterMode(
    selections: readonly vscode.Selection[],
    document?: vscode.TextDocument,
  ) {
    const caretModeSelections = [] as vscode.Selection[];

    for (const selection of selections) {
      const selectionActive = selection.active,
            selectionActiveLine = selectionActive.line,
            selectionActiveCharacter = selectionActive.character,
            selectionAnchor = selection.anchor,
            selectionAnchorLine = selectionAnchor.line,
            selectionAnchorCharacter = selectionAnchor.character;
      let active = selectionActive,
          changed = false;

      const isEmptyOrForwardFacing = selectionAnchorLine < selectionActiveLine
        || (selectionAnchorLine === selectionActiveLine
            && selectionAnchorCharacter <= selectionActiveCharacter);

      if (isEmptyOrForwardFacing) {
        // Selection is empty or forward-facing: extend it if possible.
        if (document === undefined) {
          document = Context.current.document;
        }

        const lineLength = document.lineAt(selectionActiveLine).text.length;

        if (selectionActiveCharacter === lineLength) {
          // Character is at the end of the line.
          if (selectionActiveLine + 1 < document.lineCount) {
            // This is not the last line: we can extend the selection.
            active = new vscode.Position(selectionActiveLine + 1, 0);
            changed = true;
          } else {
            // This is the last line: we cannot do anything.
          }
        } else {
          // Character is not at the end of the line: we can extend the selection.
          active = new vscode.Position(selectionActiveLine, selectionActiveCharacter + 1);
          changed = true;
        }
      }

      caretModeSelections.push(changed ? new vscode.Selection(selectionAnchor, active) : selection);
    }

    return caretModeSelections;
  }
}
