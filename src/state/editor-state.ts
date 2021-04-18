import * as vscode from "vscode";

import { DocumentState } from "./document-state";
import { extensionName } from "../extension";
import { assert, command, commands, Context, Positions, Selections, selectionsLines } from "../api";
import { Mode, SelectionBehavior } from "./modes";

/**
 * Editor-specific state.
 */
export class EditorState implements vscode.Disposable {
  private readonly _onEditorWasClosed = new vscode.EventEmitter<this>();

  /**
   * The corresponding visible `vscode.TextEditor`.
   */
  private _editor: vscode.TextEditor;

  /**
   * Whether the editor is currently executing functions to change modes.
   */
  private _isChangingMode = false;

  /**
   * The active mode in this editor.
   */
  private _mode!: Mode;

  /**
   * The mode of the editor.
   */
  public get mode() {
    return this._mode;
  }

  /**
   * The extension for which state is being kept.
   */
  public get extension() {
    return this.documentState.extension;
  }

  /**
   * The editor for which state is being kept.
   */
  public get editor() {
    return this._editor;
  }

  /**
   * Whether the editor for which state is being kept is the active text editor.
   */
  public get isActive() {
    return vscode.window.activeTextEditor === this._editor;
  }

  /**
   * An event which fires when the editor wrapped by this `EditorState` is
   * closed.
   */
  public get onEditorWasClosed() {
    return this._onEditorWasClosed.event;
  }

  public constructor(
    /** The state of the document for which this editor exists. */
    public readonly documentState: DocumentState,

    /** The text editor for which state is being kept. */
    editor: vscode.TextEditor,
  ) {
    this._editor = editor;

    this.setMode(documentState.extension.modes.defaultMode);
  }

  public dispose() {
    const options = this._editor.options,
          mode = this._mode,
          vscodeMode = mode.modes.vscodeMode;

    options.cursorStyle = vscodeMode.cursorStyle;
    options.lineNumbers = vscodeMode.lineNumbers;

    this.clearDecorations(mode);
    this._characterDecorationType.dispose();

    this._onEditorWasClosed.fire(this);
    this._onEditorWasClosed.dispose();
  }

  /**
   * Updates the instance of `vscode.TextEditor` for this editor.
   */
  public updateEditor(editor: vscode.TextEditor) {
    assert(this.documentState.document === editor.document);

    this._editor = editor;

    return this;
  }

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
      this.clearDecorations(previousMode);

      await this.runCommands(previousMode.onLeaveMode, (e) =>
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
    this.updateDecorations(mode);

    await this.runCommands(mode.onEnterMode, (e) =>
      `error trying to execute onEnterMode commands for mode ${JSON.stringify(mode.name)}: ${e}`,
    );

    if (this.isActive) {
      await this.notifyDidBecomeActive();
    }

    this._isChangingMode = false;

    // @ts-expect-error
    this.extension._onModeDidChange.fire(this);
  }

  private runCommands(
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

  /**
   * Called when `vscode.window.onDidChangeActiveTextEditor` is triggered with
   * this editor.
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
   */
  public notifyDidChangeTextEditorSelection() {
    this.updateDecorations(this._mode);
  }

  // =============================================================================================
  // ==  DECORATIONS  ============================================================================
  // =============================================================================================

  private readonly _characterDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor("editor.selectionBackground"),
  });

  private clearDecorations(mode: Mode) {
    const editor = this._editor,
          empty = [] as never[];

    for (const decoration of mode.decorations) {
      editor.setDecorations(decoration.type, empty);
    }

    editor.setDecorations(this._characterDecorationType, empty);
  }

  private updateDecorations(mode: Mode) {
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

      editor.setDecorations(this._characterDecorationType, ranges);
    } else {
      editor.setDecorations(this._characterDecorationType, []);
    }

    editor.options.cursorStyle = mode.cursorStyle;
    editor.options.lineNumbers = mode.lineNumbers;
  }
}
