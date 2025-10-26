import * as vscode from "vscode";

import { SelectionBehavior } from "./types";
import type { CommandDescriptor } from "../commands";
import type { PerEditorState } from "../state/editors";
import type { Extension } from "../state/extension";
import type { Mode } from "../state/modes";
import { EditNotAppliedError, EditorRequiredError } from "../utils/errors";
import { noUndoStops, performDummyEdit } from "../utils/misc";

let currentContext: ContextWithoutActiveEditor | undefined;

const enum ContextFlags {
  None = 0,
  ShouldInsertUndoStop = 1,
  DoNotRecord = 2,
}

/**
 * See {@link Context.WithoutActiveEditor} instead.
 *
 * @internal
 */
export class ContextWithoutActiveEditor {
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
   * The base {@link Context} class, which does not require an active
   * {@link vscode.TextEditor}.
   */
  public static readonly WithoutActiveEditor = ContextWithoutActiveEditor;

  /**
   * Returns the current execution context, or throws an error if called outside
   * of an execution context or if the execution context does not have an
   * active editor.
   */
  public static override get current() {
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
  public static override get currentOrUndefined() {
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

  /**
   * Returns a {@link Context} or {@link Context.WithoutActiveEditor} depending
   * on whether there is an active text editor.
   */
  public static create(extension: Extension, command: CommandDescriptor) {
    const activeEditorState = extension.editors.active,
          cancellationToken = extension.cancellationToken;

    return activeEditorState === undefined
      ? new Context.WithoutActiveEditor(extension, cancellationToken, command)
      : new Context(activeEditorState, cancellationToken, command);
  }

  /**
   * Returns a {@link Context} or throws an exception if there is no active text
   * editor.
   */
  public static createWithActiveTextEditor(extension: Extension, command: CommandDescriptor) {
    const activeEditorState = extension.editors.active;

    EditorRequiredError.throwUnlessAvailable(activeEditorState);

    return new Context(activeEditorState, extension.cancellationToken, command);
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
      return selectionsFromCharacterMode(editor.selections, editor.document);
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
      selections = selectionsToCharacterMode(selections, editor.document);
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
      return selectionsFromCharacterMode([editor.selection], editor.document)[0];
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
  public override withCancellationToken(cancellationToken: vscode.CancellationToken) {
    return new Context(this.getState(), cancellationToken, this.commandDescriptor);
  }

  /**
   * Returns the mode-specific state for the current context.
   */
  public getState() {
    return this.extension.editors.getState(this._editor);
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
    if (this.document === document) {
      return;
    }

    const notebook = (document as { notebook?: vscode.NotebookDocument }).notebook;
    let notebookEditor: vscode.TextEditor | undefined;

    if (notebook !== undefined) {
      const uri = document.uri;

      if (uri.scheme === "vscode-notebook-cell" && uri.fragment.startsWith("ch")) {
        // Target document is a notebook cell; find its index and attempt to
        // focus it.
        const cellIndex = parseInt(uri.fragment.slice(2)),
              cell = notebook.cellAt(cellIndex);

        if (cell.index === cellIndex) {
          // `showTextDocument` will force a regular text editor. We use
          // `vscode.open` instead, which will focus the right cell.
          await vscode.commands.executeCommand("vscode.open", cell.document.uri);

          notebookEditor = vscode.window.activeTextEditor;
        }
      }
    }

    const editor = notebookEditor
                ?? await vscode.window.showTextDocument(document, undefined, !alsoFocusEditor);

    this._document = document;
    this._editor = editor;
    this._mode = this.extension.editors.getState(editor).mode;
  }

  /**
   * Switches the mode of the current editor to the given mode.
   */
  public async switchToMode(mode: Mode) {
    const state = this.extension.editors.getState(this._editor);

    await state.setMode(mode);

    this._mode = state.mode;
  }
}

export declare namespace Context {
  export type WithoutActiveEditor = ContextWithoutActiveEditor;
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
export async function edit<T>(
  f: (editBuilder: vscode.TextEditorEdit, selections: readonly vscode.Selection[],
      document: vscode.TextDocument) => T,
  editor?: vscode.TextEditor,
) {
  if (editor !== undefined) {
    let value!: T;

    const succeeded = await editor.edit(
      (editBuilder) => value = f(editBuilder, editor!.selections, editor!.document),
      noUndoStops,
    );

    EditNotAppliedError.throwIfNotApplied(succeeded);

    return value;
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
 * // One-character selection becomes empty.
 * expect(Selections.toCharacterMode([Selections.fromAnchorActive(0, 0, 0, 1)]), "to satisfy", [
 *   expect.it("to be empty at coords", 0, 0),
 * ]);
 *
 * // One-character selection becomes empty (at line break).
 * expect(Selections.toCharacterMode([Selections.fromAnchorActive(0, 1, 1, 0)]), "to satisfy", [
 *   expect.it("to be empty at coords", 0, 1),
 * ]);
 *
 * // Forward-facing selection becomes shorter.
 * expect(Selections.toCharacterMode([Selections.fromAnchorActive(0, 0, 1, 1)]), "to satisfy", [
 *   expect.it("to have anchor at coords", 0, 0).and("to have cursor at coords", 1, 0),
 * ]);
 *
 * // One-character selection becomes empty (reversed).
 * expect(Selections.toCharacterMode([Selections.fromAnchorActive(0, 1, 0, 0)]), "to satisfy", [
 *   expect.it("to be empty at coords", 0, 0),
 * ]);
 *
 * // One-character selection becomes empty (reversed, at line break).
 * expect(Selections.toCharacterMode([Selections.fromAnchorActive(1, 0, 0, 1)]), "to satisfy", [
 *   expect.it("to be empty at coords", 0, 1),
 * ]);
 *
 * // Reversed selection stays as-is.
 * expect(Selections.toCharacterMode([Selections.fromAnchorActive(1, 1, 0, 0)]), "to satisfy", [
 *   expect.it("to have anchor at coords", 1, 1).and("to have cursor at coords", 0, 0),
 * ]);
 *
 * // Empty selection stays as-is.
 * expect(Selections.toCharacterMode([Selections.empty(1, 1)]), "to satisfy", [
 *   expect.it("to be empty at coords", 1, 1),
 * ]);
 * ```
 *
 * With:
 * ```
 * a
 * b
 * ```
 */
export function selectionsToCharacterMode(
  selections: readonly vscode.Selection[],
  document?: vscode.TextDocument,
) {
  // Capture document reference once at the start to avoid stale references
  if (document === undefined) {
    document = Context.current.document;
  }

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
      if (selectionAnchorCharacter + 1 === selectionActiveCharacter) {
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
        // Selection is reversed or empty: do nothing.
      }
    } else if (selectionAnchorLine < selectionActiveLine) {
      // Selection is strictly forward-facing: make it shorter.
      if (selectionActiveCharacter > 0) {
        active = new vscode.Position(selectionActiveLine, selectionActiveCharacter - 1);
        changed = true;
      } else {
        // The active character is the first one, so we have to get some
        // information from the document.
        const activePrevLine = selectionActiveLine - 1,
              activePrevLineLength = document.lineAt(activePrevLine).text.length;

        active = new vscode.Position(activePrevLine, activePrevLineLength);
        changed = true;
      }
    } else if (selectionAnchorLine === selectionActiveLine + 1
               && selectionAnchorCharacter === 0
               && selectionActiveCharacter === document.lineAt(selectionActiveLine).text.length) {
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
 * expect(Selections.fromCharacterMode([Selections.empty(0, 0)]), "to satisfy", [
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
 * expect(Selections.fromCharacterMode([Selections.empty(0, 0)]), "to satisfy", [
 *   expect.it("to have anchor at coords", 0, 0).and("to have cursor at coords", 0, 1),
 * ]);
 *
 * // At the end of the line, it selects the line ending:
 * expect(Selections.fromCharacterMode([Selections.empty(0, 1)]), "to satisfy", [
 *   expect.it("to have anchor at coords", 0, 1).and("to have cursor at coords", 1, 0),
 * ]);
 *
 * // But it does nothing at the end of the document:
 * expect(Selections.fromCharacterMode([Selections.empty(2, 0)]), "to satisfy", [
 *   expect.it("to be empty at coords", 2, 0),
 * ]);
 * ```
 *
 * With:
 * ```
 * a
 * b
 *
 * ```
 */
export function selectionsFromCharacterMode(
  selections: readonly vscode.Selection[],
  document?: vscode.TextDocument,
) {
  // Capture document reference once at the start to avoid stale references
  if (document === undefined) {
    document = Context.current.document;
  }

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
