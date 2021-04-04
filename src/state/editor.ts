import * as vscode from "vscode";

import { DocumentState } from "./document";
import { Command, CommandState, InputKind } from "../commands";
import { extensionName } from "../extension";
import { assert } from "../utils/errors";
import { TrackedSelection } from "../utils/tracked-selection";
import { MacroRegister } from "../register";
import { commands, selectionsLines } from "../api";
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
  private _id: string;

  /** The last matching editor. */
  private _editor: vscode.TextEditor;

  /** Selections that we had before entering insert mode. */
  private _insertModeSelections?: readonly TrackedSelection[];

  /**
   * Whether a selection change event should be expected while in insert mode.
   */
  private _expectSelectionChangeEvent = false;

  /** Whether the next selection change event should be ignored. */
  private _ignoreSelectionChangeEvent = false;

  /**
   * Whether the editor is currently executing functions to change modes.
   */
  private _isChangingMode = false;

  /** The ongoing recording of a macro in this editor. */
  private _macroRecording?: MacroRecording;

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
    this._macroRecording?.dispose();
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

    this.clearDecorations(this._mode);
    this._isChangingMode = true;

    await this.extension.runPromiseSafely(
      () => commands(...this._mode.onLeaveMode),
      () => undefined,
      (e) => `error trying to execute onLeaveMode commands for mode ${
        JSON.stringify(this._mode.name)}: ${e}`,
    );

    if (temporary && this._previousMode === undefined) {
      this._previousMode = this._mode;
    }
    this._mode = mode;

    this.updateDecorations(mode);

    await this.extension.runPromiseSafely(
      () => commands(...mode.onEnterMode),
      () => undefined,
      (e) => `error trying to execute onEnterMode commands for mode ${
        JSON.stringify(mode.name)}: ${e}`,
    );

    if (this.isActive) {
      await this.onDidBecomeActive();
    }

    this._isChangingMode = false;
  }

  /**
   * Starts recording a macro, setting up relevant handlers and UI elements.
   */
  public startMacroRecording(register: MacroRegister & { readonly name: string }) {
    if (this._macroRecording !== undefined) {
      return undefined;
    }

    const statusBarItem = vscode.window.createStatusBarItem();

    statusBarItem.command = Command.macrosRecordStop;
    statusBarItem.text = `Macro recording in ${register.name}`;

    this._macroRecording = new MacroRecording(register, this._commands.length, statusBarItem);

    return this._macroRecording.show().then(() => this._macroRecording);
  }

  /**
   * Stops recording a macro, disposing of its resources.
   */
  public stopMacroRecording() {
    const recording = this._macroRecording;

    if (recording === undefined) {
      return undefined;
    }

    this._macroRecording = undefined;

    return recording.dispose().then(() => recording);
  }

  /**
   * Called when `vscode.window.onDidChangeActiveTextEditor` is triggered with
   * this editor.
   */
  public onDidBecomeActive() {
    const { editor, mode } = this;

    this.extension.statusBarItem.text = "$(chevron-right) " + mode.name;

    this._macroRecording?.show();

    editor.options.lineNumbers = mode.lineNumbers;
    editor.options.cursorStyle = mode.cursorStyle;

    return vscode.commands.executeCommand("setContext", extensionName + ".mode", mode.name);
  }

  /**
   * Called when `vscode.window.onDidChangeActiveTextEditor` is triggered with
   * another editor.
   */
  public onDidBecomeInactive() {
    this._macroRecording?.hide();

    if (this._previousMode !== undefined) {
      return this.setMode(this._previousMode);
    }

    return Promise.resolve();
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
    const lineDecorationType = mode.lineDecorationType,
          selectionDecorationType = mode.selectionDecorationType,
          editor = this._editor;

    if (lineDecorationType !== undefined) {
      editor.setDecorations(lineDecorationType, []);
    }

    if (selectionDecorationType !== undefined) {
      editor.setDecorations(selectionDecorationType, []);
    }
  }

  private updateDecorations(mode: Mode) {
    const lineDecorationType = mode.lineDecorationType,
          selectionDecorationType = mode.selectionDecorationType,
          editor = this._editor;

    if (lineDecorationType !== undefined) {
      const lines = selectionsLines(editor.selections),
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

      editor.setDecorations(lineDecorationType, ranges);
    }

    if (selectionDecorationType !== undefined) {
      editor.setDecorations(selectionDecorationType, editor.selections);
    }

    editor.options.cursorStyle = mode.cursorStyle;
    editor.options.lineNumbers = mode.lineNumbers;
  }

  // =============================================================================================
  // ==  HISTORY  ================================================================================
  // =============================================================================================

  private readonly _commands = [] as CommandState<any>[];

  /**
   * The commands that were last used in this editor, from the earliest to the
   * latest.
   */
  public get recordedCommands() {
    return this._commands as readonly CommandState<any>[];
  }

  /**
   * Records invocation of a command.
   */
  public recordCommand<I extends InputKind>(state: CommandState<I>) {
    this.documentState.recordCommand(state);
    this._commands.push(state);

    if (this._macroRecording) {
      if (this._commands.length === 50) {
        vscode.window.showWarningMessage(
          "You're recording a lot of commands. This may increase memory usage.",
        );
      }
    } else {
      // If not recording, limit history to 20 items to avoid eating RAM.
      while (this._commands.length > 20) {
        this._commands.shift();
      }
    }
  }
}

function getEditorId(editor: vscode.TextEditor) {
  return ((editor as unknown) as { readonly id: string }).id;
}

/**
 * An ongoing recording of a macro.
 */
export class MacroRecording {
  public constructor(
    public readonly register: MacroRegister,
    public lastHistoryEntry: number,
    public readonly statusBarItem: vscode.StatusBarItem,
  ) {}

  public show() {
    this.statusBarItem.show();

    return vscode.commands.executeCommand("setContext", extensionName + ".recordingMacro", true);
  }

  public hide() {
    this.statusBarItem.hide();

    return vscode.commands.executeCommand("setContext", extensionName + ".recordingMacro", false);
  }

  public dispose() {
    this.statusBarItem.dispose();

    return vscode.commands.executeCommand("setContext", extensionName + ".recordingMacro", false);
  }
}
