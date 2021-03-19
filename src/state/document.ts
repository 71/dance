import * as vscode from "vscode";

import { EditorState } from "./editor";
import { Extension } from "./extension";
import { CommandState, InputKind } from "../commands";
import { assert } from "../utils/assert";
import { SavedSelection } from "../utils/savedSelection";

/**
 * Document-specific state.
 */
export class DocumentState {
  private readonly _editorStates: EditorState[] = [];
  private readonly _savedSelections: SavedSelection[] = [];

  public constructor(
    /** The extension for which state is being kept. */
    public readonly extension: Extension,

    /** The editor for which state is being kept. */
    public readonly document: vscode.TextDocument,
  ) {}

  /**
   * Disposes of the resources owned by and of the subscriptions of this
   * instance.
   */
  public dispose() {
    const editorStates = this._editorStates.splice(0);

    for (let i = 0, len = editorStates.length; i < len; i++) {
      editorStates[i].dispose();
    }

    this._savedSelections.length = 0;
  }

  /**
   * Returns the `EditorState` of each known `vscode.TextEditor`, where
   * `editor.document === this.document`.
   */
  public editorStates() {
    return this._editorStates as readonly EditorState[];
  }

  /**
   * Gets the `EditorState` for the given `vscode.TextEditor`, where
   * `editor.document === this.document`.
   */
  public getEditorState(editor: vscode.TextEditor) {
    assert(editor.document === this.document);

    const editorStates = this._editorStates,
          len = editorStates.length;

    for (let i = 0; i < len; i++) {
      const editorState = editorStates[i];

      if (editorState.isFor(editor)) {
        return editorState.updateEditor(editor);
      }
    }

    const editorState = new EditorState(this, editor);

    this._editorStates.push(editorState);

    return editorState;
  }

  /**
   * Called when `vscode.workspace.onDidChangeTextDocument` is triggered.
   */
  public onDidChangeTextDocument(e: vscode.TextDocumentChangeEvent) {
    const savedSelections = this._savedSelections;

    if (savedSelections !== undefined) {
      for (let i = 0; i < savedSelections.length; i++) {
        const savedSelection = savedSelections[i];

        for (let j = 0; j < e.contentChanges.length; j++) {
          savedSelection.updateAfterDocumentChanged(e.contentChanges[j]);
        }
      }
    }

    const editorStates = this._editorStates;

    for (let i = 0; i < editorStates.length; i++) {
      editorStates[i].onDidChangeTextDocument(e);
    }

    this.recordChanges(e.contentChanges);
  }

  // =============================================================================================
  // ==  SAVED SELECTIONS  =======================================================================
  // =============================================================================================

  /**
   * Saves the given selection, tracking changes to the given document and
   * updating the selection correspondingly over time.
   */
  public saveSelection(selection: vscode.Selection) {
    const anchorOffset = this.document.offsetAt(selection.anchor),
          activeOffset = this.document.offsetAt(selection.active),
          savedSelection = new SavedSelection(anchorOffset, activeOffset);

    this._savedSelections.push(savedSelection);

    return savedSelection;
  }

  /**
   * Forgets the given saved selections.
   */
  public forgetSelections(selections: readonly SavedSelection[]) {
    const savedSelections = this._savedSelections;

    if (savedSelections !== undefined) {
      for (let i = 0; i < selections.length; i++) {
        const index = savedSelections.indexOf(selections[i]);

        if (index !== -1) {
          savedSelections.splice(index, 1);
        }
      }
    }
  }

  // =============================================================================================
  // ==  HISTORY  ================================================================================
  // =============================================================================================

  private _lastCommand?: CommandState<any>;
  private readonly _recordedChanges = [] as RecordedChange[];

  /**
   * The changes that were last made in this editor.
   */
  public get recordedChanges() {
    return this._recordedChanges as readonly RecordedChange[];
  }

  /**
   * Adds the given changes to the history of the editor following the given
   * command.
   */
  private recordChanges(changes: readonly vscode.TextDocumentContentChangeEvent[]) {
    this._lastCommand?.recordFollowingChanges(changes);

    const recordedChanges = this._recordedChanges;

    if (recordedChanges.length + changes.length > 100) {
      recordedChanges.splice(0, recordedChanges.length + changes.length - 100);
    }

    for (let i = 0, len = changes.length; i < len; i++) {
      const change = changes[i],
            savedSelection = new SavedSelection(
              change.rangeOffset,
              change.rangeOffset + change.rangeLength,
            );

      this._savedSelections.push(savedSelection);
      recordedChanges.push(new RecordedChange(savedSelection, change.text));
    }
  }

  /**
   * Records invocation of a command.
   */
  public recordCommand<I extends InputKind>(state: CommandState<I>) {
    this._lastCommand = state;
  }
}

export class RecordedChange {
  public constructor(
    /** The range that got replaced. */
    public readonly range: SavedSelection,

    /** The new text for the range. */
    public readonly text: string,
  ) {}
}
