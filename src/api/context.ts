import * as vscode from "vscode";

import { EditNotAppliedError, EditorRequiredError } from "./errors";
import { Selections } from "./selections";
import { CommandDescriptor } from "../commands";
import { PerEditorState } from "../state/editors";
import { Extension } from "../state/extension";
import { Mode, SelectionBehavior } from "../state/modes";
import { noUndoStops, performDummyEdit } from "../utils/misc";

let currentContext: ContextWithoutActiveEditor | undefined;

const enum ContextFlags {
  None = 0,
  ShouldInsertUndoStop = 1,
  DoNotRecord = 2,
}

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

  protected _flags = ContextFlags.None;

  public constructor(
    /**
     * The global extension state.
     */
    public readonly extension: Extension,

    /**
     * The token used to cancel an operation running in the current context.
     */
    public readonly cancellationToken: vscode.CancellationToken,

    /**
     * The descriptor of the command that led to the creation of this context.
     */
    public readonly commandDescriptor?: CommandDescriptor,
  ) {
    if (currentContext?._flags ?? 0 & ContextFlags.DoNotRecord) {
      this._flags |= ContextFlags.DoNotRecord;
    }
  }

  /**
   * Returns a new context whose cancellation is controlled by the specified
   * cancellation token.
   */
  public withCancellationToken(cancellationToken: vscode.CancellationToken) {
    return new Context.WithoutActiveEditor(
      this.extension, cancellationToken, this.commandDescriptor);
  }

  /**
   * Whether commands executed within this context should be recorded.
   */
  public shouldRecord() {
    return (this._flags & ContextFlags.DoNotRecord) === 0;
  }

  /**
   * Indicates that commands executed within this context should not be
   * recorded.
   */
  public doNotRecord() {
    this._flags |= ContextFlags.DoNotRecord;

    return this;
  }

  /**
   * Creates a new promise that executes within the current context.
   */
  public createPromise<T>(
    executor: (resolve: (value: T) => void, reject: (error: any) => void) => void,
  ) {
    return this.wrap(new Promise<T>(executor));
  }

  /**
   * Runs the given function within the current context.
   */
  public run<T>(f: (context: this) => T) {
    const previousContext = currentContext;

    if (previousContext === this) {
      return f(this) as any;
    }

    currentContext = this;

    try {
      return f(this);
    } finally {
      currentContext = previousContext;
    }
  }

  /**
   * Runs the given async function within the current context.
   */
  public async runAsync<T>(f: (context: this) => T): Promise<T extends Thenable<infer R> ? R : T> {
    const previousContext = currentContext;

    if (previousContext === this) {
      // Takes care of this situation: context 1 is created, context 1 spawns
      // another context 2, context 1 is exited, and then context 2 is exited.
      // Context 2 inherited "currentContext" === context 1, so context 2
      // restores context 1 instead of exiting context 1 fully.
      return f(this) as any;
    }

    currentContext = this;

    try {
      return await f(this) as any;
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
      then: <R>(onFulfilled?: (value: T) => R, onRejected?: (reason: any) => R) => {
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

      onFulfilled = (value: T) => this.runAsync(() => f(value) as any) as any;
    }

    if (onRejected !== undefined) {
      const f = onRejected;

      onRejected = (reason: any) => this.runAsync(() => f(reason) as any) as any;
    }

    return this.wrap(thenable.then(onFulfilled, onRejected));
  }
}

/**
 * The context of execution of a script.
 */
export class Context extends ContextWithoutActiveEditor {
  /**
   * Returns the current execution context, or throws an error if called outside
   * of an execution context or if the execution context does not have an
   * active editor.
   */
  public static get current() {
    if (!(currentContext instanceof Context)) {
      throw new Error("current context does not have an active text editor");
    }

    return currentContext;
  }

  /**
   * Returns the current execution context, or `undefined` if called outside of
   * an execution context or if the execution context does not have an active
   * editor.
   */
  public static get currentOrUndefined() {
    if (currentContext === undefined || !(currentContext instanceof Context)) {
      return undefined;
    }

    return currentContext;
  }

  public static assert(context: Context.WithoutActiveEditor): asserts context is Context {
    if (!(context instanceof Context)) {
      throw new Error("current context does not have an active text editor");
    }
  }

  private _document: vscode.TextDocument;
  private _editor: vscode.TextEditor;
  private _mode: Mode;

  /**
   * The current `vscode.TextDocument`.
   */
  public get document() {
    return this._document;
  }

  /**
   * The current `vscode.TextEditor`.
   *
   * Avoid accessing `editor.selections` -- selections may need to be
   * transformed before being returned or updated, which is why
   * `context.selections` should be preferred.
   */
  public get editor() {
    return this._editor as Omit<vscode.TextEditor, "selections">;
  }

  /**
   * The `Mode` associated with the current `vscode.TextEditor`.
   */
  public get mode() {
    return this._mode;
  }

  /**
   * The selection behavior for this context.
   */
  public get selectionBehavior() {
    return this._mode.selectionBehavior;
  }

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

    if (this.selectionBehavior === SelectionBehavior.Character) {
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
  public set selections(selections: readonly vscode.Selection[]) {
    const editor = this.editor as vscode.TextEditor;

    if (this.selectionBehavior === SelectionBehavior.Character) {
      selections = Selections.toCharacterMode(selections, editor.document);
    }

    editor.selections = selections as vscode.Selection[];
  }

  /**
   * Equivalent to `selections[0]`.
   *
   * @see selections
   */
  public get mainSelection() {
    const editor = this.editor as vscode.TextEditor;

    if (this.selectionBehavior === SelectionBehavior.Character) {
      return Selections.fromCharacterMode([editor.selection], editor.document)[0];
    }

    return editor.selection;
  }

  public constructor(
    state: PerEditorState,
    cancellationToken: vscode.CancellationToken,
    commandDescriptor?: CommandDescriptor,
  ) {
    super(state.extension, cancellationToken, commandDescriptor);

    this._document = state.editor.document;
    this._editor = state.editor;
    this._mode = state.mode;
  }

  /**
   * Returns a new context whose cancellation is controlled by the specified
   * cancellation token.
   */
  public withCancellationToken(cancellationToken: vscode.CancellationToken) {
    return new Context(this.getState(), cancellationToken, this.commandDescriptor);
  }

  /**
   * Returns the mode-specific state for the current context.
   */
  public getState() {
    return this.extension.editors.getState(this._editor)!;
  }

  /**
   * Performs changes on the editor of the context.
   */
  public edit<T>(
    f: (editBuilder: vscode.TextEditorEdit, selections: readonly vscode.Selection[],
        document: vscode.TextDocument) => T,
  ) {
    let value: T;

    const document = this.document,
          selections = f.length >= 2 ? this.selections : [];

    return this.wrap(
      this.editor.edit(
        (editBuilder) => value = f(editBuilder, selections, document),
        noUndoStops,
      ).then((succeeded) => {
        EditNotAppliedError.throwIfNotApplied(succeeded);

        this._flags |= ContextFlags.ShouldInsertUndoStop;

        return value;
      }),
    );
  }

  /**
   * Returns whether edits have been performed in this context but not committed
   * with `insertUndoStop`.
   */
  public hasEditsWithoutUndoStops() {
    return (this._flags & ContextFlags.ShouldInsertUndoStop) === ContextFlags.ShouldInsertUndoStop;
  }

  /**
   * Inserts an undo stop if needed.
   */
  public insertUndoStop() {
    if (!this.hasEditsWithoutUndoStops()) {
      return Promise.resolve();
    }

    return this.wrap(performDummyEdit(this._editor));
  }

  /**
   * Switches the context to the given document.
   */
  public async switchToDocument(document: vscode.TextDocument, alsoFocusEditor = false) {
    const editor = await vscode.window.showTextDocument(document, undefined, !alsoFocusEditor);

    this._document = document;
    this._editor = editor;
    this._mode = this.extension.editors.getState(editor).mode;
  }

  /**
   * Switches the mode of the current editor to the given mode.
   */
  public switchToMode(mode: Mode) {
    const state = this.extension.editors.getState(this._editor);

    return state.setMode(mode).then(() => {
      this._mode = state.mode;
    });
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
    const activeEditorState = extension.editors.active,
          cancellationToken = extension.cancellationToken;

    return activeEditorState === undefined
      ? new Context.WithoutActiveEditor(extension, cancellationToken, command)
      : new Context(activeEditorState, cancellationToken, command);
  }

  /**
   * Returns a `Context` or throws an exception if there is no active text
   * editor.
   */
  export function createWithActiveTextEditor(extension: Extension, command: CommandDescriptor) {
    const activeEditorState = extension.editors.active;

    EditorRequiredError.throwUnlessAvailable(activeEditorState);

    return new Context(activeEditorState, extension.cancellationToken, command);
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
 * expect(
 *   text(new vscode.Range(start, end)),
 *   "to be",
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
 * expect(
 *   text([new vscode.Range(start1, end1), new vscode.Range(start2, end2)]),
 *   "to equal",
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
  if (editor !== undefined) {
    let value: T;

    return editor.edit(
      (editBuilder) => value = f(editBuilder, editor!.selections, editor!.document),
      noUndoStops,
    ).then((succeeded) => {
      EditNotAppliedError.throwIfNotApplied(succeeded);

      return value;
    });
  }

  return Context.current.edit(f);
}

/**
 * Marks a change, inserting a history undo stop.
 */
export function insertUndoStop(editor?: vscode.TextEditor) {
  if (editor !== undefined) {
    return performDummyEdit(editor);
  }

  return Context.current.insertUndoStop();
}
