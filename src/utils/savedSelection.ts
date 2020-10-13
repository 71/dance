import * as vscode from "vscode";

/**
 * A selection that has been saved, and that is being tracked.
 */
export class SavedSelection {
  private _anchorOffset: number;
  private _activeOffset: number;

  public constructor(anchorOffset: number, activeOffset: number) {
    this._anchorOffset = anchorOffset;
    this._activeOffset = activeOffset;
  }

  /** The offset of the anchor in its document. */
  public get anchorOffset() {
    return this._anchorOffset;
  }

  /** The offset of the active position in its document. */
  public get activeOffset() {
    return this._activeOffset;
  }

  /** Whether the selection is reversed (i.e. `activeOffset < anchorOffset`). */
  public get isReversed() {
    return this._activeOffset < this._anchorOffset;
  }

  /**
   * Returns the anchor of the saved selection.
   */
  public anchor(document: vscode.TextDocument) {
    return document.positionAt(this._anchorOffset);
  }

  /**
   * Returns the active position of the saved selection.
   */
  public active(document: vscode.TextDocument) {
    return document.positionAt(this._activeOffset);
  }

  /**
   * Returns the saved selection, restored in the given document.
   */
  public selection(document: vscode.TextDocument) {
    return new vscode.Selection(this.anchor(document), this.active(document));
  }

  /**
   * Updates the underlying selection to reflect a change in its document.
   */
  public updateAfterDocumentChanged(e: vscode.TextDocumentContentChangeEvent) {
    const diff = e.text.length - e.rangeLength,
      offset = e.rangeOffset + e.rangeLength;

    if (offset <= this._activeOffset) {
      this._activeOffset += diff;
    }

    if (offset <= this._anchorOffset) {
      this._anchorOffset += diff;
    }
  }
}
