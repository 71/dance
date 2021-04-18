import * as vscode from "vscode";
import { CommandDescriptor } from "../commands";
import { noUndoStops } from "../utils/misc";
import { StatusBar } from "./status-bar";
import { Context } from "../api/context";
import { assert, CancellationError, EditorRequiredError, todo } from "../api/errors";
import { Positions } from "../api/positions";

type RecordValue = Recording.ActionType | CommandDescriptor | object | WeakRef<vscode.TextDocument>
                 | number | string;

/**
 * A class used to record actions as they happen.
 */
export class Recorder implements vscode.Disposable {
  private readonly _previousBuffers: (readonly RecordValue[])[] = [];
  private readonly _subscriptions: vscode.Disposable[] = [];

  private _activeDocument: vscode.TextDocument | undefined;
  private _buffer: RecordValue[] = [];
  private _lastActiveSelections: readonly vscode.Selection[] | undefined;
  private _activeRecordingTokens: vscode.Disposable[] = [];

  public constructor(
    private readonly _statusBar: StatusBar,
  ) {
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor !== undefined) {
      this._activeDocument = activeEditor.document;
      this._lastActiveSelections = activeEditor.selections;
    }

    this._subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(this.recordActiveTextEditorChange, this),
      vscode.window.onDidChangeTextEditorSelection(this.recordExternalSelectionChange, this),
      vscode.workspace.onDidChangeTextDocument(this.recordExternalTextChange, this),
    );
  }

  public dispose() {
    this._activeRecordingTokens.splice(0).forEach((d) => d.dispose());
    this._subscriptions.splice(0).forEach((d) => d.dispose());
  }

  /**
   * Starts recording a series of actions.
   */
  public startRecording() {
    const onRecordingCompleted = () => {
      const index = this._activeRecordingTokens.indexOf(cancellationTokenSource);

      if (index === -1) {
        throw new Error("recording has already been marked as completed");
      }

      this._activeRecordingTokens.splice(index, 1);
      cancellationTokenSource.dispose();

      const activeRecordingsCount = this._activeRecordingTokens.length;

      if (activeRecordingsCount === 0) {
        this._statusBar.recordingSegment.setContent();
        vscode.commands.executeCommand("setContext", "dance.recording", false);
      } else {
        this._statusBar.recordingSegment.setContent("" + activeRecordingsCount);
      }

      const buffer = this._buffer;

      this.archiveBufferIfNeeded();

      return new Recording(buffer, offset, buffer.length - offset);
    };

    const offset = this._buffer.length,
          cancellationTokenSource = new vscode.CancellationTokenSource(),
          recording = new ActiveRecording(onRecordingCompleted, cancellationTokenSource.token),
          activeRecordingsCount = this._activeRecordingTokens.push(cancellationTokenSource);

    this._statusBar.recordingSegment.setContent("" + activeRecordingsCount);

    if (activeRecordingsCount === 1) {
      vscode.commands.executeCommand("setContext", "dance.recording", true);
    }

    return recording;
  }

  /**
   * Records the invocation of a command.
   */
  public recordCommand(descriptor: CommandDescriptor, argument: Record<string, any>) {
    this._buffer.push(Recording.ActionType.Command, descriptor, argument);
  }

  /**
   * Records a change in the active text editor.
   */
  private recordActiveTextEditorChange(e: vscode.TextEditor | undefined) {
    if (e?.document !== this._activeDocument) {
      if (e?.document === undefined) {
        this._activeDocument = undefined;
        this._lastActiveSelections = undefined;
        this.recordBreak();
      } else {
        this._activeDocument = e.document;
        this._lastActiveSelections = e.selections;
        this._buffer.push(Recording.ActionType.EditorChange, new WeakRef(e.document));
        this.archiveBufferIfNeeded();
      }
    }
  }

  /**
   * Records a change of a selection.
   */
  private recordExternalSelectionChange(e: vscode.TextEditorSelectionChangeEvent) {
    if (vscode.window.activeTextEditor !== e.textEditor) {
      return;
    }

    const lastSelections = this._lastActiveSelections,
          selections = e.selections;
    this._lastActiveSelections = selections;

    if (Context.WithoutActiveEditor.currentOrUndefined !== undefined
        || lastSelections === undefined) {
      return;
    }

    if (lastSelections.length !== selections.length
        || e.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
      return this.recordBreak();
    }

    // TODO: be able to record jumps to end of line with a line offset
    const document = e.textEditor.document;
    let commonAnchorOffsetDiff = Number.MAX_SAFE_INTEGER,
        commonActiveOffsetDiff = Number.MAX_SAFE_INTEGER;

    for (let i = 0, len = selections.length; i < len; i++) {
      const lastSelection = lastSelections[i],
            selection = selections[i];

      const lastAnchorOffset = document.offsetAt(lastSelection.active),
            anchorOffset = document.offsetAt(selection.active),
            anchorOffsetDiff = anchorOffset - lastAnchorOffset;

      if (commonAnchorOffsetDiff === Number.MAX_SAFE_INTEGER) {
        commonAnchorOffsetDiff = anchorOffsetDiff;
      } else if (commonAnchorOffsetDiff !== anchorOffsetDiff) {
        return this.tryRecordSelectionTranslationToLineEnd();
      }

      const lastActiveOffset = document.offsetAt(lastSelection.active),
            activeOffset = document.offsetAt(selection.active),
            activeOffsetDiff = activeOffset - lastActiveOffset;

      if (commonActiveOffsetDiff === Number.MAX_SAFE_INTEGER) {
        commonActiveOffsetDiff = activeOffsetDiff;
      } else if (commonActiveOffsetDiff !== activeOffsetDiff) {
        return this.tryRecordSelectionTranslationToLineEnd();
      }
    }

    this._buffer.push(
      Recording.ActionType.SelectionTranslation,
      commonAnchorOffsetDiff,
      commonActiveOffsetDiff,
    );
    this.archiveBufferIfNeeded();
  }

  private tryRecordSelectionTranslationToLineEnd() {
    // TODO
    return this.recordBreak();
  }

  public replaySelectionTranslation(buffer: readonly RecordValue[], index: number) {
    assert(buffer[index] === Recording.ActionType.SelectionTranslation);

    const anchorOffsetDiff = buffer[index + 1] as number,
          activeOffsetDiff = buffer[index + 2] as number;

    const editor = vscode.window.activeTextEditor;

    EditorRequiredError.throwUnlessAvailable(editor);

    const document = editor.document,
          newSelections = [] as vscode.Selection[];

    for (const selection of editor.selections) {
      const newAnchor = Positions.offset.orEdge(selection.anchor, anchorOffsetDiff, document),
            newActive = Positions.offset.orEdge(selection.active, activeOffsetDiff, document);

      newSelections.push(new vscode.Selection(newAnchor, newActive));
    }

    editor.selections = newSelections;
  }

  /**
   * Records a change to a document.
   */
  private recordExternalTextChange(e: vscode.TextDocumentChangeEvent) {
    const editor = vscode.window.activeTextEditor;

    if (editor?.document !== e.document) {
      return;
    }

    const lastSelections = this._lastActiveSelections,
          selections = editor.selections;
    this._lastActiveSelections = selections;

    if (Context.WithoutActiveEditor.currentOrUndefined !== undefined
        || lastSelections === undefined || e.contentChanges.length === 0) {
      return;
    }

    if (lastSelections.length !== e.contentChanges.length) {
      return this.recordBreak();
    }

    const document = e.document,
          firstChange = e.contentChanges[0],
          firstSelection = lastSelections[0],
          commonInsertedText = firstChange.text,
          commonDeletionLength = firstChange.rangeLength,
          commonOffsetFromActive =
            firstChange.rangeOffset - document.offsetAt(firstSelection.active);

    for (let i = 1, len = lastSelections.length; i < len; i++) {
      const change = e.contentChanges[i];

      if (change.text !== commonInsertedText || change.rangeLength !== commonDeletionLength) {
        return this.recordBreak();
      }

      const offsetFromActive = change.rangeOffset - document.offsetAt(lastSelections[i].active);

      if (offsetFromActive !== commonOffsetFromActive) {
        return this.recordBreak();
      }
    }

    // TODO: merge consecutive events
    this._buffer.push(
      Recording.ActionType.TextReplacement,
      commonInsertedText,
      commonDeletionLength,
      commonOffsetFromActive,
    );
    this.archiveBufferIfNeeded();
  }

  public replayTextReplacement(buffer: readonly RecordValue[], index: number) {
    assert(buffer[index] === Recording.ActionType.TextReplacement);

    const insertedText = buffer[index + 1] as string,
          deletionLength = buffer[index + 2] as number,
          offsetFromActive = buffer[index + 3] as number;

    const editor = vscode.window.activeTextEditor;

    EditorRequiredError.throwUnlessAvailable(editor);

    return editor.edit((editBuilder) => {
      const document = editor.document;

      for (const selection of editor.selections) {
        const rangeStart = Positions.offset(selection.active, offsetFromActive, document);
        assert(rangeStart !== undefined);
        const rangeEnd = Positions.offset(rangeStart, deletionLength, document);
        assert(rangeEnd !== undefined);

        editBuilder.replace(new vscode.Range(rangeStart, rangeEnd), insertedText);
      }
    }, noUndoStops);
  }

  /**
   * Records a "break", indicating that a change that cannot be reliably
   * replayed just happened.
   */
  private recordBreak() {
    const buffer = this._buffer;

    if (buffer.length > 0 && buffer[buffer.length - 1] !== Recording.ActionType.Break) {
      buffer.push(Recording.ActionType.Break);
      this.archiveBufferIfNeeded();
      this._activeRecordingTokens.splice(0).forEach((t) => t.dispose());
    }
  }

  /**
   * Archives the current buffer to `_previousBuffers` if its size exceeded a
   * threshold and if no recording is currently ongoing.
   */
  private archiveBufferIfNeeded() {
    if (this._activeRecordingTokens.length > 0 || this._buffer.length < 8192) {
      return;
    }

    this._previousBuffers.push(this._buffer);
    this._buffer = [];
  }
}

/**
 * An ongoing `Recording`.
 */
export class ActiveRecording {
  public constructor(
    private readonly _notifyCompleted: () => Recording,

    /**
     * A cancellation token that will be cancelled if the recording is forcibly
     * stopped due to an unknown change.
     */
    public readonly cancellationToken: vscode.CancellationToken,
  ) {}

  public complete() {
    CancellationError.throwIfCancellationRequested(this.cancellationToken);

    return this._notifyCompleted();
  }
}

/**
 * A recording of actions performed in VS Code.
 */
export class Recording implements Iterable<Recording.Entry> {
  private readonly _buffer: readonly RecordValue[];
  private readonly _offset: number;
  private readonly _length: number;

  public constructor(buffer: readonly RecordValue[], offset: number, length: number) {
    this._buffer = buffer;
    this._offset = offset;
    this._length = length;
  }

  public [Symbol.iterator]() {
    return new Recording.Iterator(this._buffer, this._offset + this._length, this._offset);
  }

  /**
   * Replays the recording in the current context.
   */
  public replay(context: Context.WithoutActiveEditor) {
    for (const action of this) {
      switch (action[0]) {
      case Recording.ActionType.Command:
        action[1].replay(context, action[2]);
        break;

      case Recording.ActionType.SelectionTranslation:
        break;
      }
    }
  }
}

export namespace Recording {
  /**
   * The type of a recorded action.
   */
  export const enum ActionType {
    /**
     * An action that cannot be reliably replayed and that interrupts a
     * recording.
     */
    Break,

    /**
     * An internal command invocation.
     */
    Command,

    /**
     * An active text editor change.
     */
    EditorChange,

    /**
     * A translation of all selections.
     */
    SelectionTranslation,

    /**
     * A translation of all selections to the end of a line.
     */
    SelectionTranslationToLineEnd,

    /**
     * A replacement of text near all selections.
     */
    TextReplacement,
  }

  /**
   * A recorded action.
   */
  export type Entry
    = readonly [t: ActionType.Break]
    | readonly [t: ActionType.Command, command: CommandDescriptor, argument: object]
    | readonly [t: ActionType.EditorChange, newDocument: WeakRef<vscode.TextDocument>]
    | readonly [t: ActionType.SelectionTranslation]
  ;

  /**
   * An iterator over the actions in a `Recording`.
   */
  export class Iterator implements IterableIterator<Entry> {
    private readonly _buffer: readonly RecordValue[];
    private readonly _end: number;
    private _offset: number;

    public constructor(buffer: readonly RecordValue[], end: number, offset: number) {
      this._buffer = buffer;
      this._end = end;
      this._offset = offset;
    }

    public next() {
      const offset = this._offset,
            end = this._end;

      if (offset === end) {
        return { done: true } as IteratorReturnResult<void>;
      }

      const buffer = this._buffer,
            type = buffer[offset] as unknown as Recording.ActionType;

      if (type === Recording.ActionType.Command) {
        const command = buffer[offset + 1] as CommandDescriptor,
              argument = buffer[offset + 2] as object,
              value = [Recording.ActionType.Command, command, argument] as const;

        this._offset = offset + 3;

        return { done: false, value } as IteratorYieldResult<Entry>;
      }

      if (type === Recording.ActionType.SelectionTranslation) {
        const value = [Recording.ActionType.SelectionTranslation] as const;

        this._offset = offset + 1;

        return { done: false, value } as IteratorYieldResult<Entry>;
      }

      if (type === todo()) {
        const value = [todo()] as const;

        this._offset = offset + 1;

        return { done: false, value } as IteratorYieldResult<Entry>;
      }

      assert(false);
    }

    public [Symbol.iterator]() {
      return new Iterator(this._buffer, this._end, this._offset);
    }
  }
}
