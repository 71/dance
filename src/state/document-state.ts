import * as vscode from "vscode";

import { EditorState } from "./editor-state";
import { Extension } from "./extension";

/**
 * Document-specific state, used for storing which editors are related to a
 * document.
 */
export class DocumentState implements vscode.Disposable {
  private readonly _editorStates: EditorState[] = [];
  private _fallbackEditorState?: EditorState;

  public constructor(
    /** The extension for which state is being kept. */
    public readonly extension: Extension,

    /** The editor for which state is being kept. */
    public readonly document: vscode.TextDocument,
  ) {}

  public dispose() {
    this._editorStates.splice(0).forEach((d) => d.dispose());
    this._fallbackEditorState?.dispose();
  }

  /**
   * Updates the list of editors linked to that document.
   */
  public updateEditorStates(editors: readonly vscode.TextEditor[]) {
    // We try as well as we can to match new editors to existing `EditorState`s.
    if (editors.length === 0) {
      if (this._editorStates.length === 0) {
        return;
      }

      // There are no editors related to that document anymore. Despite that, we
      // keep a reference to one of the `EditorState`s since it is very likely
      // that the user will reopen it shortly.
      this._fallbackEditorState = getMostInterestingEditorState(this._editorStates);
      this._editorStates.splice(0).forEach((e) => e !== this._fallbackEditorState && e.dispose());
    } else if (editors.length === 1) {
      const editor = editors[0];

      if (this._editorStates.length === 0) {
        const fallbackEditorState = this._fallbackEditorState;

        if (fallbackEditorState !== undefined) {
          this._editorStates.push(fallbackEditorState);
          this._fallbackEditorState = undefined;

          fallbackEditorState.updateEditor(editor);
        } else {
          this._editorStates.push(new EditorState(this, editor));
        }
      } else if (this._editorStates.length === 1) {
        this._editorStates[0].updateEditor(editor);
      } else {
        const closestIndex =
          findClosestEditorIndex(editor, this._editorStates.map((e) => e.editor));

        this._editorStates
          .splice(0, this._editorStates.length, this._editorStates[closestIndex])
          .forEach((e, i) => i !== closestIndex && e.dispose());
        this._editorStates[0].updateEditor(editor);
      }
    } else {
      const previousEditorStates = this._editorStates;

      if (previousEditorStates.length === 0) {
        const fallbackEditorState = this._fallbackEditorState;
        let closestIndex = -1;

        if (fallbackEditorState !== undefined) {
          closestIndex = findClosestEditorIndex(fallbackEditorState.editor, editors);

          previousEditorStates.push(fallbackEditorState);
          this._fallbackEditorState = undefined;

          fallbackEditorState.updateEditor(editors[closestIndex]);
        }

        for (let i = 0; i < editors.length; i++) {
          if (i === closestIndex) {
            continue;
          }

          previousEditorStates.push(new EditorState(this, editors[i]));
        }

        return;
      }

      const newEditorStates = [] as EditorState[],
            previousEditors = previousEditorStates.map((e) => e.editor);

      for (let i = 0; i < editors.length; i++) {
        const editor = editors[i],
              closestIndex = findClosestEditorIndex(editor, previousEditors),
              closestEditorState = previousEditorStates.splice(closestIndex, 1)[0];

        closestEditorState.updateEditor(editor);
        newEditorStates.push(closestEditorState);

        if (previousEditorStates.length === 0) {
          for (let j = i + 1; j < editors.length; j++) {
            newEditorStates.push(new EditorState(this, editors[j]));
          }

          break;
        }
      }

      previousEditorStates
        .splice(0, previousEditorStates.length, ...newEditorStates)
        .forEach((e) => e.dispose());
    }
  }

  /**
   * Returns the `EditorState` of each known `vscode.TextEditor`, where
   * `editor.document === this.document`.
   */
  public editorStates() {
    return this._editorStates as readonly EditorState[];
  }

  /**
   * Returns the `EditorState` associated with the given `vscode.TextEditor`, or
   * `undefined` if no such `EditorState` exists.
   */
  public getEditorState(editor: vscode.TextEditor) {
    return this._editorStates.find((e) => e.editor === editor);
  }
}

function getMostInterestingEditorState(editorStates: readonly EditorState[]) {
  if (editorStates.length === 1) {
    return editorStates[0];
  }

  let mostInterestingEditorState = editorStates[0],
      greatestRange = getTotalRange(mostInterestingEditorState.editor);

  for (let i = 1; i < editorStates.length; i++) {
    const editorState = editorStates[i],
          range = getTotalRange(editorState.editor);

    if (range > greatestRange) {
      greatestRange = range;
      mostInterestingEditorState = editorState;
    }
  }

  return mostInterestingEditorState;
}

function findClosestEditorIndex(editor: vscode.TextEditor, others: readonly vscode.TextEditor[]) {
  const withSameViewColumn = [] as number[];

  for (let i = 0; i < others.length; i++) {
    if (others[i].viewColumn === editor.viewColumn) {
      withSameViewColumn.push(i);
    }
  }

  if (withSameViewColumn.length === 1) {
    return withSameViewColumn[0];
  }

  if (withSameViewColumn.length === 0) {
    for (let i = 0; i < others.length; i++) {
      withSameViewColumn.push(i);
    }
  }

  const range = getTotalRange(editor);
  let closestOther = withSameViewColumn.pop()!,
      closestDiff = Math.abs(range - getTotalRange(others[closestOther]));

  if (closestDiff === 0) {
    return closestOther;
  }

  for (const i of withSameViewColumn) {
    const other = others[i],
          otherRange = getTotalRange(other);

    if (otherRange === range) {
      return i;
    }

    const diff = Math.abs(range - otherRange);

    if (diff < closestDiff) {
      closestOther = i;
      closestDiff = diff;
    }
  }

  return closestOther;
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
