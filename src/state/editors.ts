import * as vscode from "vscode";

import type { Extension } from "./extension";
import type { Mode } from "./modes";
import { command, commands, Context, Positions, SelectionBehavior, Selections } from "../api";
import { extensionName } from "../utils/constants";
import { assert } from "../utils/errors";

/**
 * Dance-specific state related to a single `vscode.TextEditor`.
 */
export class PerEditorState implements vscode.Disposable {
  private readonly _onEditorWasClosed = new vscode.EventEmitter<this>();
  private readonly _onVisibilityDidChange = new vscode.EventEmitter<this>();
  private _isVisible = true;
  private _mode!: Mode;
  private _modeChangeSubscription!: vscode.Disposable;

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
    mode: Mode,
  ) {
    for (let i = 0; i < PerEditorState._registeredStates.length; i++) {
      this._storage.push(undefined);
    }

    this.setMode(mode);
  }

  public dispose() {
    this._clearDecorations(this._mode);

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

    this._modeChangeSubscription.dispose();

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
    return this._registeredStates.push(isDisposable) - 1 as unknown as PerEditorState.Token<T>;
  }

  private readonly _storage: unknown[] = [];

  /**
   * Returns the object assigned to the given token.
   */
  public get<T>(token: PerEditorState.Token<T>) {
    return this._storage[token as unknown as number] as T | undefined;
  }

  /**
   * Stores a value that is related to the editor for which the state is kept.
   */
  public store<T>(token: PerEditorState.Token<T>, value: T | undefined) {
    const previousValue = this._storage[token as unknown as number];

    this._storage[token as unknown as number] = value;

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
      this._modeChangeSubscription.dispose();
      this._clearDecorations(previousMode);

      await this._runCommands(previousMode.onLeaveMode, (e) =>
        `error trying to execute onLeaveMode commands for mode ${
          JSON.stringify(previousMode.name)}: ${e}`,
      );

      if (previousMode.selectionBehavior !== mode.selectionBehavior) {
        this._updateSelectionsAfterBehaviorChange(mode);
      }
    }

    this._mode = mode;
    this._modeChangeSubscription = mode.onChanged(([mode, props]) => {
      for (const prop of props) {
        switch (prop) {
        case "cursorStyle":
          this._editor.options.cursorStyle = mode.cursorStyle;
          break;

        case "lineNumbers":
          this._editor.options.lineNumbers = mode.lineNumbers;
          break;

        case "decorations":
        case "lineHighlight":
        case "selectionDecorationType":
          this._updateDecorations(mode);
          break;

        case "selectionBehavior":
          this._updateSelectionsAfterBehaviorChange(mode);
          break;
        }
      }
    });
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
    const context = new Context(this, this.extension.cancellationToken).doNotRecord();

    return this.extension.runPromiseSafely(
      () => context.runAsync(() => commands(...commandsToRun)),
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
   * Called when `vscode.window.onDidChangeTextEditorVisibleRanges` is triggered
   * on this editor.
   *
   * @deprecated Do not call -- internal implementation detail.
   */
  public notifyDidChangeTextEditorVisibleRanges() {
    this._updateOffscreenSelectionsIndicators(this._mode);
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

    if (mode.hiddenSelectionsIndicatorsDecorationType !== undefined) {
      editor.setDecorations(mode.hiddenSelectionsIndicatorsDecorationType, empty);
    }
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
        const lines = Selections.lines(selections),
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

    this._updateOffscreenSelectionsIndicators(mode);
  }

  private _updateSelectionsAfterBehaviorChange(mode: Mode) {
    const editor = this._editor,
          document = editor.document,
          selections = editor.selections;

    editor.selections = mode.selectionBehavior === SelectionBehavior.Character
      ? Selections.toCharacterMode(selections, document)
      : Selections.fromCharacterMode(selections, document);
  }

  private _updateOffscreenSelectionsIndicators(mode: Mode) {
    const decorationType = mode.hiddenSelectionsIndicatorsDecorationType;

    if (decorationType === undefined) {
      return;
    }

    const editor = this._editor,
          selections = editor.selections,
          visibleRanges = editor.visibleRanges;

    // Find which selections are offscreen.
    const offscreenSelections = [] as vscode.Selection[];

    for (const selection of selections) {
      let isOffscreen = true;

      for (const visibleRange of visibleRanges) {
        if (Selections.overlap(visibleRange, selection)) {
          isOffscreen = false;
          break;
        }
      }

      if (isOffscreen) {
        offscreenSelections.push(selection);
      }
    }

    // If there are no selections offscreen, clear decorations.
    if (offscreenSelections.length === 0) {
      editor.setDecorations(decorationType, []);
      return;
    }

    // Otherwise, add decorations for offscreen selections.
    const sortedVisibleRanges = visibleRanges.slice(),
          decorations = [] as vscode.DecorationOptions[];

    sortedVisibleRanges.sort((a, b) => a.start.compareTo(b.start));
    offscreenSelections.sort((a, b) => a.start.compareTo(b.start));

    function pushDecoration(
      decorations: vscode.DecorationOptions[],
      count: number,
      position: vscode.Position,
      relatively: "above" | "below",
    ) {
      decorations.push({
        range: new vscode.Range(position, position),
        renderOptions: {
          after: {
            contentText: `  ${count} hidden selection${count === 1 ? "" : "s"} ${relatively}`,
          },
        },
      });
    }

    // Hidden selections above each visible range.
    let offscreenSelectionIdx = 0;

    for (let i = 0; i < sortedVisibleRanges.length; i++) {
      const visibleRange = sortedVisibleRanges[i],
            visibleRangeStartLine = visibleRange.start.line;
      let count = 0;

      while (offscreenSelections.length > offscreenSelectionIdx
          && offscreenSelections[offscreenSelectionIdx].end.line < visibleRangeStartLine) {
        offscreenSelectionIdx++;
        count++;
      }

      if (count > 0) {
        pushDecoration(decorations, count, visibleRange.start, "above");
      }
    }

    // Hidden selections below the last visible range.
    const visibleRange = sortedVisibleRanges[sortedVisibleRanges.length - 1],
          count = offscreenSelections.length - offscreenSelectionIdx;

    if (count > 0) {
      pushDecoration(decorations, count, visibleRange.end, "below");
    }

    editor.setDecorations(decorationType, decorations);
  }
}

export declare namespace PerEditorState {
  export class Token<T> {
    private can_never_implement_this: never;
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

  private readonly _lastRemovedEditorStates: PerEditorState[] = [];
  private _lastRemovedEditorUri: string = "";

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
    vscode.window.onDidChangeTextEditorVisibleRanges(
      this._handleDidChangeTextEditorVisibleRanges, this, this._subscriptions);
    vscode.window.onDidChangeVisibleTextEditors(
      this._handleDidChangeVisibleTextEditors, this, this._subscriptions);
    vscode.workspace.onDidOpenTextDocument(
      this._handleDidOpenTextDocument, this, this._subscriptions);
    vscode.workspace.onDidCloseTextDocument(
      this._handleDidCloseTextDocument, this, this._subscriptions);

    queueMicrotask(() => {
      this._handleDidChangeVisibleTextEditors(vscode.window.visibleTextEditors);

      const activeTextEditor = vscode.window.activeTextEditor;

      if (activeTextEditor !== undefined) {
        this._activeEditor = this._editors.get(activeTextEditor);
        this._activeEditor?.notifyDidBecomeActive();
      }
    });
  }

  public dispose() {
    this._subscriptions.splice(0).forEach((d) => d.dispose());
    this._lastRemovedEditorStates.splice(0).forEach((s) => s.dispose());
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

  private _handleDidChangeTextEditorVisibleRanges(e: vscode.TextEditorVisibleRangesChangeEvent) {
    this._editors.get(e.textEditor)?.notifyDidChangeTextEditorVisibleRanges();
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

  private _handleDidOpenTextDocument(document: vscode.TextDocument) {
    // When changing the file type of a new file, the current document is closed
    // and a new document with the same name and content is created. Attempt to
    // recover the state of the previously closed document here.
    if (document.uri.toString() === this._lastRemovedEditorUri) {
      const states = this._lastRemovedEditorStates;
      let i = 0;

      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document === document && i < states.length) {
          this._editors.set(editor, states[i++]);
        }
      }

      assert(i === states.length);
    } else {
      for (const state of this._lastRemovedEditorStates) {
        state.dispose();
      }
    }

    this._lastRemovedEditorStates.length = 0;
    this._lastRemovedEditorUri = "";
  }

  private _handleDidCloseTextDocument(document: vscode.TextDocument) {
    // Dispose of previous document state, if any.
    for (const state of this._lastRemovedEditorStates) {
      state.dispose();
    }

    this._lastRemovedEditorStates.length === 0;

    // Dispose of fallback editor, if any.
    const fallback = this._fallbacks.get(document);

    if (fallback !== undefined) {
      this._fallbacks.delete(document);
      fallback.dispose();
    } else {
      // There is no fallback editor, so there might be visible editors related
      // to that document.
      this._lastRemovedEditorUri = document.uri.toString();

      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document === document) {
          const state = this._editors.get(editor);

          if (state !== undefined) {
            this._editors.delete(editor);
            this._lastRemovedEditorStates.push(state);
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
