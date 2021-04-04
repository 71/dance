import * as vscode from "vscode";
import { TrackedSelection } from "../../utils/tracked-selection";
import { Context } from "../context";
import { EmptySelectionsError, rotateSelections } from "../selections";

/**
 * An error thrown when a `TextEditor.edit` call returns `false`.
 */
export class EditNotAppliedError extends Error {
  public constructor() {
    super("TextEditor edit failed");
  }

  /**
   * Throws if the given value is `false`.
   */
  public static throwIfNotApplied(editWasApplied: boolean): asserts editWasApplied {
    if (!editWasApplied) {
      throw new EditNotAppliedError();
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
 * @param editorOrSelections If `undefined`, the selections of the active editor
 *   will be used. If a `vscode.TextEditor` object, the selections of the given
 *   editor will be used. Otherwise, must be a `vscode.Selection` array which
 *   will be mapped in the active editor.
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
  editorOrSelections?: readonly vscode.Selection[] | vscode.TextEditor,
): Thenable<vscode.Selection[]> {
  return replace.byIndex(
    (i, selection, editor) => f(editor.document.getText(selection), selection, i, editor) as any,
    editorOrSelections,
  );
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
    (text: string, selection: vscode.Selection, index: number, editor: vscode.TextEditor): T;
  }

  /**
   * A callback passed to `replace.byIndex`.
   */
  export interface ByIndexCallback<T> {
    (index: number, selection: vscode.Selection, editor: vscode.TextEditor): T;
  }

  /**
   * Replaces the given selections according to the given function.
   *
   * @param f A mapping function called for each selection; given the index,
   *   range and editor of each selection, it should return the new text content
   *   of the selection, or `undefined` if it is to be removed. Also works for
   *   `async` (i.e. `Promise`-returning) functions, in which case **all**
   *   results must be promises.
   * @param editorOrSelections If `undefined`, the selections of the active
   *   editor will be used. If a `vscode.TextEditor` object, the selections of
   *   the given editor will be used. Otherwise, must be a `vscode.Selection`
   *   array which will be mapped in the active editor.
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
    editorOrSelections?: vscode.TextEditor | readonly vscode.Selection[],
  ): Thenable<vscode.Selection[]> {
    const [editor, selections] = getEditorAndSelections(editorOrSelections);

    if (selections.length === 0) {
      return Context.wrap(Promise.resolve([]));
    }

    const firstResult = f(0, selections[0], editor);

    if (typeof firstResult === "object") {
      // `f` returns promises.
      const promises = [firstResult];

      for (let i = 1, len = selections.length; i < len; i++) {
        promises.push(f(i, selections[i], editor) as AsyncResult);
      }

      return Context.wrap(
        Promise.all(promises).then((results) => mapResults(editor, selections, results)),
      );
    }

    // `f` returns regular values.
    const allResults: Result[] = [firstResult];

    for (let i = 1, len = selections.length; i < len; i++) {
      allResults.push(f(i, selections[i], editor) as Result);
    }

    return mapResults(editor, selections, allResults);
  }
}

function mapResults(
  editor: vscode.TextEditor,
  selections: readonly vscode.Selection[],
  replacements: readonly replace.Result[],
) {
  const savedSelections: (TrackedSelection | undefined)[] = [];

  if (editor.selections !== selections) {
    // We can avoid all the book keeping below if the selections we are
    // modifying are the editor's.
    const document = editor.document;

    for (let i = 0, len = selections.length; i < len; i++) {
      savedSelections.push(TrackedSelection.from(selections[i], document));
    }
  }

  const promise = editor.edit((editBuilder) => {
    for (let i = 0, len = replacements.length; i < len; i++) {
      const result = replacements[i],
            selection = selections[i];

      if (result === undefined) {
        editBuilder.delete(selection);
        savedSelections[i] = undefined;
      } else {
        editBuilder.replace(selection, result);

        if (savedSelections.length > 0 && savedSelections[i]!.length !== result.length) {
          const savedSelection = savedSelections[i]!,
                documentChangedEvent: vscode.TextDocumentContentChangeEvent = {
                  range: selection,
                  rangeOffset: savedSelection.offset,
                  rangeLength: savedSelection.length,
                  text: result,
                };

          for (let j = 0, len = savedSelections.length; j < len; j++) {
            savedSelections[j]?.updateAfterDocumentChanged(documentChangedEvent);
          }
        }
      }
    }
  }, { undoStopAfter: false, undoStopBefore: false }).then((succeeded) => {
    EditNotAppliedError.throwIfNotApplied(succeeded);

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

function getEditorAndSelections(
  editorOrSelections?: vscode.TextEditor | readonly vscode.Selection[],
) {
  if (editorOrSelections === undefined) {
    const editor = Context.current.editor;

    return [editor, editor.selections] as const;
  } else if (Array.isArray(editorOrSelections)) {
    return [Context.current.editor, editorOrSelections as readonly vscode.Selection[]] as const;
  } else {
    const editor = editorOrSelections as vscode.TextEditor;

    return [editor, editor.selections] as const;
  }
}

/**
 * Rotates the given selections and their contents by the given offset.
 *
 * @param editorOrSelections If `undefined`, the selections of the active edtior
 *   will be used. If a `vscode.TextEditor` object, the selections of the given
 *   editor will be used. Otherwise, must be a `vscode.Selection` array which
 *   will be mapped in the active editor.
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
export function rotate(
  by: number,
  editorOrSelections?: vscode.TextEditor | readonly vscode.Selection[],
) {
  return rotate
    .contentsOnly(by, editorOrSelections)
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
    editorOrSelections?: vscode.TextEditor | readonly vscode.Selection[],
  ) {
    const [editor, selections] = getEditorAndSelections(editorOrSelections),
          len = selections.length;

    // Handle negative values for `by`:
    by = (by % len) + len;

    if (by === len) {
      return Context.wrap(Promise.resolve(selections.slice()));
    }

    return replace.byIndex(
      (i, _, { document }) => document.getText(selections[(i + by) % len]),
      editor,
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
  export function selectionsOnly(
    by: number,
    editorOrSelections?: vscode.TextEditor | readonly vscode.Selection[],
  ) {
    const [editor, selections] = getEditorAndSelections(editorOrSelections),
          rotatedSelections = rotateSelections(by, selections);

    EmptySelectionsError.throwIfEmpty(rotatedSelections);

    return editor.selections = rotatedSelections;
  }
}
