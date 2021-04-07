import * as vscode from "vscode";

import { EditorState } from "./editor";
import { Extension } from "./extension";
import { TrackedSelection } from "../utils/tracked-selection";
import { assert } from "../api";

/**
 * Document-specific state.
 */
export class DocumentState {
  private readonly _editorStates: EditorState[] = [];
  private readonly _history = new History(this.document);
  private readonly _trackedSelections: TrackedSelection.Set[] = [];

  private readonly _recordedChanges: RecordedChange[] = [];
  private readonly _recordedSelectionSet = new TrackedSelection.Set([]);

  public constructor(
    /** The extension for which state is being kept. */
    public readonly extension: Extension,

    /** The editor for which state is being kept. */
    public readonly document: vscode.TextDocument,
  ) {
    this._trackedSelections.push(this._recordedSelectionSet);
  }

  /**
   * Disposes of the resources owned by and of the subscriptions of this
   * instance.
   */
  public dispose() {
    const editorStates = this._editorStates;

    for (let i = 0, len = editorStates.length; i < len; i++) {
      editorStates[i].dispose();
    }

    editorStates.length = 0;

    const trackedSelectionSets = this._trackedSelections;

    for (let i = 0, len = trackedSelectionSets.length; i < len; i++) {
      trackedSelectionSets[i].dispose();
    }

    trackedSelectionSets.length = 0;

    this._history.clear();
    this._recordedChanges.length = 0;
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
    const trackedSelectionSets = this._trackedSelections;

    for (let i = 0; i < trackedSelectionSets.length; i++) {
      trackedSelectionSets[i].updateAfterDocumentChanged(e.contentChanges);
    }

    const editorStates = this._editorStates;

    for (let i = 0; i < editorStates.length; i++) {
      editorStates[i].onDidChangeTextDocument(e);
    }

    this._history.recordChanges(e.contentChanges);
  }

  // =============================================================================================
  // ==  SAVED SELECTIONS  =======================================================================
  // =============================================================================================

  /**
   * Saves the given selection set, tracking changes to the given document and
   * updating its selections correspondingly over time.
   */
  public trackSelectionSet(selectionSet: TrackedSelection.Set) {
    this._trackedSelections.push(selectionSet);
  }

  /**
   * Saves the given selections, tracking changes to the given document and
   * updating the selections correspondingly over time.
   */
  public trackSelections(selections: readonly vscode.Selection[]) {
    const trackedSelections = TrackedSelection.fromArray(selections, this.document),
          trackedSelectionSet = new TrackedSelection.Set(trackedSelections);

    this.trackSelectionSet(trackedSelectionSet);

    return trackedSelectionSet;
  }

  /**
   * Forgets the given saved selections.
   */
  public forgetSelections(trackedSelectionSet: TrackedSelection.Set) {
    const index = this._trackedSelections.indexOf(trackedSelectionSet);

    if (index !== -1) {
      this._trackedSelections.splice(index, 1);
    }

    trackedSelectionSet.dispose();
  }
}

export class RecordedChange {
  public constructor(
    /** The range that got replaced. */
    public readonly range: TrackedSelection,

    /** The new text for the range. */
    public readonly text: string,
  ) {}
}

/**
 * The history of changes in a document.
 */
export class History {
  private readonly _buffers = [new Float64Array(History.Constants.BufferSize)];
  private _currentBufferOffset = 0;

  public constructor(
    public readonly document: vscode.TextDocument,
  ) {}

  /**
   * Returns a `ChangeIdentifier` that can later be used to compute selections
   * that evolved from now.
   */
  public currentIdentifier(): History.ChangeIdentifier {
    return ((this._buffers.length - 1) << History.Constants.IdentifierStructOffsetBits)
         | this._currentBufferOffset;
  }

  /**
   * Records changes to the document.
   */
  public recordChanges(changes: readonly vscode.TextDocumentContentChangeEvent[]) {
    for (let i = 0, len = changes.length; i < len; i++) {
      this.recordChange(changes[i]);
    }
  }

  /**
   * Records a change to the document and returns a `ChangeIdentifier`.
   */
  public recordChange(change: vscode.TextDocumentContentChangeEvent): History.ChangeIdentifier {
    const buffers = this._buffers,
          bufferIdx = buffers.length - 1,
          buffer = buffers[bufferIdx],
          currentOffset = this._currentBufferOffset;

    buffer[currentOffset + History.Constants.OffsetIndex] = change.rangeOffset + change.rangeLength;
    buffer[currentOffset + History.Constants.DiffIndex] = change.text.length - change.rangeLength;

    if (currentOffset + History.Constants.EntrySize === History.Constants.BufferSize) {
      this._buffers.push(new Float64Array(History.Constants.BufferSize));
      this._currentBufferOffset = 0;
    } else {
      this._currentBufferOffset = currentOffset + History.Constants.EntrySize;
    }

    return (bufferIdx << History.Constants.IdentifierStructOffsetBits) | currentOffset;
  }

  /**
   * Returns a snapshot of the selection with the given anchor and active
   * positions. Values of this snapshot can later be given to
   * `computeSelectionOffsets` to compute the anchor and active positions of the
   * selection at a future state of the document.
   */
  public snapshot(anchor: vscode.Position, active: vscode.Position): History.SelectionSnapshot {
    const document = this.document,
          anchorOffset = document.offsetAt(anchor),
          activeOffset = anchor.isEqual(active) ? anchorOffset : document.offsetAt(active);

    return [this.currentIdentifier(), anchorOffset, activeOffset];
  }

  /**
   * Computes the new offsets of the anchor and active positions of a selection
   * that were snapshotted at the given `ChangeIdentifier`.
   */
  public computeSelectionOffsets(
    startId: History.ChangeIdentifier,
    anchorOffset: number,
    activeOffset: number,
  ): [anchorOffset: number, activeOffset: number] {
    let structOffset = startId & History.Constants.IdentifierStructOffsetMask,
        bufferOffset = startId >> History.Constants.IdentifierStructOffsetBits;
    const buffers = this._buffers,
          buffersLen = buffers.length,
          buffer = this._buffers[bufferOffset];

    while (bufferOffset < buffersLen) {
      while (structOffset < History.Constants.BufferSize) {
        const offset = buffer[structOffset + History.Constants.OffsetIndex],
              diff = buffer[structOffset + History.Constants.DiffIndex];

        if (offset <= activeOffset) {
          activeOffset += diff;
        }

        if (offset <= anchorOffset) {
          anchorOffset += diff;
        }

        structOffset += History.Constants.EntrySize;
      }

      bufferOffset++;
      structOffset = 0;
    }

    return [anchorOffset, activeOffset];
  }

  public computeSelection(startId: number, anchorOffset: number, activeOffset: number) {
    const updatedOffsets = this.computeSelectionOffsets(startId, anchorOffset, activeOffset),
          document = this.document,
          anchorPosition = document.positionAt(updatedOffsets[0]),
          activePosition = anchorOffset === activeOffset
            ? anchorPosition
            : document.positionAt(updatedOffsets[1]);

    return new vscode.Selection(anchorPosition, activePosition);
  }

  public clear() {
    this._currentBufferOffset = 0;
    this._buffers.splice(0, this._buffers.length, new Float64Array(History.Constants.BufferSize));
  }
}

export namespace History {
  export type ChangeIdentifier = number;
  export type SelectionSnapshot
    = readonly [changeId: ChangeIdentifier, anchorOffset: number, activeOffset: number];

  export const enum Constants {
    BufferSize = 4096,
    EntrySize = 2,

    OffsetIndex = 0,
    DiffIndex = 1,

    IdentifierStructOffsetBits = 12,
    IdentifierStructOffsetMask = (1 << IdentifierStructOffsetBits) - 1,
  }
}
