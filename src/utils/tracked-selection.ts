import * as vscode from "vscode";

import { ArgumentError } from "../api";
import { PerEditorState } from "../state/editors";

export namespace TrackedSelection {
  /**
   * Flags passed to `TrackedSelection.updateAfterDocumentChanged`.
   */
  export const enum Flags {
    Inclusive = 0,

    StrictStart = 0b01,
    StrictEnd   = 0b10,

    Strict = 0b11,

    EmptyExtendsForward = 0b01_00,
    EmptyExtendsBackward = 0b10_00,
    EmptyMoves = 0b11_00,
  }

  /**
   * An array of tracked selections selections.
   */
  export interface Array extends Iterable<number> {
    [index: number]: number;
    readonly length: number;
  }

  /**
   * Creates a new `TrackedSelection.Array`, reading offsets from the given
   * selections in the given document.
   */
  export function fromArray(
    selections: readonly vscode.Selection[],
    document: vscode.TextDocument,
  ): Array {
    const trackedSelections = [] as number[];

    for (let i = 0, len = selections.length; i < len; i++) {
      const selection = selections[i],
            anchor = selection.anchor,
            active = selection.active;

      if (anchor.line === active.line) {
        const anchorOffset = document.offsetAt(anchor),
              activeOffset = anchorOffset + active.character - anchor.character;

        trackedSelections.push(anchorOffset, activeOffset);
      } else {
        trackedSelections.push(document.offsetAt(anchor), document.offsetAt(active));
      }
    }

    return trackedSelections;
  }

  export function restore(array: Array, index: number, document: vscode.TextDocument) {
    const anchor = document.positionAt(array[index << 1]),
          active = document.positionAt(array[(index << 1) | 1]);

    return new vscode.Selection(anchor, active);
  }

  export function anchorOffset(array: Array, index: number) {
    return array[index << 1];
  }

  export function activeOffset(array: Array, index: number) {
    return array[(index << 1) | 1];
  }

  export function startOffset(array: Array, index: number) {
    return Math.min(anchorOffset(array, index), activeOffset(array, index));
  }

  export function endOffset(array: Array, index: number) {
    return Math.max(anchorOffset(array, index), activeOffset(array, index));
  }

  export function length(array: Array, index: number) {
    return Math.abs(anchorOffset(array, index) - activeOffset(array, index));
  }

  export function setAnchorOffset(array: Array, index: number, offset: number) {
    array[index << 1] = offset;
  }

  export function setActiveOffset(array: Array, index: number, offset: number) {
    array[(index << 1) | 1] = offset;
  }

  export function activeIsStart(array: Array, index: number) {
    return activeOffset(array, index) <= anchorOffset(array, index);
  }

  export function setLength(array: Array, index: number, length: number) {
    const active = activeOffset(array, index),
          anchor = anchorOffset(array, index);

    if (active < anchor) {
      setAnchorOffset(array, index, active + length);
    } else {
      setActiveOffset(array, index, anchor + length);
    }
  }

  export function setStartEnd(
    array: Array,
    index: number,
    startOffset: number,
    endOffset: number,
    startIsActive: boolean,
  ) {
    if (startIsActive) {
      setActiveOffset(array, index, startOffset);
      setAnchorOffset(array, index, endOffset);
    } else {
      setActiveOffset(array, index, endOffset);
      setAnchorOffset(array, index, startOffset);
    }
  }

  /**
   * Returns the saved selections, restored in the given document.
   */
  export function restoreArray(array: Array, document: vscode.TextDocument) {
    const selections = [] as vscode.Selection[];

    for (let i = 0, len = array.length >> 1; i < len; i++) {
      selections.push(restore(array, i, document));
    }

    return selections;
  }

  /**
   * Returns the saved selections, restored in the given document, skipping
   * empty selections.
   */
  export function restoreNonEmpty(array: Array, document: vscode.TextDocument) {
    const selections = [] as vscode.Selection[];

    for (let i = 0, len = array.length >> 1; i < len; i++) {
      const anchorOffset = array[i << 1],
            activeOffset = array[(i << 1) | 1];

      if (anchorOffset === activeOffset) {
        continue;
      }

      selections.push(
        new vscode.Selection(document.positionAt(anchorOffset), document.positionAt(activeOffset)),
      );
    }

    return selections;
  }

  /**
   * Updates the underlying selection to reflect a change in its document.
   */
  export function updateAfterDocumentChanged(
    array: Array,
    changes: readonly vscode.TextDocumentContentChangeEvent[],
    flags: TrackedSelection.Flags,
  ) {
    for (let i = 0, len = array.length; i < len; i += 2) {
      let anchorOffset = array[i],
          activeOffset = array[i + 1],
          inclusiveActive: boolean,
          inclusiveAnchor: boolean;

      if (anchorOffset === activeOffset) {
        // Empty selection.
        inclusiveActive = (flags & Flags.EmptyExtendsForward) === Flags.EmptyExtendsForward;
        inclusiveAnchor = (flags & Flags.EmptyExtendsBackward) === Flags.EmptyExtendsBackward;
      } else {
        const activeIsStart = activeOffset <= anchorOffset,
              anchorIsStart = activeOffset >= anchorOffset,
              inclusiveStart = (flags & Flags.StrictStart) === 0,
              inclusiveEnd = (flags & Flags.StrictEnd) === 0;

        inclusiveActive = activeIsStart ? !inclusiveStart : inclusiveEnd;
        inclusiveAnchor = anchorIsStart ? !inclusiveStart : inclusiveEnd;
      }

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

      array[i] = anchorOffset;
      array[i + 1] = activeOffset;
    }
  }

  /**
   * A set of `TrackedSelection`s.
   */
  export class Set implements vscode.Disposable {
    private readonly _onDisposed = new vscode.EventEmitter<this>();
    private readonly _selections: Array;
    private readonly _onDidChangeTextDocumentSubscription: vscode.Disposable;

    public get onDisposed() {
      return this._onDisposed.event;
    }

    public constructor(
      selections: Array,
      public readonly document: vscode.TextDocument,
      public flags = Flags.Inclusive,
    ) {
      ArgumentError.validate("selections", selections.length > 0, "selections cannot be empty");

      this._selections = selections;
      this._onDidChangeTextDocumentSubscription =
        vscode.workspace.onDidChangeTextDocument(this.updateAfterDocumentChanged, this);
    }

    public addArray(array: Array) {
      (this._selections as number[]).push(...array);

      return this;
    }

    public addSelections(selections: readonly vscode.Selection[]) {
      return this.addArray(TrackedSelection.fromArray(selections, this.document));
    }

    public addSelection(selection: vscode.Selection) {
      return this.addArray(TrackedSelection.fromArray([selection], this.document));
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

      updateAfterDocumentChanged(this._selections, e.contentChanges, this.flags);

      return true;
    }

    public restore() {
      return restoreArray(this._selections, this.document);
    }

    public restoreNonEmpty() {
      return restoreNonEmpty(this._selections, this.document);
    }

    public dispose() {
      this._onDisposed.fire(this);
      this._onDisposed.dispose();
      this._onDidChangeTextDocumentSubscription.dispose();
    }
  }

  /**
   * A `TrackedSelection.Set` that displays active selections using some given
   * style.
   */
  export class StyledSet extends Set {
    private readonly _decorationType: vscode.TextEditorDecorationType;
    private readonly _onDidEditorVisibilityChangeSubscription: vscode.Disposable;

    public constructor(
      selections: Array,
      public readonly editorState: PerEditorState,
      renderOptions: vscode.DecorationRenderOptions,
    ) {
      super(
        selections, editorState.editor.document, rangeBehaviorToFlags(renderOptions.rangeBehavior));

      this._decorationType = vscode.window.createTextEditorDecorationType(renderOptions);
      this._onDidEditorVisibilityChangeSubscription = editorState.onVisibilityDidChange((e) =>
        e.isVisible && this._updateDecorations());
      this._updateDecorations();
    }

    public addArray(selections: Array) {
      super.addArray(selections);

      for (let i = 0, len = selections.length; i < len; i += 2) {
        if (selections[i] !== selections[i + 1]) {
          this._updateDecorations();
          break;
        }
      }

      return this;
    }

    protected updateAfterDocumentChanged(e: vscode.TextDocumentChangeEvent) {
      if (!super.updateAfterDocumentChanged(e)) {
        return false;
      }

      this._updateDecorations();

      return true;
    }

    public dispose() {
      super.dispose();

      this._decorationType.dispose();
      this._onDidEditorVisibilityChangeSubscription.dispose();
    }

    private _updateDecorations() {
      this.editorState.editor.setDecorations(this._decorationType, this.restoreNonEmpty());
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
