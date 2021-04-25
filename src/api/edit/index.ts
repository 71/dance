import * as vscode from "vscode";

import { TrackedSelection } from "../../utils/tracked-selection";
import { Context, edit } from "../context";
import { Positions } from "../positions";
import { rotateSelections, Selections } from "../selections";

function mapResults(
  insertFlags: insert.Flags,
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[],
  replacements: readonly replace.Result[],
) {
  let flags = TrackedSelection.Flags.Inclusive,
      where = undefined as "start" | "end" | "active" | "anchor" | undefined;

  if ((insertFlags & insert.Flags.Active) === insert.Flags.Active) {
    where = "active";
  } else if ((insertFlags & insert.Flags.Anchor) === insert.Flags.Anchor) {
    where = "anchor";
  } else if ((insertFlags & insert.Flags.Start) === insert.Flags.Start) {
    where = "start";
  } else if ((insertFlags & insert.Flags.End) === insert.Flags.End) {
    where = "end";
  }

  if (where !== undefined && (insertFlags & insert.Flags.Keep) === insert.Flags.Keep) {
    flags = TrackedSelection.Flags.Strict;
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

      if (where !== undefined && (insertFlags & insert.Flags.Select) === insert.Flags.Select) {
        const insertedLength = replacements[i]!.length;

        if (restoredSelection[where] === restoredSelection.start) {
          restoredSelection = Selections.fromStartEnd(
            Positions.offset(restoredSelection.start, insertedLength)!,
            restoredSelection.end,
            restoredSelection.isReversed,
          );
        } else {
          restoredSelection = Selections.fromStartEnd(
            restoredSelection.start,
            Positions.offset(restoredSelection.end, -insertedLength)!,
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
 * await insert(undefined, (x) => `${+x * 2}`);
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
  return insert.byIndex(
    flags,
    (i, selection, document) => f(document.getText(selection), selection, i, document) as any,
    selections,
  );
}

export namespace insert {
  /**
   * Insertion flags for `insert`.
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
     * Insert at anchor of selection.
     */
    Anchor = 0b00_11_1,

    /**
     * Insert at start of selection.
     */
    Start = 0b00_01_1,

    /**
     * Insert at end of selection.
     */
    End = 0b00_10_1,

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

  export const Replace = Flags.Replace,
               Start = Flags.Start,
               End = Flags.End,
               Active = Flags.Active,
               Anchor = Flags.Anchor,
               Keep = Flags.Keep,
               Select = Flags.Select,
               Extend = Flags.Extend;

  export function flagsAtEdge(edge?: "active" | "anchor" | "start" | "end") {
    switch (edge) {
    case undefined:
      return Flags.Replace;

    case "active":
      return Flags.Active;
    case "anchor":
      return Flags.Anchor;
    case "start":
      return Flags.Start;
    case "end":
      return Flags.End;
    }
  }

  /**
   * The result of a callback passed to `insert` or `insert.byIndex`.
   */
  export type Result = string | undefined;

  /**
   * The result of an async callback passed to `insert` or `insert.byIndex`.
   */
  export type AsyncResult = Thenable<Result>;

  /**
   * A callback passed to `insert`.
   */
  export interface Callback<T> {
    (text: string, selection: vscode.Selection, index: number, document: vscode.TextDocument): T;
  }

  /**
   * A callback passed to `insert.byIndex`.
   */
  export interface ByIndexCallback<T> {
    (index: number, selection: vscode.Selection, document: vscode.TextDocument): T;
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
   * await insert.byIndex("start", (i) => `${i + 1}`);
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
  export function byIndex(
    flags: Flags,
    f: ByIndexCallback<Result> | ByIndexCallback<AsyncResult>,
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
        promises.push(f(i, selections[i], document) as AsyncResult);
      }

      return Context.wrap(
        Promise
          .all(promises)
          .then((results) => mapResults(flags, document, selections, results)),
      );
    }

    // `f` returns regular values.
    const allResults: Result[] = [firstResult];

    for (let i = 1, len = selections.length; i < len; i++) {
      allResults.push(f(i, selections[i], document) as Result);
    }

    return mapResults(flags, document, selections, allResults);
  }

  export namespace byIndex {
    /**
     * Same as `insert.byIndex`, but also inserts strings that end with a
     * newline character on the next or previous line.
     */
    export async function withFullLines(
      flags: Flags,
      f: ByIndexCallback<Result> | ByIndexCallback<AsyncResult>,
      selections: readonly vscode.Selection[] = Context.current.selections,
    ) {
      const document = Context.current.document,
            allResults = await Promise.all(selections.map((sel, i) => f(i, sel, document)));

      // Separate full-line results from all results.
      const results: Result[] = [],
            resultsSelections: vscode.Selection[] = [],
            fullLineResults: Result[] = [],
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

      if ((flags & Flags.Start) === Flags.Start) {
        for (const selection of fullLineSelections) {
          const insertionPosition = Positions.lineStart(selection.start.line);

          insertionPositions.push(insertionPosition);

          if ((flags & Flags.Extend) === Flags.Extend) {
            nextFullLineSelections.push(
              Selections.fromStartEnd(
                insertionPosition, selection.end, selection.isReversed, document),
            );
          } else if ((flags & Flags.Select) === Flags.Select) {
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

          if ((flags & Flags.Extend) === Flags.Extend) {
            nextFullLineSelections.push(
              Selections.fromStartEnd(
                selection.start, insertionPosition, selection.isReversed, document),
            );
          } else if ((flags & Flags.Select) === Flags.Select) {
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
        (flags & Flags.Keep) === Flags.Keep
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
  }
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

export namespace replace {
  /**
   * The result of a callback passed to `replace` or `replace.byIndex`.
   */
  export type Result = string | undefined;

  /**
   * The result of an async callback passed to `replace` or `replace.byIndex`.
   */
  export type AsyncResult = Thenable<Result>;

  /**
   * A callback passed to `replace`.
   */
  export interface Callback<T> {
    (text: string, selection: vscode.Selection, index: number, document: vscode.TextDocument): T;
  }

  /**
   * A callback passed to `replace.byIndex`.
   */
  export interface ByIndexCallback<T> {
    (index: number, selection: vscode.Selection, document: vscode.TextDocument): T;
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
   * await replace.byIndex((i) => `${i + 1}`);
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
  export function byIndex(
    f: ByIndexCallback<Result> | ByIndexCallback<AsyncResult>,
    selections?: readonly vscode.Selection[],
  ): Thenable<vscode.Selection[]> {
    return insert.byIndex(insert.Flags.Replace, f, selections);
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
 * b c a
 * ^ 1
 *   ^ 2
 *     ^ 0
 * ```
 */
export function rotate(by: number, selections?: readonly vscode.Selection[]) {
  return rotate
    .contentsOnly(by, selections)
    .then((selections) => rotate.selectionsOnly(by, selections));
}

export namespace rotate {
  /**
   * Rotates the contents of the given selections by the given offset.
   *
   * @see rotate
   *
   * ### Example
   * ```js
   * await rotate.contentsOnly(1);
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
   * b c a
   * ^ 0
   *   ^ 1
   *     ^ 2
   * ```
   */
  export function contentsOnly(
    by: number,
    selections: readonly vscode.Selection[] = Context.current.selections,
  ) {
    const len = selections.length;

    // Handle negative values for `by`:
    by = (by % len) + len;

    if (by === len) {
      return Context.wrap(Promise.resolve(selections.slice()));
    }

    return replace.byIndex(
      (i, _, document) => document.getText(selections[(i + by) % len]),
      selections,
    );
  }

  /**
   * Rotates the given selections (but not their contents) by the given offset.
   *
   * @see rotate
   *
   * ### Example
   * ```js
   * rotate.selectionsOnly(1);
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
   * ^ 1
   *   ^ 2
   *     ^ 0
   * ```
   */
  export function selectionsOnly(by: number, selections?: readonly vscode.Selection[]) {
    Selections.set(rotateSelections(by, selections));
  }
}
