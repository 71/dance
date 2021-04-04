import * as vscode from "vscode";

/**
 * A selection that is being tracked. Changes to the document will be applied to
 * the selection in order to restore it later.
 */
export class TrackedSelection {
  private _anchorOffset: number;
  private _activeOffset: number;

  public constructor(anchorOffset: number, activeOffset: number) {
    this._anchorOffset = anchorOffset;
    this._activeOffset = activeOffset;
  }

  /**
   * Creates a new `TrackedSelection`, reading offsets from the given selection
   * in the given document.
   */
  public static from(selection: vscode.Selection, document: vscode.TextDocument) {
    const anchor = selection.anchor,
          active = selection.active;

    if (anchor.line === active.line) {
      const anchorOffset = document.offsetAt(anchor),
            activeOffset = anchorOffset + active.character - anchor.character;

      return new TrackedSelection(anchorOffset, activeOffset);
    }

    return new TrackedSelection(document.offsetAt(anchor), document.offsetAt(active));
  }

  /**
   * Creates a new `TrackedSelection`, reading offsets from the given selection
   * in the given document.
   */
  public static fromArray(selections: readonly vscode.Selection[], document: vscode.TextDocument) {
    const trackedSelections = new Array<TrackedSelection>(selections.length);

    for (let i = 0, len = selections.length; i < len; i++) {
      trackedSelections[i] = TrackedSelection.from(selections[i], document);
    }

    return trackedSelections;
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

  /** The offset of the start position in its document. */
  public get offset() {
    return Math.min(this._activeOffset, this._anchorOffset);
  }

  /** The length of the selection in its document. */
  public get length() {
    const activeOffset = this._activeOffset,
          anchorOffset = this._anchorOffset;

    return activeOffset > anchorOffset ? activeOffset - anchorOffset : anchorOffset - activeOffset;
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
  public restore(document: vscode.TextDocument) {
    return new vscode.Selection(this.anchor(document), this.active(document));
  }

  /**
   * Updates the underlying selection to reflect a change in its document.
   */
  public updateAfterDocumentChanged(changes: readonly vscode.TextDocumentContentChangeEvent[]) {
    for (let i = 0, len = changes.length; i < len; i++) {
      const change = changes[i],
            diff = change.text.length - change.rangeLength,
            offset = change.rangeOffset + change.rangeLength;

      if (offset <= this._activeOffset) {
        this._activeOffset += diff;
      }

      if (offset <= this._anchorOffset) {
        this._anchorOffset += diff;
      }
    }
  }
}

/**
 * A set of `TrackedSelection`s.
 */
export class TrackedSelectionSet implements vscode.Disposable {
  private readonly _selections: TrackedSelection[];

  public get selections(): readonly TrackedSelection[] {
    return this._selections;
  }

  public constructor(selections: TrackedSelection[]) {
    this._selections = selections;
  }

  public addTrackedSelection(selection: TrackedSelection) {
    this._selections.push(selection);
  }

  /**
   * Updates the tracked selections to reflect a change in their document.
   */
  public updateAfterDocumentChanged(changes: readonly vscode.TextDocumentContentChangeEvent[]) {
    const trackedSelections = this.selections;

    for (let i = 0, len = trackedSelections.length; i < len; i++) {
      trackedSelections[i].updateAfterDocumentChanged(changes);
    }
  }

  public restore(document: vscode.TextDocument) {
    const trackedSelections = this.selections,
          trackedSelectionsLen = trackedSelections.length,
          selections = new Array<vscode.Selection>(trackedSelectionsLen);

    for (let i = 0; i < trackedSelectionsLen; i++) {
      selections[i] = trackedSelections[i].restore(document);
    }

    return selections;
  }

  public dispose() {
    this._selections.length = 0;
  }
}

export namespace TrackedSelectionSet {
  /**
   * A `TrackedSelectionSet` that displays active selections using some given
   * style.
   */
  export class Styled extends TrackedSelectionSet {
    private readonly _decorationType: vscode.TextEditorDecorationType;

    public constructor(
      public readonly editor: vscode.TextEditor,
      selections: TrackedSelection[],
      renderOptions: vscode.DecorationRenderOptions,
    ) {
      super(selections);

      this._decorationType = vscode.window.createTextEditorDecorationType(renderOptions);
    }

    public addTrackedSelection(selection: TrackedSelection) {
      super.addTrackedSelection(selection);

      this.editor.setDecorations(this._decorationType, this.restore(this.editor.document));
    }

    public updateAfterDocumentChanged(changes: readonly vscode.TextDocumentContentChangeEvent[]) {
      super.updateAfterDocumentChanged(changes);

      this.editor.setDecorations(this._decorationType, this.restore(this.editor.document));
    }

    public dispose() {
      super.dispose();

      this._decorationType.dispose();
    }
  }
}
