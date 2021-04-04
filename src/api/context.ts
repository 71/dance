import * as vscode from "vscode";
import { EditorState } from "../state/editor";
import { SelectionBehavior } from "../state/extension";
import { noUndoStops } from "../utils/misc";
import { EditNotAppliedError } from "./edit";
import { normalizeSelections, Selections } from "./selections";

const contextStack = [] as Context[],
      normalizedSelections = new WeakMap<vscode.Selection[], readonly vscode.Selection[]>();

/**
 * The context of execution of a script.
 */
export class Context {
  /**
   * Returns the current execution context, or throws an error if called outside
   * of an execution context.
   */
  public static get current() {
    if (contextStack.length === 0) {
      throw new Error("attempted to access context object outside of execution context");
    }

    return contextStack[contextStack.length - 1];
  }

  /**
   * Returns the current execution context, or `undefined` if called outside of
   * an execution context.
   */
  public static get currentOrUndefined() {
    if (contextStack.length === 0) {
      return undefined;
    }

    return contextStack[contextStack.length - 1];
  }

  /**
   * Equivalent to calling `wrap` on `Context.current`. If there is no current
   * context, it returns the `thenable` directly.
   */
  public static wrap<T>(thenable: Thenable<T>) {
    return Context.currentOrUndefined?.wrap(thenable) ?? thenable;
  }

  /**
   * Equivalent to calling `then` on `Context.current`. If there is no current
   * context, it returns the `thenable.then` directly.
   */
  public static then<T, R>(
    thenable: Thenable<T>,
    onFulfilled?: (value: T) => R,
    onRejected?: (reason: any) => R,
  ) {
    return Context.currentOrUndefined?.then(thenable, onFulfilled, onRejected)
        ?? thenable.then(onFulfilled, onRejected);
  }

  /**
   * Equivalent to calling `setup` on a context built using the given arguments.
   * Pass no arguments to use the current context.
   */
  public static setup(...args: ConstructorParameters<typeof Context> | []) {
    if (args.length === 0) {
      return Context.current.setup();
    }

    return new Context(...args).setup();
  }

  /**
   * Equivalent to calling `run` on a context built using the given arguments.
   */
  public static run<T>(...args: [...ConstructorParameters<typeof Context>, () => T]) {
    const f = args.pop() as () => T;

    return new Context(...args as unknown as ConstructorParameters<typeof Context>).run(f);
  }

  /**
   * The document state for the current editor.
   */
  public readonly documentState = this.editorState.documentState;

  /**
   * The global extension state.
   */
  public readonly extensionState = this.editorState.extension;

  /**
   * The current `vscode.TextEditor`.
   */
  public readonly editor = this.editorState.editor;

  /**
   * The current `vscode.TextDocument`.
   */
  public readonly document = this.editor.document;

  /**
   * The current selections.
   *
   * Selections returned by this property **may be different** from the ones
   * returned by `editor.selections`. If the current selection behavior is
   * `Character`, strictly forward-facing (i.e. `active > anchor`) selections
   * will be made longer by one character.
   */
  public get selections() {
    const editor = this.editor;

    if (this.editorState.mode.selectionBehavior === SelectionBehavior.Character) {
      return Selections.fromCharacterMode(editor.selections, editor.document);
    }

    return editor.selections;
  }

  /**
   * Sets the current selections.
   *
   * If the current selection behavior is `Character`, strictly forward-facing
   * (i.e. `active > anchor`) selections will be made shorter by one character.
   */
  public set selections(selections: vscode.Selection[]) {
    const editor = this.editor;

    if (this.editorState.mode.selectionBehavior === SelectionBehavior.Character) {
      selections = Selections.toCharacterMode(selections, editor.document);
    }

    editor.selections = selections;
  }

  public constructor(
    /**
     * The editor state for the current editor.
     */
    public readonly editorState: EditorState,

    /**
     * The token used to cancel an operation running in the current context.
     */
    public readonly cancellationToken: vscode.CancellationToken,
  ) {
    Object.freeze(this);
  }

  /**
   * Creates a new promise that executes within the current context.
   */
  public createPromise<T>(
    executor: (resolve: (value: T) => void, reject: (error: any) => void) => void,
  ) {
    return new Promise<T>((resolve, reject) => {
      let popOffStack = true;

      contextStack.push(this);

      try {
        executor(
          (value) => {
            if (popOffStack) {
              contextStack.pop();
              popOffStack = false;
            }
            resolve(value);
          },
          (error) => {
            if (popOffStack) {
              contextStack.pop();
              popOffStack = false;
            }
            reject(error);
          },
        );
      } catch (e) {
        if (popOffStack) {
          contextStack.pop();
          popOffStack = false;
        }
      }
    });
  }

  /**
   * Runs the given function within the current context.
   */
  public run<T>(f: (context: Context) => T) {
    contextStack.push(this);

    try {
      return f(this);
    } finally {
      contextStack.pop();
    }
  }

  /**
   * Returns a promise whose continuations will be wrapped in a way that
   * preserves the current context.
   *
   * Await a call to `setup` in an async function to make ensure that all
   * subsequent `await` expressions preserve the current context.
   */
  public setup() {
    return this.wrap(Promise.resolve());
  }

  /**
   * Wraps the given promise in a way that preserves the current context in
   * `then`.
   */
  public wrap<T>(thenable: Thenable<T>): Thenable<T> {
    return {
      then: <R>(onFulfilled?: (value: T) => R, onRejected?: (reason: any) => R): Thenable<R> => {
        return this.then(thenable, onFulfilled, onRejected);
      },
    };
  }

  /**
   * Wraps the continuation of a promise in order to preserve the current
   * context.
   */
  public then<T, R>(
    thenable: Thenable<T>,
    onFulfilled?: (value: T) => R,
    onRejected?: (reason: any) => R,
  ) {
    if (onFulfilled !== undefined) {
      const f = onFulfilled;

      onFulfilled = (value: T) => this.run(() => f(value));
    }

    if (onRejected !== undefined) {
      const f = onRejected;

      onRejected = (reason: any) => this.run(() => f(reason));
    }

    return this.wrap(thenable.then(onFulfilled, onRejected));
  }
}

/**
 * Returns the text of the given range in the current context.
 *
 * ### Example
 * ```js
 * const start = new vscode.Position(0, 0),
 *       end = new vscode.Position(0, 3);
 *
 * assert.strictEqual(
 *   text(new vscode.Range(start, end)),
 *   "foo",
 * );
 * ```
 *
 * With:
 * ```
 * foo bar
 * ```
 */
export function text(range: vscode.Range): string;

/**
 * Returns the text of all the given ranges in the current context.
 *
 * ### Example
 * ```js
 * const start1 = new vscode.Position(0, 0),
 *       end1 = new vscode.Position(0, 3),
 *       start2 = new vscode.Position(0, 4),
 *       end2 = new vscode.Position(0, 7);
 *
 * assert.deepStrictEqual(
 *   text([new vscode.Range(start1, end1), new vscode.Range(start2, end2)]),
 *   ["foo", "bar"],
 * );
 * ```
 *
 * With:
 * ```
 * foo bar
 * ```
 */
export function text(ranges: readonly vscode.Range[]): string[];

export function text(ranges: vscode.Range | readonly vscode.Range[]) {
  const document = Context.current.document;

  if (Array.isArray(ranges)) {
    return ranges.map((range) => document.getText(range));
  }

  return document.getText(ranges as vscode.Range);
}

/**
 * Performs changes on the active editor.
 *
 * ### Example
 * ```js
 * await edit((editBuilder) => {
 *   const start = new vscode.Position(0, 2),
 *         end = new vscode.Position(0, 4);
 *
 *   editBuilder.delete(new vscode.Range(start, end));
 * });
 * ```
 *
 * Before:
 * ```
 * hello world
 * ^^^^^ 0
 * ```
 *
 * After:
 * ```
 * heo world
 * ^^^ 0
 * ```
 */
export function edit<T>(
  f: (editBuilder: vscode.TextEditorEdit, editor: vscode.TextEditor,
      selections: readonly vscode.Selection[]) => T,
  editor?: vscode.TextEditor,
) {
  let value: T;

  if (editor !== undefined) {
    return editor.edit(
      (editBuilder) => value = f(editBuilder, editor!, editor!.selections),
      noUndoStops,
    ).then((succeeded) => {
      EditNotAppliedError.throwIfNotApplied(succeeded);

      return value;
    });
  }

  const context = Context.current,
        selections = f.length >= 3 ? context.selections : [];
  editor = context.editor;

  return context.wrap(
    editor.edit(
      (editBuilder) => value = f(editBuilder, editor!, selections),
      noUndoStops,
    ).then((succeeded) => {
      EditNotAppliedError.throwIfNotApplied(succeeded);

      return value;
    }),
  );
}
