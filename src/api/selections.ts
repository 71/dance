import * as vscode from "vscode";
import { Direction } from "../utils/selection-helper";
import { Context } from "./context";

/**
 * An error thrown when no selections remain.
 */
export class EmptySelectionsError extends Error {
  public constructor(message = "no selections remain") {
    super(message);
  }

  /**
   * Throws if the given selections are empty.
   */
  public static throwIfEmpty(selections: readonly vscode.Selection[]) {
    if (selections.length === 0) {
      throw new EmptySelectionsError();
    }
  }

  /**
   * Throws if the selections of the given register are empty.
   */
  public static throwIfRegisterIsEmpty(
    selections: readonly vscode.Selection[] | undefined,
    registerName: string,
  ): asserts selections is readonly vscode.Selection[] {
    if (selections === undefined || selections.length === 0) {
      throw new EmptySelectionsError(`no selections are saved in register "${registerName}"`);
    }
  }
}

/**
 * An error thrown when a function that is expected to return a selection
 * returns something else.
 */
export class NotASelectionError extends Error {
  public constructor(public readonly value: unknown) {
    super("value is not a selection");
  }

  /**
   * Throws if the given value is not a `vscode.Selection`.
   */
  public static throwIfNotASelection(value: unknown): asserts value is vscode.Selection {
    if (!(value instanceof vscode.Selection)) {
      throw new NotASelectionError(value);
    }
  }

  /**
   * Throws if the given list contains a value that is not a `vscode.Selection`,
   * or if the list is empty.
   */
  public static throwIfNotASelectionArray(value: unknown): asserts value is vscode.Selection[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new EmptySelectionsError();
    }

    for (let i = 0, len = value.length; i < len; i++) {
      NotASelectionError.throwIfNotASelection(value[i]);
    }
  }
}

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
export function setSelections(selections: vscode.Selection[], editor?: vscode.TextEditor) {
  NotASelectionError.throwIfNotASelectionArray(selections);

  if (editor === undefined) {
    Context.current.selections = selections;
  } else {
    editor.selections = selections;
  }
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
    (i, selection, editor) => predicate(editor.document.getText(selection), selection, i) as any,
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
    (index: number, selection: vscode.Selection, editor: vscode.TextEditor): T;
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
          editor = context.editor;

    if (selections === undefined) {
      selections = editor.selections;
    }

    const firstSelection = selections[0],
          firstResult = predicate(0, firstSelection, editor);

    if (typeof firstResult === "boolean") {
      if (selections.length === 1) {
        return firstResult ? [firstResult] : [];
      }

      const resultingSelections = firstResult ? [firstSelection] : [];

      for (let i = 1; i < selections.length; i++) {
        const selection = selections[i];

        if (predicate(i, selection, editor) as boolean) {
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

        promises.push(predicate(i, selection, editor) as Thenable<boolean>);
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
    (i, selection, editor) => f(editor.document.getText(selection), selection, i),
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
    (index: number, selection: vscode.Selection, editor: vscode.TextEditor): T | undefined;
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
          editor = context.editor;

    if (selections === undefined) {
      selections = editor.selections;
    }

    const firstSelection = selections[0],
          firstResult = f(0, firstSelection, editor);

    if (firstResult === undefined || typeof (firstResult as Thenable<T>)?.then !== "function") {
      const results = firstResult !== undefined ? [firstResult as T] : [];

      for (let i = 1; i < selections.length; i++) {
        const selection = selections[i],
              value = f(i, selection, editor) as T | undefined;

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
              promise = f(i, selection, editor) as Thenable<T | undefined>;

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
  selections: readonly vscode.Selection[] = Context.current.editor.selections,
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
  selections: readonly vscode.Selection[] = Context.current.editor.selections,
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
 * Returns the given selections normalized for processing in the `Character`
 * selection behavior of Dance.
 *
 * Normalization replaces empty selections by 1-character selections and ensures
 * that 1-character selections are reversed (`active` is before `anchor`).
 *
 * @param document The document to use to query for line and character
 *   information, or `undefined` to use the document of the current text editor.
 *
 * ### Example
 * Selections remain empty in empty documents.
 *
 * ```js
 * const sel = (anchorLine, anchorCol, activeLine, activeCol) =>
 *   new vscode.Selection(new vscode.Position(anchorLine, anchorCol),
 *                        new vscode.Position(activeLine, activeCol));
 *
 * assert.deepStrictEqual(
 *   normalizeSelections([sel(0, 0, 0, 0)]),
 *   [sel(0, 0, 0, 0)],
 * );
 * ```
 *
 * With:
 * ```
 * ```
 *
 * ### Example
 * 1-character selections are always reversed.
 *
 * ```js
 * const sel = (anchorLine, anchorCol, activeLine, activeCol) =>
 *   new vscode.Selection(new vscode.Position(anchorLine, anchorCol),
 *                        new vscode.Position(activeLine, activeCol));
 *
 * assert.deepStrictEqual(
 *   normalizeSelections([sel(0, 0, 0, 1), sel(0, 1, 0, 0)]),
 *   [sel(0, 1, 0, 0), sel(0, 1, 0, 0)],
 * );
 *
 * // Also when selecting the line ending:
 * assert.deepStrictEqual(
 *   normalizeSelections([sel(0, 3, 1, 0), sel(1, 0, 0, 3)]),
 *   [sel(1, 0, 0, 3), sel(1, 0, 0, 3)],
 * );
 * ```
 *
 * With:
 * ```
 * foo
 * ```
 *
 * ### Example
 * Empty selections automatically become 1-character selections.
 *
 * ```js
 * const sel = (anchorLine, anchorCol, activeLine, activeCol) =>
 *   new vscode.Selection(new vscode.Position(anchorLine, anchorCol),
 *                        new vscode.Position(activeLine, activeCol));
 *
 * assert.deepStrictEqual(
 *   normalizeSelections([sel(0, 0, 0, 0)]),
 *   [sel(0, 1, 0, 0)],
 * );
 *
 * // At the end of the line, it selects the line ending:
 * assert.deepStrictEqual(
 *   normalizeSelections([sel(0, 1, 0, 1)]),
 *   [sel(1, 0, 0, 1)],
 * );
 *
 * // But it does nothing at the end of the document:
 * assert.deepStrictEqual(
 *   normalizeSelections([sel(2, 0, 2, 0)]),
 *   [sel(2, 0, 2, 0)],
 * );
 * ```
 *
 * With:
 * ```
 * a
 * b
 * ```
 */
export function normalizeSelections(
  selections: vscode.Selection[],
  document?: vscode.TextDocument,
) {
  // This function is potentially called very often (ie every time the selection
  // changes), so allocations are avoided as much as possible.
  let newSelections = undefined as undefined | vscode.Selection[];

  for (let i = 0, len = selections.length; i < len; i++) {
    const selection = selections[i];
    let anchor = selection.anchor,
        active = selection.active;

    if (selection.isEmpty) {
      if (document === undefined) {
        document = Context.current.document;
      }
      if (document.lineAt(anchor).text.length > anchor.character) {
        anchor = anchor.translate(0, 1);
      } else {
        // Selection is at the end of the line, so we try to extend it to the
        // start of the next line.
        if (document.lineCount > anchor.line + 1) {
          anchor = new vscode.Position(anchor.line + 1, 0);
        }
      }
    } else if (anchor.line === active.line && anchor.character === active.character - 1) {
      // Anchor is before active: swap.
      const tmp = anchor;
      anchor = active;
      active = tmp;
    } else if (active.character === 0 && active.line === anchor.line + 1) {
      // Active is on the first character of the line after the anchor: swap if
      // the anchor is at the end of its line.
      if (document === undefined) {
        document = Context.current.document;
      }
      if (document.lineAt(anchor.line).text.length === anchor.character) {
        const tmp = anchor;
        anchor = active;
        active = tmp;
      }
    }

    if (selection.anchor === anchor && selection.active === active) {
      if (newSelections !== undefined) {
        newSelections.push(selection);
      }
      continue;
    }

    if (newSelections === undefined) {
      newSelections = selections.slice(0, i);
    }

    newSelections.push(new vscode.Selection(anchor, active));
  }

  return newSelections ?? selections;
}

/**
 * Operations on `vscode.Selection`s.
 */
export namespace Selections {
  export const filter = filterSelections,
               lines = selectionsLines,
               map = mapSelections,
               normalize = normalizeSelections,
               rotate = rotateSelections,
               set = setSelections,
               update = updateSelections;

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
   * Returns the line of the end of the given selection. If the selection ends
   * at the first character of a line and is not empty, this is equal to
   * `end.line - 1`. Otherwise, this is `end.line`.
   */
  export function endLine(selection: vscode.Range) {
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
  export function fromStartEnd(start: vscode.Position, end: vscode.Position, reversed: boolean) {
    return reversed ? new vscode.Selection(end, start) : new vscode.Selection(start, end);
  }

  /**
   * Transforms a list of caret-mode selections (that is, regular selections as
   * manipulated internally) into a list of character-mode selections (that is,
   * selections modified to include a block character in them).
   */
  export function toCharacterMode(
    selections: readonly vscode.Selection[],
    document?: vscode.TextDocument,
  ) {
    const characterModeSelections = new Array<vscode.Selection>(selections.length);

    for (let i = 0, len = characterModeSelections.length; i < len; i++) {
      const selection = selections[i],
            selectionActive = selection.active,
            selectionActiveLine = selectionActive.line,
            selectionActiveCharacter = selectionActive.character,
            selectionAnchor = selection.anchor,
            selectionAnchorLine = selectionAnchor.line,
            selectionAnchorCharacter = selectionAnchor.character;
      let active = selectionActive,
          anchor = selectionAnchor,
          changed = false;

      if (selectionAnchorLine === selectionActiveLine) {
        if (selectionAnchorCharacter === selectionActiveCharacter + 1) {
          // Selection is one-character long: make it empty.
          anchor = selectionActive;
          changed = true;
        } else if (selectionAnchorCharacter < selectionActiveCharacter) {
          // Selection is strictly forward-facing: make it shorter.
          active = new vscode.Position(selectionActiveLine, selectionActiveCharacter - 1);
          changed = true;
        } else {
          // Selection is empty or reversed: do nothing.
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
      } else {
        // Selection is reversed: do nothing.
      }

      characterModeSelections[i] = changed ? new vscode.Selection(anchor, active) : selection;
    }

    return characterModeSelections;
  }

  /**
   * Reverses the changes made by `toCharacterMode` by increasing by one the
   * length of every empty or forward-facing selection.
   */
  export function fromCharacterMode(
    selections: readonly vscode.Selection[],
    document?: vscode.TextDocument,
  ) {
    const caretModeSelections = new Array<vscode.Selection>(selections.length);

    for (let i = 0, len = caretModeSelections.length; i < len; i++) {
      const selection = selections[i],
            selectionActive = selection.active,
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
          active = new vscode.Position(selectionActiveLine, selectionActiveCharacter);
          changed = true;
        }
      }

      caretModeSelections[i] = changed ? new vscode.Selection(selectionAnchor, active) : selection;
    }

    return caretModeSelections;
  }
}
