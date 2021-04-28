import * as vscode from "vscode";
import { CommandDescriptor } from "../commands";
import { noUndoStops } from "../utils/misc";
import { StatusBar } from "./status-bar";
import { Context } from "../api/context";
import { assert, CancellationError, EditorRequiredError, todo } from "../api/errors";
import { Positions } from "../api/positions";

type RecordValue = Recording.ActionType | CommandDescriptor | object | vscode.Uri | number | string;

const enum Constants {
  NextMask = 0xff,
  PrevShift = 8,
}

/**
 * A class used to record actions as they happen.
 */
export class Recorder implements vscode.Disposable {
  private readonly _previousBuffers: Recorder.Buffer[] = [];
  private readonly _subscriptions: vscode.Disposable[] = [];

  private _activeDocument: vscode.TextDocument | undefined;
  private _buffer: RecordValue[] = [0];
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
   * Starts a record, saving its identifier to the current buffer.
   */
  private _startRecord(type: Recording.ActionType) {
    (this._buffer[this._buffer.length - 1] as Recording.ActionType) |= type;
  }

  /**
   * Ends a record, saving its identifier to the current buffer.
   */
  private _endRecord(type: Recording.ActionType) {
    this._buffer.push(type << Constants.PrevShift);
    this._archiveBufferIfNeeded();
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

  /**
   * Returns the number of available buffers.
   */
  public get bufferCount() {
    return this._previousBuffers.length + 1;
  }

  /**
   * Returns the buffer at the given index, if any.
   */
  public getBuffer(index: number) {
    return index === this._previousBuffers.length ? this._buffer : this._previousBuffers[index];
  }

  /**
   * Returns a `Cursor` starting at the start of the recorder.
   */
  public cursorFromStart() {
    return new Recorder.Cursor(this, 0, 0);
  }

  /**
   * Returns a `Cursor` starting at the end of the recorder at the time of the
   * call.
   */
  public cursorFromEnd() {
    return new Recorder.Cursor(this, this._previousBuffers.length, this._buffer.length - 1);
  }

  /**
   * Returns a `Cursor` starting at the start of the specified recording.
   */
  public fromRecordingStart(recording: Recording) {
    let bufferIdx = this._previousBuffers.indexOf(recording.buffer);

    if (bufferIdx === -1) {
      assert(recording.buffer === this._buffer);

      bufferIdx = this._previousBuffers.length;
    }

    return new Recorder.Cursor(this, bufferIdx, recording.offset);
  }

  /**
   * Returns a `Cursor` starting at the end of the specified recording.
   */
  public fromRecordingEnd(recording: Recording) {
    let bufferIdx = this._previousBuffers.indexOf(recording.buffer);

    if (bufferIdx === -1) {
      assert(recording.buffer === this._buffer);

      bufferIdx = this._previousBuffers.length;
    }

    return new Recorder.Cursor(this, bufferIdx, recording.offset + recording.length);
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

    const offset = this._buffer.length - 1,
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
    switch ((buffer[index] as number) & Constants.NextMask) {
    case Recording.ActionType.Break:
      return Promise.resolve(index + 1);

    case Recording.ActionType.Command:
      return this.replayCommand(buffer, index, context);

    case Recording.ActionType.ExternalCommand:
      return this.replayExternalCommand(buffer, index);

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
    switch ((buffer[index] as number) & Constants.NextMask) {
    case Recording.ActionType.Break:
      return buffer.slice(index, index + 1) as Recording.Entry<Recording.ActionType.Break>;

    case Recording.ActionType.Command:
      return buffer.slice(index, index + 3) as Recording.Entry<Recording.ActionType.Command>;

    case Recording.ActionType.ExternalCommand:
      return buffer.slice(index, index + 3) as
        Recording.Entry<Recording.ActionType.ExternalCommand>;

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
    this._startRecord(Recording.ActionType.Command);
    this._buffer.push(descriptor, argument);
    this._endRecord(Recording.ActionType.Command);
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
    assert(((buffer[index] as number) & Constants.NextMask) === Recording.ActionType.Command);

    const descriptor = buffer[index + 1] as CommandDescriptor,
          argument = buffer[index + 2] as object;

    if ((descriptor.flags & CommandDescriptor.Flags.DoNotReplay) === 0) {
      await descriptor.replay(context, argument);
    }

    return index + 3;
  }

  /**
   * Records the invocation of an external (non-Dance) command.
   */
  public recordExternalCommand(identifier: string, argument: Record<string, any>) {
    this._startRecord(Recording.ActionType.ExternalCommand);
    this._buffer.push(identifier, argument);
    this._endRecord(Recording.ActionType.ExternalCommand);
  }

  /**
   * Replays the command at the given index, and returns the index of the next
   * record in the given buffer.
   */
  public replayExternalCommand(buffer: Recorder.Buffer, index: number) {
    assert(
      ((buffer[index] as number) & Constants.NextMask) === Recording.ActionType.ExternalCommand);

    const descriptor = buffer[index + 1] as string,
          argument = buffer[index + 2] as object;

    return vscode.commands.executeCommand(descriptor, argument).then(() => index + 3);
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
        this._startRecord(Recording.ActionType.TextEditorChange);
        this._buffer.push(e.document.uri);
        this._endRecord(Recording.ActionType.TextEditorChange);
      }
    }
  }

  /**
   * Replays a text editor change, and returns the index of the next record in
   * the given buffer.
   */
  public replayTextEditorChange(buffer: Recorder.Buffer, index: number) {
    assert(
      ((buffer[index] as number) & Constants.NextMask) === Recording.ActionType.TextEditorChange);

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

    // Issue: Command is executing but not in a context, so we log selection changes which is bad
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

    // Merge consecutive events, if any.
    if (this._tryMergeSelectionTranslations(commonAnchorOffsetDiff, commonActiveOffsetDiff)) {
      return;
    }

    this._startRecord(Recording.ActionType.SelectionTranslation);
    this._buffer.push(commonAnchorOffsetDiff, commonActiveOffsetDiff);
    this._endRecord(Recording.ActionType.SelectionTranslation);
  }

  private _tryMergeSelectionTranslations(anchorOffsetDiff2: number, activeOffsetDiff2: number) {
    if (anchorOffsetDiff2 !== activeOffsetDiff2) {
      return false;
    }

    const cursor = this.cursorFromEnd();

    // "Text change 1 -> selection change 1 -> text change 2 -> selection
    // change 2" can be merged into "text change 3 -> selection change 3".
    if (!cursor.previous()
        || !cursor.is(Recording.ActionType.TextReplacement)
        || cursor.offsetFromActive() !== 0) {
      return false;
    }

    const insertedText2 = cursor.insertedText(),
          deletionLength2 = cursor.deletionLength();

    if (insertedText2.length !== activeOffsetDiff2 || deletionLength2 !== 0) {
      return false;
    }

    if (!cursor.previous() || !cursor.is(Recording.ActionType.SelectionTranslation)) {
      return false;
    }

    const anchorOffsetDiff1 = cursor.anchorOffsetDiff(),
          activeOffsetDiff1 = cursor.activeOffsetDiff();

    if (anchorOffsetDiff1 !== activeOffsetDiff1) {
      return false;
    }

    if (!cursor.previous()
        || !cursor.is(Recording.ActionType.TextReplacement)
        || cursor.offsetFromActive() !== 0) {
      return false;
    }

    const insertedText1 = cursor.insertedText();

    if (insertedText1.length !== activeOffsetDiff1) {
      return false;
    }

    // This is a match! Update "text change 1 -> selection change 1".
    (cursor.buffer as Recorder.MutableBuffer)[cursor.offset + 1] = insertedText1 + insertedText2;

    assert(cursor.next() && cursor.is(Recording.ActionType.SelectionTranslation));

    const totalDiff = anchorOffsetDiff1 + anchorOffsetDiff2;

    (cursor.buffer as Recorder.MutableBuffer)[cursor.offset + 1] = totalDiff;
    (cursor.buffer as Recorder.MutableBuffer)[cursor.offset + 2] = totalDiff;

    // Finally, delete the last entry corresponding to "text change 2" (since
    // "selection change 2" hasn't been written yet).
    assert(cursor.next() && cursor.is(Recording.ActionType.TextReplacement));

    (cursor.buffer as Recorder.MutableBuffer).splice(cursor.offset);
    this._endRecord(Recording.ActionType.SelectionTranslation);

    return true;
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
    assert(((buffer[index] as number) & Constants.NextMask)
           === Recording.ActionType.SelectionTranslation);

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

    // Merge consecutive events, if any.
    const cursor = this.cursorFromEnd();

    if (cursor.previousType() === Recording.ActionType.TextReplacement) {
      // If there has been no selection change in the meantime, the text we're
      // inserting now is at the start of the text we previously inserted.
      const offset = cursor.previousOffset!,
            previousOffsetFromActive = this._buffer[offset + 3];

      if (commonOffsetFromActive === previousOffsetFromActive) {
        this._buffer[offset + 1] = commonInsertedText + (this._buffer[offset + 1] as string);
        this._buffer[offset + 2] = commonDeletionLength + (this._buffer[offset + 2] as number);

        return;
      }
    }

    this._startRecord(Recording.ActionType.TextReplacement);
    this._buffer.push(commonInsertedText, commonDeletionLength, commonOffsetFromActive);
    this._endRecord(Recording.ActionType.TextReplacement);
  }

  /**
   * Replays the text replacement at the given index, and returns the index of
   * the next record in the given buffer.
   */
  public replayTextReplacement(buffer: Recorder.Buffer, index: number) {
    assert(
      ((buffer[index] as number) & Constants.NextMask) === Recording.ActionType.TextReplacement);

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
      this._startRecord(Recording.ActionType.Break);
      this._endRecord(Recording.ActionType.Break);
      this._activeRecordingTokens.splice(0).forEach((t) => t.dispose());
    }
  }
}

export namespace Recorder {
  /**
   * A buffer of `Recorder` values.
   */
  export type Buffer = readonly RecordValue[];

  /**
   * The mutable version of `Buffer`.
   */
  export type MutableBuffer = RecordValue[];

  /**
   * A cursor used to enumerate records in a `Recorder` or `Recording`.
   */
  export class Cursor<T extends Recording.ActionType = Recording.ActionType> {
    private _buffer: Buffer;
    private _bufferIdx: number;
    private _offset: number;

    public constructor(
      /**
       * The recorder from which records are read.
       */
      public readonly recorder: Recorder,

      buffer: number,
      offset: number,
    ) {
      this._buffer = recorder.getBuffer(buffer);
      this._bufferIdx = buffer;
      this._offset = offset;
    }

    /**
     * Returns the buffer storing the current record.
     */
    public get buffer() {
      return this._buffer;
    }

    /**
     * Returns the offset of the current record in its buffer.
     */
    public get offset() {
      return this._offset;
    }

    /**
     * Returns the offset of the previous record in its buffer, or `undefined`
     * if the current record is the first of its buffer.
     */
    public get previousOffset() {
      return this._offset === 0
        ? undefined
        : this._offset - Recording.entrySize[this.previousType()] - 1;
    }

    /**
     * Returns a different instance of a `Cursor` that points to the same
     * record.
     */
    public clone() {
      return new Cursor<T>(this.recorder, this._bufferIdx, this._offset);
    }

    /**
     * Returns whether the current cursor is before or equal to the given
     * cursor.
     */
    public isBeforeOrEqual(other: Cursor) {
      return this._bufferIdx < other._bufferIdx
          || (this._bufferIdx === other._bufferIdx && this._offset <= other._offset);
    }

    /**
     * Returns whether the current cursor is after or equal to the given
     * cursor.
     */
    public isAfterOrEqual(other: Cursor) {
      return this._bufferIdx > other._bufferIdx
          || (this._bufferIdx === other._bufferIdx && this._offset >= other._offset);
    }

    /**
     * Replays the record pointed at by the cursor.
     */
    public replay(context: Context.WithoutActiveEditor) {
      return this.recorder.replay(this._buffer, this._offset, context);
    }

    /**
     * Returns the type of the current record.
     */
    public type() {
      return ((this._buffer[this._offset] as number) & Constants.NextMask) as T;
    }

    /**
     * Returns the type of the previous record.
     */
    public previousType() {
      return (this._buffer[this._offset] as number >> Constants.PrevShift) as Recording.ActionType;
    }

    /**
     * Returns whether the cursor points to a record of the given type.
     */
    public is<T extends Recording.ActionType>(type: T): this is Cursor<T> {
      return this.type() as Recording.ActionType === type;
    }

    public commandDescriptor(): T extends Recording.ActionType.Command ? CommandDescriptor : never {
      return this._buffer[this._offset + 1] as CommandDescriptor as any;
    }

    public commandArgument(): T extends Recording.ActionType.Command ? Record<string, any> : never {
      return this._buffer[this._offset + 2] as object as any;
    }

    public insertedText(): T extends Recording.ActionType.TextReplacement ? string : never {
      return this._buffer[this._offset + 1] as string as any;
    }

    public deletionLength(): T extends Recording.ActionType.TextReplacement ? number : never {
      return this._buffer[this._offset + 2] as number as any;
    }

    public offsetFromActive(): T extends Recording.ActionType.TextReplacement ? number : never {
      return this._buffer[this._offset + 3] as number as any;
    }

    public anchorOffsetDiff(
    ): T extends Recording.ActionType.SelectionTranslation ? number : never {
      return this._buffer[this._offset + 1] as number as any;
    }

    public activeOffsetDiff(
    ): T extends Recording.ActionType.SelectionTranslation ? number : never {
      return this._buffer[this._offset + 2] as number as any;
    }

    /**
     * Switches to the next record, and returns `true` if the operation
     * succeeded or `false` if the current record is the last one available.
     */
    public next(): this is Cursor<Recording.ActionType> {
      if (this._offset === this._buffer.length - 1) {
        if (this._bufferIdx === this.recorder.bufferCount) {
          return false;
        }

        this._bufferIdx++;
        this._buffer = this.recorder.getBuffer(this._bufferIdx);
        this._offset = 0;

        return true;
      }

      this._offset += Recording.entrySize[this.type()] + 1;
      return true;
    }

    /**
     * Switches to the previous record, and returns `true` if the operation
     * succeeded or `false` if the current record is the first one available.
     */
    public previous(): this is Cursor<Recording.ActionType> {
      if (this._offset === 0) {
        if (this._bufferIdx === 0) {
          return false;
        }

        this._bufferIdx--;
        this._buffer = this.recorder.getBuffer(this._bufferIdx);
        this._offset = this._buffer.length - 1;

        return true;
      }

      this._offset -= Recording.entrySize[this.previousType()] + 1;
      return true;
    }

    /**
     * Returns whether the record pointed at by the cursor is included in the
     * specified recording.
     */
    public isInRecording(recording: Recording) {
      return recording.offset <= this._offset && this._offset < recording.offset + recording.length
          && recording.buffer === this._buffer;
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
export class Recording {
  public readonly buffer: Recorder.Buffer;
  public readonly offset: number;
  public readonly length: number;

  public constructor(buffer: Recorder.Buffer, offset: number, length: number) {
    this.buffer = buffer;
    this.offset = offset;
    this.length = length;
  }

  /**
   * Replays the recording in the given context.
   */
  public async replay(context = Context.WithoutActiveEditor.current) {
    let offset = this.offset;
    const buffer = this.buffer,
          end = offset + this.length,
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
     * An external command invocation.
     */
    ExternalCommand,

    /**
     * A translation of all selections.
     */
    SelectionTranslation,

    /**
     * A translation of all selections to the end of a line.
     */
    SelectionTranslationToLineEnd,

    /**
     * An active text editor change.
     */
    TextEditorChange,

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
    readonly [ActionType.ExternalCommand]: readonly [identifier: string, argument: object];
    readonly [ActionType.SelectionTranslation]: readonly [anchorDiff: number, activeDiff: number];
    readonly [ActionType.SelectionTranslationToLineEnd]: readonly [];
    readonly [ActionType.TextEditorChange]: readonly [uri: vscode.Uri];
    readonly [ActionType.TextReplacement]:
      readonly [insertedText: string, deletionLength: number, offsetFromActive: number];
  }

  /**
   * Maps an entry type to the size of its tuple in `EntryMap`.
   */
  export const entrySize: {
    readonly [K in keyof EntryMap]: EntryMap[K]["length"];
  } = [0, 2, 2, 2, 0, 1, 3];
}
