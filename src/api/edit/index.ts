import * as vscode from "vscode";

import { TrackedSelection } from "../../utils/tracked-selection";
import { Context, edit } from "../context";
import { Positions } from "../positions";
import { rotateSelections, Selections } from "../selections";

function mapResults(
  where: "start" | "end" | "active" | "anchor" | undefined,
  mapping: insert.SelectionMapping,
  editor: vscode.TextEditor,
  selections: readonly vscode.Selection[],
  replacements: readonly replace.Result[],
) {
  let flags = TrackedSelection.Flags.Inclusive;

  if (where !== undefined && mapping === insert.SelectionMapping.Keep) {
    flags = TrackedSelection.Flags.Strict;
  }

  const savedSelections = TrackedSelection.fromArray(selections, editor.document),
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
            rangeOffset: TrackedSelection.offset(savedSelections, i),
            rangeLength: TrackedSelection.length(savedSelections, i),
            text: result,
          }];

          TrackedSelection.updateAfterDocumentChanged(savedSelections, documentChangedEvent, flags);
        }
      } else {
        const position = selection[where];

        editBuilder.replace(position, result);

        const selectionOffset = TrackedSelection.offset(savedSelections, i),
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
    const results: vscode.Selection[] = [],
          document = editor.document;

    for (let i = 0, len = discardedSelections.length; i < len; i++) {
      if (discardedSelections[i]) {
        continue;
      }

      let restoredSelection = TrackedSelection.restore(savedSelections, i, document);

      if (where !== undefined && mapping === insert.SelectionMapping.Inserted) {
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
  where: "start" | "end" | "active" | "anchor" | undefined,
  mapping: insert.SelectionMapping,
  f: insert.Callback<insert.Result> | insert.Callback<insert.AsyncResult>,
  selections?: readonly vscode.Selection[],
): Thenable<vscode.Selection[]> {
  return insert.byIndex(
    where,
    mapping,
    (i, selection, document) => f(document.getText(selection), selection, i, document) as any,
    selections,
  );
}

export namespace insert {
  /**
   * Where in a selection should text be inserted.
   */
  export const enum Where {
    Start = "start",
    End = "end",

    Anchor = "anchor",
    Active = "active",
  }

  /**
   * Controls how selections are mapped after inserting some contents.
   */
  export const enum SelectionMapping {
    /**
     * Keeps current selections.
     */
    Keep = "keep",

    /**
     * Extends current selections with inserted text.
     */
    Extend = "extend",

    /**
     * Selects inserted text.
     */
    Inserted = "select",
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
    where: "start" | "end" | "active" | "anchor" | undefined,
    mapping: SelectionMapping,
    f: ByIndexCallback<Result> | ByIndexCallback<AsyncResult>,
    selections: readonly vscode.Selection[] = Context.current.selections,
  ): Thenable<vscode.Selection[]> {
    if (selections.length === 0) {
      return Context.wrap(Promise.resolve([]));
    }

    const document = Context.current.document,
          editor = Context.current.editor as vscode.TextEditor,
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
          .then((results) => mapResults(where, mapping, editor, selections, results)),
      );
    }

    // `f` returns regular values.
    const allResults: Result[] = [firstResult];

    for (let i = 1, len = selections.length; i < len; i++) {
      allResults.push(f(i, selections[i], document) as Result);
    }

    return mapResults(where, mapping, editor, selections, allResults);
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
  return insert(undefined, insert.SelectionMapping.Keep, f, selections);
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
    return insert.byIndex(undefined, insert.SelectionMapping.Keep, f, selections);
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
