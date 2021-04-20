import * as vscode from "vscode";
import { CommandDescriptor } from "../commands";
import { noUndoStops } from "../utils/misc";
import { StatusBar } from "./status-bar";
import { Context } from "../api/context";
import { assert, CancellationError, EditorRequiredError, todo } from "../api/errors";
import { Positions } from "../api/positions";

type RecordValue = Recording.ActionType | CommandDescriptor | object | vscode.Uri | number | string;

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
      vscode.window.onDidChangeActiveTextEditor(this._recordActiveTextEditorChange, this),
      vscode.window.onDidChangeTextEditorSelection(this._recordExternalSelectionChange, this),
      vscode.workspace.onDidChangeTextDocument(this._recordExternalTextChange, this),
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
        vscode.commands.executeCommand("setContext", "dance.isRecording", false);
      } else {
        this._statusBar.recordingSegment.setContent("" + activeRecordingsCount);
      }

      const buffer = this._buffer;

      this._archiveBufferIfNeeded();

      return new Recording(buffer, offset, buffer.length - offset);
    };

    const offset = this._buffer.length,
          cancellationTokenSource = new vscode.CancellationTokenSource(),
          recording = new ActiveRecording(onRecordingCompleted, cancellationTokenSource.token),
          activeRecordingsCount = this._activeRecordingTokens.push(cancellationTokenSource);

    this._statusBar.recordingSegment.setContent("" + activeRecordingsCount);

    if (activeRecordingsCount === 1) {
      vscode.commands.executeCommand("setContext", "dance.isRecording", true);
    }

    return recording;
  }

  /**
   * Replays the action at the given index, and returns the index of the next
   * action. This index may be equal to the `length` of the buffer.
   */
  public replay(buffer: Recorder.Buffer, index: number, context: Context.WithoutActiveEditor) {
    switch (buffer[index]) {
    case Recording.ActionType.Break:
      return Promise.resolve(index + 1);

    case Recording.ActionType.Command:
      return this.replayCommand(buffer, index, context);

    case Recording.ActionType.TextEditorChange:
      return this.replayTextEditorChange(buffer, index);

    case Recording.ActionType.SelectionTranslation:
      return Promise.resolve(this.replaySelectionTranslation(buffer, index));

    case Recording.ActionType.SelectionTranslationToLineEnd:
      todo();
      break;

    case Recording.ActionType.TextReplacement:
      return this.replayTextReplacement(buffer, index);

    default:
      throw new Error("invalid recorder buffer given");
    }
  }

  /**
   * Returns the record at the given index in the given buffer.
   */
  public readRecord(buffer: Recorder.Buffer, index: number) {
    switch (buffer[index]) {
    case Recording.ActionType.Break:
      return buffer.slice(index, index + 1) as Recording.Entry<Recording.ActionType.Break>;

    case Recording.ActionType.Command:
      return buffer.slice(index, index + 3) as Recording.Entry<Recording.ActionType.Command>;

    case Recording.ActionType.TextEditorChange:
      return buffer.slice(index, index + 2) as
        Recording.Entry<Recording.ActionType.TextEditorChange>;

    case Recording.ActionType.SelectionTranslation:
      return buffer.slice(index, index + 3) as
        Recording.Entry<Recording.ActionType.SelectionTranslation>;

    case Recording.ActionType.SelectionTranslationToLineEnd:
      todo();
      break;

    case Recording.ActionType.TextReplacement:
      return buffer.slice(index, index + 3) as
        Recording.Entry<Recording.ActionType.TextReplacement>;

    default:
      throw new Error("invalid recorder buffer given");
    }
  }

  /**
   * Records the invocation of a command.
   */
  public recordCommand(descriptor: CommandDescriptor, argument: Record<string, any>) {
    this._buffer.push(Recording.ActionType.Command, descriptor, argument);
  }

  /**
   * Replays the command at the given index, and returns the index of the next
   * record in the given buffer.
   */
  public async replayCommand(
    buffer: Recorder.Buffer,
    index: number,
    context = Context.WithoutActiveEditor.current,
  ) {
    assert(buffer[index] === Recording.ActionType.Command);

    const descriptor = buffer[index + 1] as CommandDescriptor,
          argument = buffer[index + 2] as object;

    await descriptor.replay(context, argument);

    return index + 3;
  }

  /**
   * Records a change in the active text editor.
   */
  private _recordActiveTextEditorChange(e: vscode.TextEditor | undefined) {
    if (e?.document !== this._activeDocument) {
      if (e?.document === undefined) {
        this._activeDocument = undefined;
        this._lastActiveSelections = undefined;
        this._recordBreak();
      } else {
        this._activeDocument = e.document;
        this._lastActiveSelections = e.selections;
        this._buffer.push(Recording.ActionType.TextEditorChange, e.document.uri);
        this._archiveBufferIfNeeded();
      }
    }
  }

  /**
   * Replays a text editor change, and returns the index of the next record in
   * the given buffer.
   */
  public replayTextEditorChange(buffer: Recorder.Buffer, index: number) {
    assert(buffer[index] === Recording.ActionType.TextEditorChange);

    const documentUri = buffer[index + 1] as vscode.Uri;

    return vscode.window.showTextDocument(documentUri).then(() => index + 2);
  }

  /**
   * Records a change of a selection.
   */
  private _recordExternalSelectionChange(e: vscode.TextEditorSelectionChangeEvent) {
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
      return this._recordBreak();
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
        return this._tryRecordSelectionTranslationToLineEnd();
      }

      const lastActiveOffset = document.offsetAt(lastSelection.active),
            activeOffset = document.offsetAt(selection.active),
            activeOffsetDiff = activeOffset - lastActiveOffset;

      if (commonActiveOffsetDiff === Number.MAX_SAFE_INTEGER) {
        commonActiveOffsetDiff = activeOffsetDiff;
      } else if (commonActiveOffsetDiff !== activeOffsetDiff) {
        return this._tryRecordSelectionTranslationToLineEnd();
      }
    }

    this._buffer.push(
      Recording.ActionType.SelectionTranslation,
      commonAnchorOffsetDiff,
      commonActiveOffsetDiff,
    );
    this._archiveBufferIfNeeded();
  }

  private _tryRecordSelectionTranslationToLineEnd() {
    // TODO
    return this._recordBreak();
  }

  /**
   * Replays the selection translation at the given index, and returns the index
   * of the next record in the given buffer.
   */
  public replaySelectionTranslation(buffer: Recorder.Buffer, index: number) {
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

    return index + 3;
  }

  /**
   * Records a change to a document.
   */
  private _recordExternalTextChange(e: vscode.TextDocumentChangeEvent) {
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
      return this._recordBreak();
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
        return this._recordBreak();
      }

      const offsetFromActive = change.rangeOffset - document.offsetAt(lastSelections[i].active);

      if (offsetFromActive !== commonOffsetFromActive) {
        return this._recordBreak();
      }
    }

    // TODO: merge consecutive events
    this._buffer.push(
      Recording.ActionType.TextReplacement,
      commonInsertedText,
      commonDeletionLength,
      commonOffsetFromActive,
    );
    this._archiveBufferIfNeeded();
  }

  /**
   * Replays the text replacement at the given index, and returns the index of
   * the next record in the given buffer.
   */
  public replayTextReplacement(buffer: Recorder.Buffer, index: number) {
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
    }, noUndoStops).then(() => index + 4);
  }

  /**
   * Records a "break", indicating that a change that cannot be reliably
   * replayed just happened.
   */
  private _recordBreak() {
    const buffer = this._buffer;

    if (buffer.length > 0 && buffer[buffer.length - 1] !== Recording.ActionType.Break) {
      buffer.push(Recording.ActionType.Break);
      this._archiveBufferIfNeeded();
      this._activeRecordingTokens.splice(0).forEach((t) => t.dispose());
    }
  }

  /**
   * Archives the current buffer to `_previousBuffers` if its size exceeded a
   * threshold and if no recording is currently ongoing.
   */
  private _archiveBufferIfNeeded() {
    if (this._activeRecordingTokens.length > 0 || this._buffer.length < 8192) {
      return;
    }

    this._previousBuffers.push(this._buffer);
    this._buffer = [];
  }
}

export namespace Recorder {
  export type Buffer = readonly RecordValue[];

  export class Cursor {
    private _buffer: number;
    private _offset: number;

    public constructor(
      public readonly recorder: Recorder,
    ) {
      this._buffer = 0;
      this._offset = 0;
    }

    public next() {

    }
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
  private readonly _buffer: Recorder.Buffer;
  private readonly _offset: number;
  private readonly _length: number;

  public constructor(buffer: Recorder.Buffer, offset: number, length: number) {
    this._buffer = buffer;
    this._offset = offset;
    this._length = length;
  }

  public [Symbol.iterator]() {
    return new Recording.Iterator(this._buffer, this._offset + this._length, this._offset);
  }

  /**
   * Replays the recording in the given context.
   */
  public async replay(context = Context.WithoutActiveEditor.current) {
    let offset = this._offset;
    const buffer = this._buffer,
          end = offset + this._length,
          recorder = context.extension.recorder;

    while (offset < end) {
      offset = await recorder.replay(buffer, offset, context);
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
    TextEditorChange,

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
  export type Entry<T extends ActionType = ActionType> = [T, ...EntryMap[T]];

  /**
   * Type map from entry type to entry values.
   */
  export interface EntryMap {
    readonly [ActionType.Break]: readonly [];
    readonly [ActionType.Command]: readonly [command: CommandDescriptor, argument: object];
    readonly [ActionType.SelectionTranslation]: readonly [anchorDiff: number, activeDiff: number];
    readonly [ActionType.SelectionTranslationToLineEnd]: readonly [];
    readonly [ActionType.TextEditorChange]: readonly [uri: vscode.Uri];
    readonly [ActionType.TextReplacement]:
      readonly [insertedText: string, deletionLength: number, offsetFromActive: number];
  }

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
