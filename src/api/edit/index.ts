import * as vscode from "vscode";

import { Context, edit } from "../context";
import * as Positions from "../positions";
import * as Selections from "../selections";
import { Direction } from "../types";
import * as TrackedSelection from "../../utils/tracked-selection";

const enum Constants {
  PositionMask = 0b00_11_1,
  BehaviorMask = 0b11_00_1,
}

function mapResults(
  insertFlags: insert.Flags,
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[],
  replacements: readonly replace.Result[],
) {
  let flags = TrackedSelection.Flags.Inclusive | TrackedSelection.Flags.EmptyExtendsForward,
      where = undefined as "start" | "end" | "active" | "anchor" | undefined;

  switch (insertFlags & Constants.PositionMask) {
  case insert.Flags.Active:
    where = "active";
    break;

  case insert.Flags.Anchor:
    where = "anchor";
    break;

  case insert.Flags.Start:
    where = "start";
    break;

  case insert.Flags.End:
    where = "end";
    break;
  }

  if (where !== undefined && (insertFlags & Constants.BehaviorMask) === insert.Flags.Keep) {
    flags = (insertFlags & Constants.PositionMask) === insert.Flags.Start
      ? TrackedSelection.Flags.StrictStart
      : TrackedSelection.Flags.StrictEnd;
  }

  const savedSelections = TrackedSelection.fromArray(selections, document),
        discardedSelections = new Uint8Array(selections.length);

  const promise = edit((editBuilder) => {
    for (let i = 0, len = replacements.length; i < len; i++) {
      const result = replacements[i],
            selection = selections[i];

      if (result === undefined) {
        editBuilder.delete(selection);
        discardedSelections[i] = 1;
      } else if (where === undefined) {
        editBuilder.replace(selection, result);

        if (TrackedSelection.length(savedSelections, i) !== result.length) {
          const documentChangedEvent: vscode.TextDocumentContentChangeEvent[] = [{
            range: selection,
            rangeOffset: TrackedSelection.startOffset(savedSelections, i),
            rangeLength: TrackedSelection.length(savedSelections, i),
            text: result,
          }];

          TrackedSelection.updateAfterDocumentChanged(savedSelections, documentChangedEvent, flags);
        }
      } else {
        const position = selection[where];

        editBuilder.replace(position, result);

        const selectionOffset = TrackedSelection.startOffset(savedSelections, i),
              selectionLength = TrackedSelection.length(savedSelections, i);

        const documentChangedEvent: vscode.TextDocumentContentChangeEvent[] = [{
          range: new vscode.Range(position, position),
          rangeOffset: position === selection.start
            ? selectionOffset
            : selectionOffset + selectionLength,
          rangeLength: 0,
          text: result,
        }];

        TrackedSelection.updateAfterDocumentChanged(savedSelections, documentChangedEvent, flags);
      }
    }
  }).then(() => {
    const results: vscode.Selection[] = [];

    for (let i = 0, len = discardedSelections.length; i < len; i++) {
      if (discardedSelections[i]) {
        continue;
      }

      let restoredSelection = TrackedSelection.restore(savedSelections, i, document);

      if (where !== undefined && (insertFlags & Constants.BehaviorMask) === insert.Flags.Select) {
        // Selections were extended; we now unselect the previously selected
        // text.
        const totalLength = TrackedSelection.length(savedSelections, i),
              insertedLength = replacements[i]!.length,
              previousLength = totalLength - insertedLength;

        if (restoredSelection[where] === restoredSelection.start) {
          restoredSelection = Selections.fromStartEnd(
            restoredSelection.start,
            Positions.offset(restoredSelection.end, -previousLength, document)!,
            restoredSelection.isReversed,
          );
        } else {
          restoredSelection = Selections.fromStartEnd(
            Positions.offset(restoredSelection.start, previousLength, document)!,
            restoredSelection.end,
            restoredSelection.isReversed,
          );
        }
      }

      results.push(restoredSelection);
    }

    return results;
  });

  return Context.wrap(promise);
}

/**
 * Inserts text next to the given selections according to the given function.
 *
 * @param f A mapping function called for each selection; given the text content
 *   and the index of the selection, it should return the new text content of
 *   the selection, or `undefined` if it is to be removed. Also works for
 *   `async` (i.e. `Promise`-returning) functions, in which case **all** results
 *   must be promises.
 * @param selections If `undefined`, the selections of the active editor will be
 *   used. Otherwise, must be a `vscode.Selection` array which will be mapped
 *   in the active editor.
 *
 * ### Example
 * ```js
 * Selections.set(await insert(insert.Replace, (x) => `${+x * 2}`));
 * ```
 *
 * Before:
 * ```
 * 1 2 3
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 *
 * After:
 * ```
 * 2 4 6
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 */
export function insert(
  flags: insert.Flags,
  f: insert.Callback<insert.Result> | insert.Callback<insert.AsyncResult>,
  selections?: readonly vscode.Selection[],
): Thenable<vscode.Selection[]> {
  return insertByIndex(
    flags,
    (i, selection, document) => f(document.getText(selection), selection, i, document) as any,
    selections,
  );
}

export /* enum */ namespace insert {
  /**
   * Insertion flags for {@link insert}.
   */
  export const enum Flags {
    /**
     * Replace text and select replacement text.
     */
    Replace = 0,

    /**
     * Insert at active position of selection.
     */
    Active = 0b00_00_1,

    /**
     * Insert at start of selection.
     */
    Start = 0b00_01_1,

    /**
     * Insert at end of selection.
     */
    End = 0b00_10_1,

    /**
     * Insert at anchor of selection.
     */
    Anchor = 0b00_11_1,

    /**
     * Keep current selections.
     */
    Keep = 0b00_00_1,

    /**
     * Select inserted text only.
     */
    Select = 0b01_00_1,

    /**
     * Extend to inserted text.
     */
    Extend = 0b10_00_1,
  }
}

export declare namespace insert {
  /**
   * The result of a callback passed to {@link insert} or
   * {@link insertByIndex}.
   */
  export type Result = string | undefined;

  /**
   * The result of an async callback passed to {@link insert} or
   * {@link insertByIndex}.
   */
  export type AsyncResult = Thenable<Result>;

  /**
   * A callback passed to {@link insert}.
   */
  export interface Callback<T> {
    (text: string, selection: vscode.Selection, index: number, document: vscode.TextDocument): T;
  }

  export const Replace: Flags.Replace,
               Start: Flags.Start,
               End: Flags.End,
               Active: Flags.Active,
               Anchor: Flags.Anchor,
               Keep: Flags.Keep,
               Select: Flags.Select,
               Extend: Flags.Extend;
}

for (const [k, v] of Object.entries({
  Replace: insert.Flags.Replace,
  Start: insert.Flags.Start,
  End: insert.Flags.End,
  Active: insert.Flags.Active,
  Anchor: insert.Flags.Anchor,
  Keep: insert.Flags.Keep,
  Select: insert.Flags.Select,
  Extend: insert.Flags.Extend,
})) {
  Object.defineProperty(insert, k, { value: v });
}

export function insertFlagsAtEdge(edge?: "active" | "anchor" | "start" | "end") {
  switch (edge) {
  case undefined:
    return insert.Flags.Replace;

  case "active":
    return insert.Flags.Active;
  case "anchor":
    return insert.Flags.Anchor;
  case "start":
    return insert.Flags.Start;
  case "end":
    return insert.Flags.End;
  }
}

/**
 * Inserts text next to the given selections according to the given function.
 *
 * @param f A mapping function called for each selection; given the index,
 *   range and editor of each selection, it should return the new text content
 *   of the selection, or `undefined` if it is to be removed. Also works for
 *   `async` (i.e. `Promise`-returning) functions, in which case **all**
 *   results must be promises.
 * @param selections If `undefined`, the selections of the active editor will
 *   be used. Otherwise, must be a `vscode.Selection` array which will be
 *   mapped in the active editor.
 *
 * ### Example
 * ```js
 * Selections.set(await insertByIndex(insert.Start, (i) => `${i + 1}`));
 * ```
 *
 * Before:
 * ```
 * a b c
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 *
 * After:
 * ```
 * 1a 2b 3c
 *  ^ 0
 *     ^ 1
 *        ^ 2
 * ```
 *
 * ### Example
 * ```js
 * Selections.set(await insertByIndex(insert.Start | insert.Select, (i) => `${i + 1}`));
 * ```
 *
 * Before:
 * ```
 * a b c
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 *
 * After:
 * ```
 * 1a 2b 3c
 * ^ 0
 *    ^ 1
 *       ^ 2
 * ```
 *
 * ### Example
 * ```js
 * Selections.set(await insertByIndex(insert.Start | insert.Extend, (i) => `${i + 1}`));
 * ```
 *
 * Before:
 * ```
 * a b c
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 *
 * After:
 * ```
 * 1a 2b 3c
 * ^^ 0
 *    ^^ 1
 *       ^^ 2
 * ```
 *
 * ### Example
 * ```js
 * Selections.set(await insertByIndex(insert.End, (i) => `${i + 1}`));
 * ```
 *
 * Before:
 * ```
 * a b c
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 *
 * After:
 * ```
 * a1 b2 c3
 * ^ 0
 *    ^ 1
 *       ^ 2
 * ```
 *
 * ### Example
 * ```js
 * Selections.set(await insertByIndex(insert.End | insert.Select, (i) => `${i + 1}`));
 * ```
 *
 * Before:
 * ```
 * a b c
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 *
 * After:
 * ```
 * a1 b2 c3
 *  ^ 0
 *     ^ 1
 *        ^ 2
 * ```
 *
 * ### Example
 * ```js
 * Selections.set(await insertByIndex(insert.End | insert.Extend, (i) => `${i + 1}`));
 * ```
 *
 * Before:
 * ```
 * a b c
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 *
 * After:
 * ```
 * a1 b2 c3
 * ^^ 0
 *    ^^ 1
 *       ^^ 2
 * ```
 */
export function insertByIndex(
  flags: insert.Flags,
  f: insertByIndex.Callback<insert.Result> | insertByIndex.Callback<insert.AsyncResult>,
  selections: readonly vscode.Selection[] = Context.current.selections,
): Thenable<vscode.Selection[]> {
  if (selections.length === 0) {
    return Context.wrap(Promise.resolve([]));
  }

  const document = Context.current.document,
        firstResult = f(0, selections[0], document);

  if (typeof firstResult === "object") {
    // `f` returns promises.
    const promises = [firstResult];

    for (let i = 1, len = selections.length; i < len; i++) {
      promises.push(f(i, selections[i], document) as insert.AsyncResult);
    }

    return Context.wrap(
      Promise
        .all(promises)
        .then((results) => mapResults(flags, document, selections, results)),
    );
  }

  // `f` returns regular values.
  const allResults: insert.Result[] = [firstResult];

  for (let i = 1, len = selections.length; i < len; i++) {
    allResults.push(f(i, selections[i], document) as insert.Result);
  }

  return mapResults(flags, document, selections, allResults);
}

export declare namespace insertByIndex {
  /**
   * A callback passed to {@link insertByIndex}.
   */
  export interface Callback<T> {
    (index: number, selection: vscode.Selection, document: vscode.TextDocument): T;
  }
}

/**
 * Same as {@link insertByIndex}, but also inserts strings that end with a
 * newline character on the next or previous line.
 */
export async function insertByIndexWithFullLines(
  flags: insert.Flags,
  f: insertByIndex.Callback<insert.Result> | insertByIndex.Callback<insert.AsyncResult>,
  selections: readonly vscode.Selection[] = Context.current.selections,
) {
  const document = Context.current.document,
        allResults = await Promise.all(selections.map((sel, i) => f(i, sel, document)));

  // Separate full-line results from all results.
  const results: insert.Result[] = [],
        resultsSelections: vscode.Selection[] = [],
        fullLineResults: insert.Result[] = [],
        fullLineResultsSelections: vscode.Selection[] = [],
        isFullLines: boolean[] = [];

  for (let i = 0; i < allResults.length; i++) {
    const result = allResults[i];

    if (result === undefined) {
      continue;
    }

    if (result.endsWith("\n")) {
      fullLineResults.push(result);
      fullLineResultsSelections.push(selections[i]);
      isFullLines.push(true);
    } else {
      results.push(result);
      resultsSelections.push(selections[i]);
      isFullLines.push(false);
    }
  }

  if (fullLineResults.length === 0) {
    return await mapResults(flags, document, resultsSelections, results);
  }

  let savedSelections = new TrackedSelection.Set(
    TrackedSelection.fromArray(fullLineResultsSelections, document),
    document,
  );

  // Insert non-full lines.
  const normalSelections = await mapResults(flags, document, resultsSelections, results);

  // Insert full lines.
  const fullLineSelections = savedSelections.restore();

  savedSelections.dispose();

  const nextFullLineSelections: vscode.Selection[] = [],
        insertionPositions: vscode.Position[] = [];

  if ((flags & Constants.PositionMask) === insert.Flags.Start) {
    for (const selection of fullLineSelections) {
      const insertionPosition = Positions.lineStart(selection.start.line);

      insertionPositions.push(insertionPosition);

      if ((flags & Constants.BehaviorMask) === insert.Flags.Extend) {
        nextFullLineSelections.push(
          Selections.fromStartEnd(
            insertionPosition, selection.end, selection.isReversed, document),
        );
      } else if ((flags & Constants.BehaviorMask) === insert.Flags.Select) {
        nextFullLineSelections.push(Selections.empty(insertionPosition));
      } else {
        // Keep selection as is.
        nextFullLineSelections.push(selection);
      }
    }
  } else {
    for (const selection of fullLineSelections) {
      const insertionPosition = Positions.lineStart(Selections.endLine(selection) + 1);

      insertionPositions.push(insertionPosition);

      if ((flags & Constants.BehaviorMask) === insert.Flags.Extend) {
        nextFullLineSelections.push(
          Selections.fromStartEnd(
            selection.start, insertionPosition, selection.isReversed, document),
        );
      } else if ((flags & Constants.BehaviorMask) === insert.Flags.Select) {
        nextFullLineSelections.push(Selections.empty(insertionPosition));
      } else {
        // Keep selection as is.
        nextFullLineSelections.push(selection);
      }
    }
  }

  savedSelections = new TrackedSelection.Set(
    TrackedSelection.fromArray(nextFullLineSelections, document),
    document,
    (flags & Constants.BehaviorMask) === insert.Flags.Keep
      ? TrackedSelection.Flags.Strict
      : TrackedSelection.Flags.Inclusive,
  );

  await edit((editBuilder) => {
    for (let i = 0; i < insertionPositions.length; i++) {
      editBuilder.replace(insertionPositions[i], fullLineResults[i]!);
    }
  });

  const finalFullLineSelections = savedSelections.restore();

  savedSelections.dispose();

  // Merge back selections.
  const allSelections: vscode.Selection[] = [];

  for (let i = 0, normalIdx = 0, fullLineIdx = 0; i < isFullLines.length; i++) {
    if (isFullLines[i]) {
      allSelections.push(finalFullLineSelections[fullLineIdx++]);
    } else {
      allSelections.push(normalSelections[normalIdx++]);
    }
  }

  return allSelections;
}

/**
 * Replaces the given selections according to the given function.
 *
 * @param f A mapping function called for each selection; given the text content
 *   and the index of the selection, it should return the new text content of
 *   the selection, or `undefined` if it is to be removed. Also works for
 *   `async` (i.e. `Promise`-returning) functions, in which case **all** results
 *   must be promises.
 * @param selections If `undefined`, the selections of the active editor will be
 *   used. Otherwise, must be a `vscode.Selection` array which will be mapped
 *   in the active editor.
 *
 * ### Example
 * ```js
 * await replace((x) => `${+x * 2}`);
 * ```
 *
 * Before:
 * ```
 * 1 2 3
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 *
 * After:
 * ```
 * 2 4 6
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 */
export function replace(
  f: replace.Callback<replace.Result> | replace.Callback<replace.AsyncResult>,
  selections?: readonly vscode.Selection[],
): Thenable<vscode.Selection[]> {
  return insert(insert.Flags.Replace, f, selections);
}

export declare namespace replace {
  /**
   * The result of a callback passed to {@link replace} or
   * {@link replaceByIndex}.
   */
  export type Result = string | undefined;

  /**
   * The result of an async callback passed to {@link replace} or
   * {@link replaceByIndex}.
   */
  export type AsyncResult = Thenable<Result>;

  /**
   * A callback passed to {@link replace}.
   */
  export interface Callback<T> {
    (text: string, selection: vscode.Selection, index: number, document: vscode.TextDocument): T;
  }
}

/**
 * Replaces the given selections according to the given function.
 *
 * @param f A mapping function called for each selection; given the index,
 *   range and editor of each selection, it should return the new text content
 *   of the selection, or `undefined` if it is to be removed. Also works for
 *   `async` (i.e. `Promise`-returning) functions, in which case **all**
 *   results must be promises.
 * @param selections If `undefined`, the selections of the active editor will
 *   be used. Otherwise, must be a `vscode.Selection` array which will be
 *   mapped in the active editor.
 *
 * ### Example
 * ```js
 * await replaceByIndex((i) => `${i + 1}`);
 * ```
 *
 * Before:
 * ```
 * a b c
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 *
 * After:
 * ```
 * 1 2 3
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 */
export function replaceByIndex(
  f: replaceByIndex.Callback<replace.Result> | replaceByIndex.Callback<replace.AsyncResult>,
  selections?: readonly vscode.Selection[],
): Thenable<vscode.Selection[]> {
  return insertByIndex(insert.Flags.Replace, f, selections);
}

export declare namespace replaceByIndex {
  /**
   * A callback passed to {@link replaceByIndex}.
   */
  export interface Callback<T> {
    (index: number, selection: vscode.Selection, document: vscode.TextDocument): T;
  }
}

/**
 * Rotates the given selections and their contents by the given offset.
 *
 * @param selections If `undefined`, the selections of the active editor will be
 *   used. Otherwise, must be a `vscode.Selection` array which will be mapped
 *   in the active editor.
 *
 * ### Example
 * ```js
 * await rotate(1);
 * ```
 *
 * Before:
 * ```
 * a b c
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 *
 * After:
 * ```
 * c a b
 * ^ 2
 *   ^ 0
 *     ^ 1
 * ```
 */
export function rotate(by: number, selections?: readonly vscode.Selection[]) {
  return rotateContents(by, selections).then((selections) => rotateSelections(by, selections));
}

/**
 * Rotates the contents of the given selections by the given offset.
 *
 * @see {@link rotate}
 *
 * ### Example
 * ```js
 * await rotateContents(1);
 * ```
 *
 * Before:
 * ```
 * a b c
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 *
 * After:
 * ```
 * c a b
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 */
export async function rotateContents(
  by: number,
  selections: readonly vscode.Selection[] = Context.current.selections,
) {
  const len = selections.length;

  // Handle negative values for `by`:
  by = (by % len) + len;

  if (by === len) {
    return selections.slice();
  }

  const sortedSelections = Selections.sort(Direction.Forward, selections.slice());
  const rotatedSortedSelections =
    Array.from({ length: len }, (_, i) => sortedSelections[(i + by) % len]);
  const rotatedSortedSelectionsAfterEdit = await replaceByIndex(
    (i, _, document) => document.getText(sortedSelections[i]),
    rotatedSortedSelections,
  );

  // We want to return the new selections (which may have changed because sizes
  // of selections may be different), but we need to revert their indices first.
  return selections.map((selection) => {
    const rotatedSortedIndex = rotatedSortedSelections.indexOf(selection);

    return rotatedSortedSelectionsAfterEdit[rotatedSortedIndex];
  });
}

/**
 * Rotates the given selections (but not their contents) by the given offset.
 *
 * @see {@link rotate}
 *
 * ### Example
 * ```js
 * rotateSelections(1);
 * ```
 *
 * Before:
 * ```
 * a b c
 * ^ 0
 *   ^ 1
 *     ^ 2
 * ```
 *
 * After:
 * ```
 * a b c
 * ^ 2
 *   ^ 0
 *     ^ 1
 * ```
 */
export function rotateSelections(by: number, selections?: readonly vscode.Selection[]) {
  return Selections.set(Selections.rotate(by, selections));
}
