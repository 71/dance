import * as vscode from "vscode";

import { DocumentState } from "./document";
import { extensionName } from "../extension";
import { assert, command, commands, Context, edit, selectionsLines } from "../api";
import { Mode } from "../mode";

/**
 * Editor-specific state.
 */
export class EditorState {
  /**
   * The internal identifir of the ID.
   *
   * Unlike documents, VS Code does not reuse `vscode.TextEditor` objects,
   * so comparing by reference using `===` may not always return `true`,
   * even for the same document. To keep editor-specific state anyway,
   * we're using its internal identifier, which seems to be unique and
   * to stay the same over time.
   */
  private readonly _id: string;

  /** The last matching editor. */
  private _editor: vscode.TextEditor;

  /**
   * Whether the editor is currently executing functions to change modes.
   */
  private _isChangingMode = false;

  private _mode!: Mode;
  private _previousMode?: Mode;

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
   * Preferred columns when navigating up and down.
   */
  public readonly preferredColumns: number[] = [];

  public constructor(
    /** The state of the document for which this editor exists. */
    public readonly documentState: DocumentState,

    /** The text editor for which state is being kept. */
    editor: vscode.TextEditor,
  ) {
    this._id = getEditorId(editor);
    this._editor = editor;

    this.setMode(documentState.extension.modes.defaultMode);
  }

  /**
   * Disposes of the resources owned by and of the subscriptions of this
   * instance.
   */
  public dispose() {
    const options = this._editor.options,
          vscodeMode = this._mode.modes.vscodeMode;

    options.cursorStyle = vscodeMode.cursorStyle;
    options.lineNumbers = vscodeMode.lineNumbers;

    this.clearDecorations(this.mode);
  }

  /**
   * Updates the instance of `vscode.TextEditor` for this editor.
   */
  public updateEditor(editor: vscode.TextEditor) {
    assert(this.isFor(editor));

    this._editor = editor;

    return this;
  }

  /**
   * Returns whether this state is for the given editor.
   */
  public isFor(editor: vscode.TextEditor) {
    return this.documentState.document === editor.document && this._id === getEditorId(editor);
  }

  /**
   * Sets the mode of the editor.
   */
  public async setMode(mode: Mode, temporary = false) {
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

      if (temporary && this._previousMode === undefined) {
        this._previousMode = previousMode;
      }
    }

    this._mode = mode;
    this.updateDecorations(mode);

    await this.runCommands(mode.onEnterMode, (e) =>
      `error trying to execute onEnterMode commands for mode ${JSON.stringify(mode.name)}: ${e}`,
    );

    if (this.isActive) {
      await this.onDidBecomeActive();
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
  public onDidBecomeActive() {
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
  public async onDidBecomeInactive(newEditorIsActive: boolean) {
    if (!newEditorIsActive) {
      this.extension.statusBar.activeModeSegment.setContent("<no active mode>");

      await vscode.commands.executeCommand("setContext", extensionName + ".mode", undefined);
    }

    if (this._previousMode !== undefined) {
      await this.setMode(this._previousMode);
    }
  }

  /**
   * Called when `vscode.window.onDidChangeTextEditorSelection` is triggered.
   */
  public async onDidChangeTextEditorSelection(e: vscode.TextEditorSelectionChangeEvent) {
    if (this._previousMode !== undefined) {
      await this.setMode(this._previousMode);
    }

    const mode = this._mode;

    // Update decorations.
    this.updateDecorations(mode);
  }

  /**
   * Called when `vscode.workspace.onDidChangeTextDocument` is triggered on the
   * document of the editor.
   */
  public onDidChangeTextDocument(e: vscode.TextDocumentChangeEvent) {
  }

  // =============================================================================================
  // ==  DECORATIONS  ============================================================================
  // =============================================================================================

  private clearDecorations(mode: Mode) {
    const editor = this._editor,
          empty = [] as never[];

    for (const decoration of mode.decorations) {
      editor.setDecorations(decoration.type, empty);
    }
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

    editor.options.cursorStyle = mode.cursorStyle;
    editor.options.lineNumbers = mode.lineNumbers;
  }
}

function getEditorId(editor: vscode.TextEditor) {
  return ((editor as unknown) as { readonly id: string }).id;
}
