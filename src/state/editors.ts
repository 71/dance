import * as vscode from "vscode";

import { ArgumentError, assert, command, commands, Context, Positions, Selections, selectionsLines } from "../api";
import { extensionName } from "../extension";
import { Extension } from "./extension";
import { Mode, SelectionBehavior } from "./modes";

/**
 * Dance-specific state related to a single `vscode.TextEditor`.
 */
export class PerEditorState implements vscode.Disposable {
  private readonly _onEditorWasClosed = new vscode.EventEmitter<this>();
  private readonly _onVisibilityDidChange = new vscode.EventEmitter<this>();
  private _isVisible = true;

  /**
   * The corresponding visible `vscode.TextEditor`.
   */
  public get editor() {
    return this._editor;
  }

  /**
   * The current mode of the editor.
   */
  public get mode() {
    return this._mode;
  }

  /**
   * Whether the editor for which state is being kept is the active text editor.
   */
  public get isActive() {
    return vscode.window.activeTextEditor === this._editor;
  }

  /**
   * Whether the editor for which state is being kept is visible.
   */
  public get isVisible() {
    return this._isVisible;
  }

  /**
   * An event which fires when the `editor` is permanently closed.
   */
  public get onEditorWasClosed() {
    return this._onEditorWasClosed.event;
  }

  /**
   * An event which fires when the `editor` becomes visible or hidden. Read
   * `isVisible` to find the new value.
   */
  public get onVisibilityDidChange() {
    return this._onVisibilityDidChange.event;
  }

  public constructor(
    public readonly extension: Extension,
    private _editor: vscode.TextEditor,
    private _mode: Mode,
  ) {
    for (let i = 0; i < PerEditorState._registeredStates.length; i++) {
      this._storage.push(undefined);
    }
  }

  public dispose() {
    const options = this._editor.options,
          mode = this._mode,
          vscodeMode = mode.modes.vscodeMode;

    options.cursorStyle = vscodeMode.cursorStyle;
    options.lineNumbers = vscodeMode.lineNumbers;

    if (this._isVisible) {
      this._isVisible = false;
      this._onVisibilityDidChange.fire(this);
    }

    this._onEditorWasClosed.fire(this);

    this._onEditorWasClosed.dispose();
    this._onVisibilityDidChange.dispose();

    for (let i = 0; i < this._storage.length; i++) {
      if (PerEditorState._registeredStates[i]) {
        (this._storage[i] as vscode.Disposable | undefined)?.dispose();
      }
    }
  }

  // Storage.
  // =============================================================================================

  private static readonly _registeredStates: boolean[] = [];

  /**
   * Returns a `Token` that can later be used to store editor-specific data.
   */
  public static registerState<T>(isDisposable: T extends vscode.Disposable ? true : false) {
    return this._registeredStates.push(isDisposable) - 1 as PerEditorState.Token<T>;
  }

  private readonly _storage: unknown[] = [];

  /**
   * Returns the object assigned to the given token.
   */
  public get<T>(token: PerEditorState.Token<T>) {
    return this._storage[token as number] as T | undefined;
  }

  /**
   * Stores a value that is related to the editor for which the state is kept.
   */
  public store<T>(token: PerEditorState.Token<T>, value: T | undefined) {
    const previousValue = this._storage[token as number];

    this._storage[token as number] = value;

    return previousValue as T | undefined;
  }

  // Changing modes.
  // =============================================================================================

  /**
   * Whether the editor is currently executing functions to change modes.
   */
  private _isChangingMode = false;

  /**
   * Sets the mode of the editor.
   */
  public async setMode(mode: Mode) {
    if (this._isChangingMode) {
      throw new Error("calling EditorState.setMode in a mode change handler is forbidden");
    }

    if (this._mode === mode) {
      return;
    }

    this._isChangingMode = true;

    const previousMode = this._mode;

    if (previousMode !== undefined) {
      this._clearDecorations(previousMode);

      await this._runCommands(previousMode.onLeaveMode, (e) =>
        `error trying to execute onLeaveMode commands for mode ${
          JSON.stringify(previousMode.name)}: ${e}`,
      );

      if (previousMode.selectionBehavior !== mode.selectionBehavior) {
        const editor = this._editor,
              document = editor.document,
              selections = editor.selections;

        editor.selections = mode.selectionBehavior === SelectionBehavior.Character
          ? Selections.toCharacterMode(selections, document)
          : Selections.fromCharacterMode(selections, document);
      }
    }

    this._mode = mode;
    this._updateDecorations(mode);

    await this._runCommands(mode.onEnterMode, (e) =>
      `error trying to execute onEnterMode commands for mode ${JSON.stringify(mode.name)}: ${e}`,
    );

    if (this.isActive) {
      await this.notifyDidBecomeActive();
    }

    this._isChangingMode = false;

    this.extension.editors.notifyDidChangeMode(this);
  }

  private _runCommands(
    commandsToRun: readonly command.Any[],
    error: (e: any) => string,
  ) {
    const context = new Context(this, this.extension.cancellationToken);

    return this.extension.runPromiseSafely(
      () => context.run(() => commands(...commandsToRun)),
      () => undefined,
      error,
    );
  }

  // Externally-triggered events.
  // =============================================================================================

  /**
   * Called when `vscode.window.onDidChangeActiveTextEditor` is triggered with
   * this editor.
   *
   * @deprecated Do not call -- internal implementation detail.
   */
  public notifyDidBecomeActive() {
    const { editor, mode } = this;

    this.extension.statusBar.activeModeSegment.setContent(mode.name);

    editor.options.lineNumbers = mode.lineNumbers;
    editor.options.cursorStyle = mode.cursorStyle;

    return vscode.commands.executeCommand("setContext", extensionName + ".mode", mode.name);
  }

  /**
   * Called when `vscode.window.onDidChangeActiveTextEditor` is triggered with
   * another editor.
   *
   * @deprecated Do not call -- internal implementation detail.
   */
  public notifyDidBecomeInactive(newEditorIsActive: boolean) {
    if (!newEditorIsActive) {
      this.extension.statusBar.activeModeSegment.setContent("<no active mode>");

      return vscode.commands.executeCommand("setContext", extensionName + ".mode", undefined);
    }

    return Promise.resolve();
  }

  /**
   * Called when `vscode.window.onDidChangeTextEditorSelection` is triggered on
   * this editor.
   *
   * @deprecated Do not call -- internal implementation detail.
   */
  public notifyDidChangeTextEditorSelection() {
    this._updateDecorations(this._mode);
  }

  /**
   * Called when the editor becomes visible again.
   *
   * @deprecated Do not call -- internal implementation detail.
   */
  public notifyDidBecomeVisible(editor: vscode.TextEditor) {
    assert(this._editor.document === editor.document);

    this._editor = editor;
    this._isVisible = true;
    this._onVisibilityDidChange.fire(this);
  }

  /**
   * Called when the editor was hidden, but not closed.
   *
   * @deprecated Do not call -- internal implementation detail.
   */
  public notifyDidBecomeHidden() {
    this._isVisible = false;
    this._onVisibilityDidChange.fire(this);
  }

  // Updating decorations.
  // =============================================================================================

  private _clearDecorations(mode: Mode) {
    const editor = this._editor,
          empty = [] as never[];

    for (const decoration of mode.decorations) {
      editor.setDecorations(decoration.type, empty);
    }

    editor.setDecorations(this.extension.editors.characterDecorationType, empty);
  }

  private _updateDecorations(mode: Mode) {
    const editor = this._editor,
          allSelections = editor.selections;

    for (const decoration of mode.decorations) {
      const selections =
        decoration.applyTo === "all"
          ? allSelections
          : decoration.applyTo === "main"
            ? [allSelections[0]]
            : allSelections.slice(1);

      if (decoration.renderOptions.isWholeLine) {
        const lines = selectionsLines(selections),
              ranges: vscode.Range[] = [];

        for (let i = 0, len = lines.length; i < len; i++) {
          const startLine = lines[i];
          let endLine = startLine;

          while (i + 1 < lines.length && lines[i + 1] === endLine + 1) {
            i++;
            endLine++;
          }

          const start = new vscode.Position(startLine, 0),
                end = startLine === endLine ? start : new vscode.Position(endLine, 0);

          ranges.push(new vscode.Range(start, end));
        }

        editor.setDecorations(decoration.type, ranges);
      } else {
        editor.setDecorations(decoration.type, selections);
      }
    }

    if (mode.selectionBehavior === SelectionBehavior.Character) {
      const document = this._editor.document,
            ranges = [] as vscode.Range[];

      for (let i = 0; i < allSelections.length; i++) {
        const selection = allSelections[i];

        if (!selection.isEmpty) {
          const end = Positions.next(selection.active, document);

          if (end !== undefined) {
            const active = selection.active,
                  start = active.character === 0 || active === selection.start
                    ? active
                    : new vscode.Position(active.line, active.character - 1);

            ranges.push(new vscode.Range(start, end));
          }
        }
      }

      editor.setDecorations(this.extension.editors.characterDecorationType, ranges);
    } else {
      editor.setDecorations(this.extension.editors.characterDecorationType, []);
    }

    editor.options.cursorStyle = mode.cursorStyle;
    editor.options.lineNumbers = mode.lineNumbers;
  }
}

export namespace PerEditorState {
  export declare class Token<T> {}

  export const enum Closed {
    /**
     * Editor is closed permanently, and w
     */
    Permanently,
    Temporarily,
  }
}

/**
 * The set of all known editors, and their associated `PerEditorState`.
 */
export class Editors implements vscode.Disposable {
  private readonly _editors = new Map<vscode.TextEditor, PerEditorState>();
  private readonly _fallbacks = new Map<vscode.TextDocument, PerEditorState>();
  private readonly _onModeDidChange = new vscode.EventEmitter<PerEditorState>();
  private readonly _subscriptions: vscode.Disposable[] = [];
  private _activeEditor?: PerEditorState;

  /**
   * @deprecated Do not access -- internal implementation detail.
   */
  public readonly characterDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor("editor.selectionBackground"),
  });

  /**
   * The Dance-specific state for the active `vscode.TextEditor`, or `undefined`
   * if `vscode.window.activeTextEditor === undefined`.
   */
  public get active() {
    return this._activeEditor;
  }

  /**
   * An event which fires on editor mode change.
   */
  public readonly onModeDidChange = this._onModeDidChange.event;

  public constructor(
    private readonly _extension: Extension,
  ) {
    vscode.window.onDidChangeActiveTextEditor(
      this._handleDidChangeActiveTextEditor, this, this._subscriptions);
    vscode.window.onDidChangeTextEditorSelection(
      this._handleDidChangeTextEditorSelection, this, this._subscriptions);
    vscode.window.onDidChangeVisibleTextEditors(
      this._handleDidChangeVisibleTextEditors, this, this._subscriptions);
    vscode.workspace.onDidCloseTextDocument(
      this._handleDidCloseTextDocument, this, this._subscriptions);

    this._handleDidChangeVisibleTextEditors(vscode.window.visibleTextEditors);

    const activeTextEditor = vscode.window.activeTextEditor;

    if (activeTextEditor !== undefined) {
      this._activeEditor = this._editors.get(activeTextEditor);
      this._activeEditor?.notifyDidBecomeActive();
    }
  }

  public dispose() {
    this._subscriptions.splice(0).forEach((d) => d.dispose());
    this.characterDecorationType.dispose();
  }

  /**
   * Returns the Dance-specific state for the given `vscode.TextEditor`.
   */
  public getState(editor: vscode.TextEditor) {
    const state = this._editors.get(editor);

    if (state === undefined) {
      throw new Error(
        "given editor does not have an equivalent EditorState; has it gone out of view?",
      );
    }

    return state;
  }

  private _handleDidChangeActiveTextEditor(e: vscode.TextEditor | undefined) {
    if (e === undefined) {
      this._activeEditor?.notifyDidBecomeInactive(false);
      this._activeEditor = undefined;
    } else {
      // Note that the call to `get` below requires that visible editors are
      // updated via `onDidChangeVisibleTextEditors`. Thankfully
      // `onDidChangeActiveTextEditor` is indeed triggered *after* that
      // event.
      this._activeEditor?.notifyDidBecomeInactive(true);
      this._activeEditor = this._editors.get(e);
      this._activeEditor?.notifyDidBecomeActive();
    }
  }

  private _handleDidChangeTextEditorSelection(e: vscode.TextEditorSelectionChangeEvent) {
    this._editors.get(e.textEditor)?.notifyDidChangeTextEditorSelection();
  }

  private _handleDidChangeVisibleTextEditors(visibleEditors: readonly vscode.TextEditor[]) {
    const hiddenEditors = new Map(this._editors),
          addedEditors = new Set<vscode.TextEditor>();

    for (const visibleEditor of visibleEditors) {
      if (!hiddenEditors.delete(visibleEditor)) {
        // `visibleEditor` had not been previously added to `_editors`, so it's
        // a new editor.
        addedEditors.add(visibleEditor);
      }
    }

    // Now `hiddenEditors` only contains editors that are no longer visible, and
    // `addedEditors` only contains editors that were not visible previously.
    const defaultMode = this._extension.modes.defaultMode;

    for (const addedEditor of addedEditors) {
      const fallback = this._fallbacks.get(addedEditor.document);

      if (fallback !== undefined) {
        fallback.notifyDidBecomeVisible(addedEditor);
        this._editors.set(addedEditor, fallback);
        this._fallbacks.delete(addedEditor.document);
      } else {
        this._editors.set(
          addedEditor, new PerEditorState(this._extension, addedEditor, defaultMode));
      }
    }

    // Dispose of no-longer-visible editors.
    const addedFallbacks = new Set<vscode.TextDocument>();

    for (const [hiddenEditor, state] of hiddenEditors) {
      this._editors.delete(hiddenEditor);

      // As soon as editors go out of view, their related `vscode.TextEditor`
      // instances are made obsolete. However, we'd still like to keep state
      // like active mode and selections in case the user reopens that editor
      // shortly.
      const fallback = this._fallbacks.get(hiddenEditor.document);

      if (fallback === undefined) {
        this._fallbacks.set(hiddenEditor.document, state);
        addedFallbacks.add(hiddenEditor.document);
      } else if (isMoreInteresting(fallback.editor, hiddenEditor)) {
        fallback.dispose();
        this._fallbacks.set(hiddenEditor.document, state);
        addedFallbacks.add(hiddenEditor.document);
      } else {
        state.dispose();
      }
    }

    for (const addedFallback of addedFallbacks) {
      this._fallbacks.get(addedFallback)!.notifyDidBecomeHidden();
    }
  }

  private _handleDidCloseTextDocument(document: vscode.TextDocument) {
    // Dispose of fallback editor, if any.
    const fallback = this._fallbacks.get(document);

    if (fallback !== undefined) {
      this._fallbacks.delete(document);
      fallback.dispose();
    } else {
      // There is no fallback editor, so there might be visible editors related
      // to that document.
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document === document) {
          const state = this._editors.get(editor);

          if (state !== undefined) {
            this._editors.delete(editor);
            state.dispose();
          }
        }
      }
    }
  }

  /**
   * @deprecated Do not call -- internal implementation detail.
   */
  public notifyDidChangeMode(state: PerEditorState) {
    this._onModeDidChange.fire(state);
  }
}

function getTotalRange(editor: vscode.TextEditor) {
  let minStart = editor.document.lineCount - 1,
      maxEnd = 0;

  for (const range of editor.visibleRanges) {
    minStart = Math.min(range.start.line, minStart);
    maxEnd = Math.max(range.end.line, maxEnd);
  }

  return maxEnd - minStart;
}

function isMoreInteresting(
  currentEditor: vscode.TextEditor,
  potentiallyMoreInteresting: vscode.TextEditor,
) {
  // Compute the total range of each editor; the "most interesting editor" is
  // the one with the greatest total range.
  return getTotalRange(currentEditor) < getTotalRange(potentiallyMoreInteresting);
}
