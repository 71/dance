import * as vscode from "vscode";
import { EditorState } from "../state/editor";
import { Extension, SelectionBehavior } from "../state/extension";
import { noUndoStops } from "../utils/misc";
import { EditNotAppliedError, Selections } from ".";
import { EditorRequiredError } from "./errors";
import { CommandDescriptor } from "../commands";

let currentContext: ContextWithoutActiveEditor | undefined;

/**
 * @see Context.WithoutActiveEditor
 */
class ContextWithoutActiveEditor {
  /**
   * Returns the current execution context, or throws an error if called outside
   * of an execution context.
   */
  public static get current() {
    if (currentContext === undefined) {
      throw new Error("attempted to access context object outside of execution context");
    }

    return currentContext;
  }

  /**
   * Returns the current execution context, or `undefined` if called outside of
   * an execution context.
   */
  public static get currentOrUndefined() {
    return currentContext;
  }

  /**
   * Equivalent to calling `wrap` on `Context.current`. If there is no current
   * context, it returns the `thenable` directly.
   */
  public static wrap<T>(thenable: Thenable<T>) {
    return this.currentOrUndefined?.wrap(thenable) ?? thenable;
  }

  /**
   * Equivalent to calling `then` on the current context. If there is no current
   * context, it returns the `thenable.then` directly.
   */
  public static then<T, R>(
    thenable: Thenable<T>,
    onFulfilled?: (value: T) => R,
    onRejected?: (reason: any) => R,
  ) {
    return this.currentOrUndefined?.then(thenable, onFulfilled, onRejected)
        ?? thenable.then(onFulfilled, onRejected);
  }

  /**
   * Equivalent to calling `setup` on the current context.
   */
  public static setup() {
    return this.current.setup();
  }

  public constructor(
    /**
     * The global extension state.
     */
    public readonly extensionState: Extension,

    /**
     * The token used to cancel an operation running in the current context.
     */
    public readonly cancellationToken: vscode.CancellationToken,

    /**
     * The descriptor of the command that led to the creation of this context.
     */
    public readonly commandDescriptor?: CommandDescriptor,
  ) {}

  /**
   * Creates a new promise that executes within the current context.
   */
  public createPromise<T>(
    executor: (resolve: (value: T) => void, reject: (error: any) => void) => void,
  ) {
    return new Promise<T>((resolve, reject) => {
      const previousContext = currentContext;

      currentContext = this;

      try {
        executor(
          (value) => {
            currentContext = previousContext;

            resolve(value);
          },
          (error) => {
            currentContext = previousContext;

            reject(error);
          },
        );
      } catch (e) {
        currentContext = previousContext;

        reject(e);
      }
    });
  }

  /**
   * Runs the given function within the current context.
   */
  public run<T>(f: (context: this) => T) {
    const previousContext = currentContext;

    currentContext = this;

    try {
      return f(this);
    } finally {
      currentContext = previousContext;
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
 * The context of execution of a script.
 */
export class Context extends ContextWithoutActiveEditor {
  public static get current() {
    if (!(currentContext instanceof Context)) {
      throw new Error("current context does not have an active text editor");
    }

    return currentContext;
  }

  public static get currentOrUndefined() {
    if (currentContext === undefined) {
      return undefined;
    }

    if (!(currentContext instanceof Context)) {
      throw new Error("current context does not have an active text editor");
    }

    return currentContext;
  }

  /**
   * The document state for the current editor.
   */
  public readonly documentState = this.editorState.documentState;

  /**
   * The current `vscode.TextEditor`.
   *
   * Avoid accessing `editor.selections` -- selections may need to be
   * transformed before being returned or updated, which is why
   * `context.selections` should be preferred.
   */
  public readonly editor = this.editorState.editor as Omit<vscode.TextEditor, "selections">;

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
    const editor = this.editor as vscode.TextEditor;

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
    const editor = this.editor as vscode.TextEditor;

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

    cancellationToken: vscode.CancellationToken,

    commandDescriptor?: CommandDescriptor,
  ) {
    super(editorState.extension, cancellationToken, commandDescriptor);
  }
}

export namespace Context {
  /**
   * The base `Context` class, which does not require an active
   * `vscode.TextEditor`.
   */
  export const WithoutActiveEditor = ContextWithoutActiveEditor;

  export type WithoutActiveEditor = ContextWithoutActiveEditor;

  /**
   * Returns a `Context` or `Context.WithoutActiveEditor` depending on whether
   * there is an active text editor.
   */
  export function create(extension: Extension, command: CommandDescriptor) {
    const activeEditorState = extension.activeEditorState,
          cancellationToken = extension.cancellationTokenSource.token;

    return activeEditorState === undefined
      ? new Context.WithoutActiveEditor(extension, cancellationToken, command)
      : new Context(activeEditorState, cancellationToken, command);
  }

  /**
   * Returns a `Context` or throws an exception if there is no active text
   * editor.
   */
  export function createWithActiveTextEditor(extension: Extension, command: CommandDescriptor) {
    const activeEditorState = extension.activeEditorState;

    EditorRequiredError.throwUnlessAvailable(activeEditorState);

    return new Context(activeEditorState, extension.cancellationTokenSource.token, command);
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
  f: (editBuilder: vscode.TextEditorEdit, selections: readonly vscode.Selection[],
      document: vscode.TextDocument) => T,
  editor?: vscode.TextEditor,
) {
  let value: T;

  if (editor !== undefined) {
    return editor.edit(
      (editBuilder) => value = f(editBuilder, editor!.selections, editor!.document),
      noUndoStops,
    ).then((succeeded) => {
      EditNotAppliedError.throwIfNotApplied(succeeded);

      return value;
    });
  }

  const context = Context.current,
        document = context.document,
        selections = f.length >= 2 ? context.selections : [];

  return context.wrap(
    context.editor.edit(
      (editBuilder) => value = f(editBuilder, selections, document),
      noUndoStops,
    ).then((succeeded) => {
      EditNotAppliedError.throwIfNotApplied(succeeded);

      return value;
    }),
  );
}
