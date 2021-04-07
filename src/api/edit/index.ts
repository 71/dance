import * as vscode from "vscode";
import { TrackedSelection } from "../../utils/tracked-selection";
import { Context, edit } from "../context";
import { rotateSelections, Selections } from "../selections";

function mapResults(
  where: "start" | "end" | "active" | "anchor" | undefined,
  flags: TrackedSelection.Flags,
  editor: vscode.TextEditor,
  selections: readonly vscode.Selection[],
  replacements: readonly replace.Result[],
) {
  // TODO: honor mapping.
  const savedSelections: (TrackedSelection | undefined)[] = [];

  if (editor.selections !== selections) {
    // We can avoid all the book keeping below if the selections we are
    // modifying are the editor's.
    const document = editor.document;

    for (let i = 0, len = selections.length; i < len; i++) {
      savedSelections.push(TrackedSelection.from(selections[i], document));
    }
  }

  const promise = edit((editBuilder) => {
    for (let i = 0, len = replacements.length; i < len; i++) {
      const result = replacements[i],
            selection = selections[i];

      if (result === undefined) {
        editBuilder.delete(selection);
        savedSelections[i] = undefined;
      } else if (where === undefined) {
        editBuilder.replace(selection, result);

        if (savedSelections.length > 0 && savedSelections[i]!.length !== result.length) {
          const savedSelection = savedSelections[i]!,
                documentChangedEvent: vscode.TextDocumentContentChangeEvent[] = [{
                  range: selection,
                  rangeOffset: savedSelection.offset,
                  rangeLength: savedSelection.length,
                  text: result,
                }];

          for (let j = 0, len = savedSelections.length; j < len; j++) {
            savedSelections[j]?.updateAfterDocumentChanged(documentChangedEvent, flags);
          }
        }
      } else {
        const position = selection[where];

        editBuilder.replace(position, result);

        if (savedSelections.length > 0) {
          const savedSelection = savedSelections[i]!,
                documentChangedEvent: vscode.TextDocumentContentChangeEvent[] = [{
                  range: new vscode.Range(position, position),
                  rangeOffset: position === selection.start
                    ? savedSelection.offset
                    : savedSelection.offset + savedSelection.length,
                  rangeLength: 0,
                  text: result,
                }];

          for (let j = 0, len = savedSelections.length; j < len; j++) {
            savedSelections[j]?.updateAfterDocumentChanged(documentChangedEvent, flags);
          }
        }
      }
    }
  }).then(() => {
    if (savedSelections.length === 0) {
      return editor.selections;
    }

    const results: vscode.Selection[] = [],
          document = editor.document;

    for (let i = 0, len = savedSelections.length; i < len; i++) {
      const savedSelection = savedSelections[i];

      if (savedSelection === undefined) {
        continue;
      }

      results.push(savedSelection.restore(document));
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
 * await insert((x) => `${x * 2}`);
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
    Keep,

    /**
     * Extends current selections with inserted text.
     */
    Extend,

    /**
     * Selects inserted text.
     */
    Inserted,
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
   * await insert.byIndex("", (i) => `${i + 1}`);
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
          flags = TrackedSelection.Flags.Inclusive,
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
          .then((results) => mapResults(where, flags, editor, selections, results)),
      );
    }

    // `f` returns regular values.
    const allResults: Result[] = [firstResult];

    for (let i = 1, len = selections.length; i < len; i++) {
      allResults.push(f(i, selections[i], document) as Result);
    }

    return mapResults(where, flags, editor, selections, allResults);
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
 * await replace((x) => `${x * 2}`);
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
  return insert(undefined, 0, f, selections);
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
    return insert.byIndex(undefined, 0, f, selections);
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
