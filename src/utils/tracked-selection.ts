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
  public updateAfterDocumentChanged(
    changes: readonly vscode.TextDocumentContentChangeEvent[],
    flags: TrackedSelection.Flags,
  ) {
    let activeOffset = this._activeOffset,
        anchorOffset = this._anchorOffset;

    const activeIsStart = activeOffset <= anchorOffset,
          anchorIsStart = activeOffset >= anchorOffset,
          inclusiveStart = (flags & TrackedSelection.Flags.StrictStart) === 0,
          inclusiveEnd = (flags & TrackedSelection.Flags.StrictEnd) === 0,
          inclusiveActive = activeIsStart ? inclusiveStart : inclusiveEnd,
          inclusiveAnchor = anchorIsStart ? inclusiveStart : inclusiveEnd;

    for (let i = 0, len = changes.length; i < len; i++) {
      const change = changes[i],
            diff = change.text.length - change.rangeLength,
            offset = change.rangeOffset + change.rangeLength;

      if (offset < activeOffset || (inclusiveActive && offset === activeOffset)) {
        activeOffset += diff;
      }

      if (offset < anchorOffset || (inclusiveAnchor && offset === anchorOffset)) {
        anchorOffset += diff;
      }
    }

    this._activeOffset = activeOffset;
    this._anchorOffset = anchorOffset;
  }
}

export namespace TrackedSelection {
  /**
   * Flags passed to `TrackedSelection.updateAfterDocumentChanged`.
   */
  export const enum Flags {
    Inclusive = 0,

    StrictStart = 0b01,
    StrictEnd   = 0b10,

    Strict = 0b11,
  }

  /**
   * A set of `TrackedSelection`s.
   */
  export class Set implements vscode.Disposable {
    private readonly _onDisposed = new vscode.EventEmitter<this>();
    private readonly _selections: TrackedSelection[];
    private readonly _subscription: vscode.Disposable;

    public get onDisposed() {
      return this._onDisposed.event;
    }

    public get selections() {
      return this._selections as readonly TrackedSelection[];
    }

    public constructor(
      selections: TrackedSelection[],
      public readonly document: vscode.TextDocument,
      public readonly flags = Flags.Inclusive,
    ) {
      this._selections = selections;
      this._subscription =
        vscode.workspace.onDidChangeTextDocument(this.updateAfterDocumentChanged, this);
    }

    public addTrackedSelections(selections: readonly TrackedSelection[]) {
      this._selections.push(...selections);

      return this;
    }

    public addSelections(selections: readonly vscode.Selection[]) {
      return this.addTrackedSelections(TrackedSelection.fromArray(selections, this.document));
    }

    public addTrackedSelection(selection: TrackedSelection) {
      return this.addTrackedSelections([selection]);
    }

    public addSelection(selection: vscode.Selection) {
      return this.addTrackedSelection(TrackedSelection.from(selection, this.document));
    }

    /**
     * Updates the tracked selections to reflect a change in their document.
     *
     * @returns whether the change was applied.
     */
    protected updateAfterDocumentChanged(e: vscode.TextDocumentChangeEvent) {
      if (e.document !== this.document || e.contentChanges.length === 0) {
        return false;
      }

      const trackedSelections = this._selections,
            flags = this.flags,
            changes = e.contentChanges;

      for (let i = 0, len = trackedSelections.length; i < len; i++) {
        trackedSelections[i].updateAfterDocumentChanged(changes, flags);
      }

      return true;
    }

    public restore() {
      const document = this.document,
            trackedSelections = this.selections,
            trackedSelectionsLen = trackedSelections.length,
            selections = new Array<vscode.Selection>(trackedSelectionsLen);

      for (let i = 0; i < trackedSelectionsLen; i++) {
        selections[i] = trackedSelections[i].restore(document);
      }

      return selections;
    }

    public restoreNonEmpty() {
      const document = this.document,
            trackedSelections = this.selections,
            trackedSelectionsLen = trackedSelections.length,
            selections = [] as vscode.Selection[];

      for (let i = 0; i < trackedSelectionsLen; i++) {
        const trackedSelection = trackedSelections[i];

        if (trackedSelection.length > 0) {
          selections.push(trackedSelection.restore(document));
        }
      }

      return selections;
    }

    public dispose() {
      this._selections.length = 0;
      this._subscription.dispose();
    }
  }

  /**
   * A `TrackedSelection.Set` that displays active selections using some given
   * style.
   */
  export class StyledSet extends Set {
    private readonly _decorationType: vscode.TextEditorDecorationType;

    public constructor(
      selections: TrackedSelection[],
      public readonly editor: Pick<vscode.TextEditor, "setDecorations" | "document">,
      renderOptions: vscode.DecorationRenderOptions,
    ) {
      super(selections, editor.document, rangeBehaviorToFlags(renderOptions.rangeBehavior));

      this._decorationType = vscode.window.createTextEditorDecorationType(renderOptions);
      this.updateDecorations();
    }

    public addTrackedSelections(selections: readonly TrackedSelection[]) {
      super.addTrackedSelections(selections);

      if (selections.some((selection) => selection.length > 0)) {
        this.updateDecorations();
      }

      return this;
    }

    protected updateAfterDocumentChanged(e: vscode.TextDocumentChangeEvent) {
      if (!super.updateAfterDocumentChanged(e)) {
        return false;
      }

      this.updateDecorations();

      return true;
    }

    public dispose() {
      super.dispose();

      this._decorationType.dispose();
    }

    private updateDecorations() {
      this.editor.setDecorations(this._decorationType, this.restoreNonEmpty());
    }
  }
}

function rangeBehaviorToFlags(rangeBehavior: vscode.DecorationRangeBehavior | undefined) {
  switch (rangeBehavior) {
  case vscode.DecorationRangeBehavior.ClosedOpen:
    return TrackedSelection.Flags.StrictStart;

  case vscode.DecorationRangeBehavior.OpenClosed:
    return TrackedSelection.Flags.StrictEnd;

  case vscode.DecorationRangeBehavior.ClosedClosed:
    return TrackedSelection.Flags.Strict;

  default:
    return TrackedSelection.Flags.Inclusive;
  }
}
