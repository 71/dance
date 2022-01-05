import * as vscode from "vscode";

import type { PerEditorState } from "./editors";
import type { Extension } from "./extension";
import type { Mode } from "./modes";
import type { StatusBar } from "./status-bar";
import { Context, Positions, Selections } from "../api";
import { CommandDescriptor } from "../commands";
import { assert, CancellationError } from "../utils/errors";
import { noUndoStops } from "../utils/misc";

type RecordValue = CommandDescriptor | object | vscode.Uri | number | string;

const enum Constants {
  NextMask = 0xff,
  PrevShift = 8,
}

type IntArray<E extends BaseEntry<any>> = E extends BaseEntry<infer I>
  ? { readonly [K in keyof I]: I[K] extends undefined ? never : number; }
    & { readonly length: number; }
  : never;

/**
 * A class used to record actions as they happen.
 */
export class Recorder implements vscode.Disposable {
  private readonly _descriptors: readonly CommandDescriptor[];
  private readonly _onDidAddEntry = new vscode.EventEmitter<Entry.Any>();
  private readonly _previousBuffers: Recorder.Buffer[] = [];
  private readonly _storedObjects: (object | string)[] = [];
  private readonly _storedObjectsMap = new Map<object | string, number>();
  private readonly _statusBar: StatusBar;
  private readonly _subscriptions: vscode.Disposable[] = [];

  private _activeDocument: vscode.TextDocument | undefined;
  private _buffer: Recorder.MutableBuffer = [0];
  private _lastActiveSelections: readonly vscode.Selection[] | undefined;
  private _activeRecordingTokens: vscode.Disposable[] = [];
  private _expectedSelectionTranslation?: number;

  public get onDidAddEntry() {
    return this._onDidAddEntry.event;
  }

  /**
   * {@link Entry} is re-exported here since it defines important values, and
   * cannot be imported directly from API functions.
   */
  public get Entry() {
    return Entry;
  }

  public constructor(
    extension: Extension,
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
      extension.editors.onModeDidChange(this._recordActiveTextEditorModeChange, this),
    );

    this._statusBar = extension.statusBar;
    this._descriptors = Object.values(extension.commands);
  }

  public dispose() {
    this._activeRecordingTokens.splice(0).forEach((d) => d.dispose());
    this._subscriptions.splice(0).forEach((d) => d.dispose());
  }

  /**
   * Returns the last 100 entries of the recorder, for debugging purposes.
   */
  private get debugBuffer() {
    return this.lastEntries(100);
  }

  /**
   * Returns the last `n` entries.
   */
  public lastEntries(n: number) {
    const entries: Entry.Any[] = [],
          cursor = this.cursorFromEnd();

    for (let i = 0; i < n && cursor.previous(); i++) {
      entries.push(cursor.entry());
    }

    return entries.reverse();
  }

  /**
   * Returns the last entry.
   */
  public lastEntry() {
    const cursor = this.cursorFromEnd();

    if (!cursor.previous()) {
      return undefined;
    }

    return cursor.entry();
  }

  /**
   * Records an action to the current buffer.
   */
  private _record<E extends Entry.Any>(
    type: (new (...args: any) => E) & { readonly id: number },
    ...args: IntArray<E>
  ) {
    this._buffer[this._buffer.length - 1] |= type.id;
    this._buffer.push(...(args as unknown as number[]), type.id << Constants.PrevShift);
    this._archiveBufferIfNeeded();

    this._onDidAddEntry.fire(this.lastEntry()!);
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

  private _storeObject<T extends object | string>(value: T) {
    let i = this._storedObjectsMap.get(value);

    if (i === undefined) {
      this._storedObjectsMap.set(value, i = this._storedObjects.push(value) - 1);
    }

    return i;
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
   * Returns the stored object at the given index.
   */
  public getObject<T extends object>(index: number) {
    return this._storedObjects[index] as T;
  }

  /**
   * Returns the stored string at the given index.
   */
  public getString(index: number) {
    return this._storedObjects[index] as string;
  }

  /**
   * Returns the command descriptor at the given index.
   */
  public getDescriptor(index: number) {
    return this._descriptors[index];
  }

  /**
   * Returns the entry at the given index.
   */
  public entry(buffer: Recorder.Buffer, index: number) {
    const entryId = (buffer[index] & Constants.NextMask) as Entry.Identifier;

    return Entry.instantiate(entryId, this, buffer, index);
  }

  /**
   * Returns a `Cursor` starting at the start of the recorder.
   */
  public cursorFromStart() {
    return new Cursor(this, 0, 0);
  }

  /**
   * Returns a `Cursor` starting at the end of the recorder at the time of the
   * call.
   */
  public cursorFromEnd() {
    return new Cursor(this, this._previousBuffers.length, this._buffer.length - 1);
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

    return new Cursor(this, bufferIdx, recording.offset);
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

    return new Cursor(this, bufferIdx, recording.offset + recording.length);
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

      return new Recording(buffer, offset, buffer.length - offset - 1);
    };

    this._recordBreak();

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
   * Records a "break", indicating that a change that cannot be reliably
   * replayed just happened.
   */
  private _recordBreak() {
    const buffer = this._buffer;

    if (buffer.length > 0 && buffer[buffer.length - 1] !== Entry.Break.id) {
      this._record(Entry.Break);
      this._activeRecordingTokens.splice(0).forEach((t) => t.dispose());
    }

    this._expectedSelectionTranslation = undefined;
  }

  /**
   * Records a change in the active text editor.
   */
  private _recordActiveTextEditorChange(e: vscode.TextEditor | undefined) {
    this._expectedSelectionTranslation = undefined;

    if (e?.document !== this._activeDocument) {
      if (e?.document === undefined) {
        this._activeDocument = undefined;
        this._lastActiveSelections = undefined;
        this._recordBreak();
      } else {
        this._activeDocument = e.document;
        this._lastActiveSelections = e.selections;
        this._record(Entry.ChangeTextEditor, this._storeObject(e.document.uri));
      }
    }
  }

  /**
   * Records a change in the mode of the active text editor.
   */
  private _recordActiveTextEditorModeChange(e: PerEditorState) {
    if (e.editor.document !== this._activeDocument) {
      return;
    }

    this._record(Entry.ChangeTextEditorMode, this._storeObject(e.mode));
  }

  /**
   * Records the invocation of a command.
   */
  public recordCommand(descriptor: CommandDescriptor, argument: Record<string, any>) {
    const descriptorIndex = this._descriptors.indexOf(descriptor),
          argumentIndex = this._storeObject(argument);

    this._record(Entry.ExecuteCommand, descriptorIndex, argumentIndex);
  }

  /**
   * Records the invocation of an external (non-Dance) command.
   */
  public recordExternalCommand(identifier: string, argument: Record<string, any>) {
    const identifierIndex = this._storeObject(identifier),
          argumentIndex = this._storeObject(argument);

    this._record(Entry.ExecuteExternalCommand, identifierIndex, argumentIndex);
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
      // Selection change is internal.
      return;
    }

    if (lastSelections.length !== selections.length
        || e.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
      // Selection change is not supported.
      return this._recordBreak();
    }

    // Determine translations.
    const document = e.textEditor.document;
    let commonAnchorOffsetDiff = Number.MAX_SAFE_INTEGER,
        commonActiveOffsetDiff = Number.MAX_SAFE_INTEGER;

    for (let i = 0, len = selections.length; i < len; i++) {
      const lastSelection = lastSelections[i],
            selection = selections[i];

      let anchorOffsetDiff: number;

      if (lastSelection.anchor.line === selection.anchor.line) {
        anchorOffsetDiff = selection.anchor.character - lastSelection.anchor.character;
      } else {
        const lastAnchorOffset = document.offsetAt(lastSelection.anchor),
              anchorOffset = document.offsetAt(selection.anchor);

        anchorOffsetDiff = anchorOffset - lastAnchorOffset;
      }

      if (commonAnchorOffsetDiff === Number.MAX_SAFE_INTEGER) {
        commonAnchorOffsetDiff = anchorOffsetDiff;
      } else if (commonAnchorOffsetDiff !== anchorOffsetDiff) {
        return this._recordBreak();
      }

      let activeOffsetDiff: number;

      if (lastSelection.active.line === selection.active.line) {
        activeOffsetDiff = selection.active.character - lastSelection.active.character;
      } else {
        const lastActiveOffset = document.offsetAt(lastSelection.active),
              activeOffset = document.offsetAt(selection.active);

        activeOffsetDiff = activeOffset - lastActiveOffset;
      }

      if (commonActiveOffsetDiff === Number.MAX_SAFE_INTEGER) {
        commonActiveOffsetDiff = activeOffsetDiff;
      } else if (commonActiveOffsetDiff !== activeOffsetDiff) {
        return this._recordBreak();
      }
    }

    if (commonActiveOffsetDiff === 0 && commonAnchorOffsetDiff === 0) {
      // Do not record translations by 0.
      return;
    }

    const expectedTranslation = this._expectedSelectionTranslation;

    if (expectedTranslation !== undefined) {
      this._expectedSelectionTranslation = undefined;

      if (expectedTranslation === commonActiveOffsetDiff
          && expectedTranslation === commonAnchorOffsetDiff) {
        return;
      }
    }

    const isSameDiff = commonActiveOffsetDiff === commonAnchorOffsetDiff;

    // Merge consecutive events if possible.
    if (isSameDiff) {
      const cursor = this.cursorFromEnd();

      if (cursor.previousIs(Entry.DeleteAfter)) {
        const deletionLength = cursor.entry().deletionLength();

        if (deletionLength === commonActiveOffsetDiff) {
          // DeleteAfter -> Translate = DeleteBefore.
          const buffer = cursor.buffer as Recorder.MutableBuffer,
                cursorOffset = cursor.offset;

          if (cursor.previousIs(Entry.DeleteBefore)) {
            // DeleteBefore -> DeleteBefore = DeleteBefore.
            buffer.splice(cursorOffset + 1);
            buffer[cursor.offset + 1] += deletionLength;
            buffer[cursor.offset + Entry.DeleteBefore.size + 1] =
              (Entry.DeleteBefore.id << Constants.PrevShift);
          } else {
            buffer[cursorOffset] =
              (buffer[cursorOffset] & ~Constants.NextMask) | Entry.DeleteBefore.id;
            buffer[cursorOffset + Entry.DeleteBefore.size + 1] =
              (Entry.DeleteBefore.id << Constants.PrevShift);
          }

          return;
        }
      } else if (cursor.previousIs(Entry.DeleteBefore)) {
        // DeleteBefore -> Translate = DeleteBefore.
        if (cursor.entry().deletionLength() === commonActiveOffsetDiff) {
          // Already handled in DeleteBefore.
          return;
        }
      } else if (cursor.previousIs(Entry.InsertAfter)) {
        const insertedText = cursor.entry().insertedText();

        if (insertedText.length === commonActiveOffsetDiff) {
          // InsertAfter -> Translate = InsertBefore.
          const buffer = cursor.buffer as Recorder.MutableBuffer,
                cursorOffset = cursor.offset;

          if (cursor.previousIs(Entry.InsertBefore)) {
            // InsertBefore -> InsertBefore = InsertBefore.
            buffer.splice(cursorOffset + 1);
            buffer[cursor.offset + 1] =
              this._storeObject(cursor.entry().insertedText() + insertedText);
            buffer[cursor.offset + Entry.InsertBefore.size + 1] =
              (Entry.InsertBefore.id << Constants.PrevShift);
          } else {
            buffer[cursorOffset] =
              (buffer[cursorOffset] & ~Constants.NextMask) | Entry.InsertBefore.id;
            buffer[cursorOffset + Entry.DeleteBefore.size + 1] =
              (Entry.InsertBefore.id << Constants.PrevShift);
          }

          return;
        }
      }
    } else if (commonActiveOffsetDiff === 0 || commonAnchorOffsetDiff === 0) {
      const cursor = this.cursorFromEnd();
      let type: typeof Entry.DeleteAfter | typeof Entry.DeleteBefore,
          translation: number;

      if (commonActiveOffsetDiff === 0) {
        type = Entry.DeleteAfter;
        translation = commonAnchorOffsetDiff;
      } else {
        type = Entry.DeleteBefore;
        translation = commonActiveOffsetDiff;
      }

      if (cursor.previousIs(type)) {
        if (cursor.entry().deletionLength() === translation) {
          // Delete{After,Before} -> Translate = Delete{After,Before}.
          return;
        }
      }
    }

    // Could not merge with previous events; just add an entry.
    this._record(Entry.TranslateSelection, commonActiveOffsetDiff, commonAnchorOffsetDiff);
  }

  /**
   * Records a text change.
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
      // Text change is internal.
      return;
    }

    if (lastSelections.length !== e.contentChanges.length) {
      // Text change is not supported.
      return this._recordBreak();
    }

    this._expectedSelectionTranslation = undefined;

    function computeOffsetFromActive(
      change: vscode.TextDocumentContentChangeEvent,
      selection: vscode.Selection,
    ) {
      const changeStart = change.range.start,
            active = selection.active;

      if (changeStart.line === active.line) {
        return changeStart.character - active.character;
      }

      return change.rangeOffset - document.offsetAt(active);
    }

    const document = e.document,
          firstChange = e.contentChanges[0],
          firstSelection = lastSelections[0],
          commonInsertedText = firstChange.text,
          commonDeletionLength = firstChange.rangeLength,
          commonOffsetFromActive = computeOffsetFromActive(firstChange, firstSelection);

    for (let i = 1, len = lastSelections.length; i < len; i++) {
      const change = e.contentChanges[i];

      if (change.text !== commonInsertedText || change.rangeLength !== commonDeletionLength) {
        return this._recordBreak();
      }

      const offsetFromActive = computeOffsetFromActive(change, selections[i]);

      if (offsetFromActive !== commonOffsetFromActive) {
        return this._recordBreak();
      }
    }

    // Merge consecutive events, if possible.
    if (commonDeletionLength > 0 && commonInsertedText.length > 0) {
      if (commonInsertedText.length - commonDeletionLength === commonOffsetFromActive) {
        this._record(Entry.ReplaceWith, this._storeObject(commonInsertedText));
        return;
      }
    }

    if (commonDeletionLength > 0) {
      const cursor = this.cursorFromEnd(),
            type = commonOffsetFromActive === 0 ? Entry.DeleteAfter : Entry.DeleteBefore;

      if (type === Entry.DeleteBefore) {
        this._expectedSelectionTranslation = commonOffsetFromActive;
      }

      if (cursor.previousIs(type)) {
        // Delete -> Delete = Delete.
        (cursor.buffer as Recorder.MutableBuffer)[cursor.offset + 1] += commonDeletionLength;
      } else if (type === Entry.DeleteBefore && cursor.previousIs(Entry.InsertBefore)) {
        const insertedText = cursor.entry().insertedText();

        if (insertedText.length > commonDeletionLength) {
          // InsertBefore -> DeleteBefore = InsertBefore.
          (cursor.buffer as Recorder.MutableBuffer)[cursor.offset + 1] =
            this._storeObject(insertedText.slice(0, insertedText.length - commonDeletionLength));
        } else {
          const previousType = cursor.previousType();

          (cursor.buffer as Recorder.MutableBuffer).splice(cursor.offset);

          if (insertedText.length === commonDeletionLength) {
            // InsertBefore -> DeleteBefore = Nop.
            (cursor.buffer as Recorder.MutableBuffer).push(previousType << Constants.PrevShift);
          } else {
            // InsertBefore -> DeleteBefore = DeleteBefore.
            (cursor.buffer as Recorder.MutableBuffer).push(
              (previousType << Constants.PrevShift) | Entry.DeleteBefore.id,
              commonDeletionLength,
              Entry.DeleteBefore.id << Constants.PrevShift,
            );
          }
        }
      } else {
        this._record(type, commonDeletionLength);
      }
    }

    if (commonInsertedText.length > 0) {
      const cursor = this.cursorFromEnd();

      if (cursor.previousIs(Entry.InsertAfter)) {
        // Insert -> Insert = Insert.
        const previousInsertedText = cursor.entry().insertedText();

        if (previousInsertedText.length === commonOffsetFromActive) {
          (cursor.buffer as Recorder.MutableBuffer)[cursor.offset + 1] =
            this._storeObject(previousInsertedText + commonInsertedText);
        } else {
          this._record(Entry.InsertAfter, this._storeObject(commonInsertedText));
        }
      } else {
        // TODO: handle offset from active
        this._record(Entry.InsertAfter, this._storeObject(commonInsertedText));
      }
    }
  }
}

export declare namespace Recorder {
  /**
   * A buffer of {@link Recorder} values.
   */
  export type Buffer = { readonly [index: number]: number; } & { readonly length: number; };

  /**
   * The mutable version of {@link Buffer}.
   */
  export type MutableBuffer = number[];
}

/**
 * A cursor used to enumerate records in a {@link Recorder} or
 * {@link Recording}.
 */
export class Cursor<T extends Entry.Any = Entry.Any> {
  private _buffer: Recorder.Buffer;
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
      : this._offset - Entry.size(this.previousType()) - 1;
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
    return this.entry().replay(context);
  }

  /**
   * Returns the entry pointed at by the cursor.
   */
  public entry() {
    return Entry.instantiate(this.type(), this.recorder, this._buffer, this._offset) as T;
  }

  /**
   * Returns the type of the current record.
   */
  public type() {
    return ((this._buffer[this._offset] as number) & Constants.NextMask) as Entry.Identifier;
  }

  /**
   * Returns the type of the previous record.
   */
  public previousType() {
    return (this._buffer[this._offset] as number >> Constants.PrevShift) as Entry.Identifier;
  }

  /**
   * Returns whether the cursor points to a record of the given type.
   */
  public is<T extends Entry.AnyClass>(type: T): this is Cursor<InstanceType<T>> {
    return this.type() === type.id;
  }

  /**
   * Returns whether, when going backward, the type will be correspond to the
   * given type. If so, goes backward.
   */
  public previousIs<T extends Entry.AnyClass>(type: T): this is Cursor<InstanceType<T>> {
    if (this.previousType() === type.id) {
      this.previous();

      return true;
    }

    return false;
  }

  /**
   * Switches to the next record, and returns `true` if the operation
   * succeeded or `false` if the current record is the last one available.
   */
  public next(): this is Cursor<Entry.Any> {
    if (this._offset === this._buffer.length - 1) {
      if (this._bufferIdx === this.recorder.bufferCount) {
        return false;
      }

      this._bufferIdx++;
      this._buffer = this.recorder.getBuffer(this._bufferIdx);
      this._offset = 0;

      return true;
    }

    this._offset += Entry.size(this.type()) + 1;
    return true;
  }

  /**
   * Switches to the previous record, and returns `true` if the operation
   * succeeded or `false` if the current record is the first one available.
   */
  public previous(): this is Cursor<Entry.Any> {
    assert(this._offset >= 0);

    if (this._offset === 0) {
      if (this._bufferIdx === 0) {
        return false;
      }

      this._bufferIdx--;
      this._buffer = this.recorder.getBuffer(this._bufferIdx);
      this._offset = this._buffer.length - 1;

      return true;
    }

    this._offset -= Entry.size(this.previousType()) + 1;
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

  /**
   * Returns `this` with a more generic type. Use when TypeScript merges types
   * incorrectly.
   */
  public upcast(): Cursor<Entry.Any> {
    return this;
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
   * Returns the result of calling `entries()`, for debugging purposes.
   */
  private get debugEntries() {
    return [...this.entries()];
  }

  /**
   * Returns an iterator over all the entries in the recorder.
   */
  public *entries(context = Context.WithoutActiveEditor.current) {
    let offset = this.offset;
    const buffer = this.buffer,
          end = offset + this.length,
          recorder = context.extension.recorder;

    while (offset < end) {
      const entry = recorder.entry(buffer, offset);

      yield entry;
      offset += entry.size + 1;
    }
  }

  /**
   * Replays the recording in the given context.
   */
  public async replay(context = Context.WithoutActiveEditor.current) {
    for (const entry of this.entries(context)) {
      await entry.replay(context);
    }
  }
}

/**
 * Base class for all entries.
 */
export abstract class BaseEntry<Items extends readonly [...RecordValue[]]> {
  public constructor(
    /**
     * The recorder to which this entry belongs.
     */
    public readonly recorder: Recorder,

    /**
     * The buffer in which the entry is recorded.
     */
    public readonly buffer: Recorder.Buffer,

    /**
     * The offset in the buffer at which the entry is recorded.
     */
    public readonly offset: number,
  ) {}

  /**
   * Returns the identifier of the record.
   */
  public get id() {
    return this.type.id;
  }

  /**
   * Returns the size of the record, excluding identifier before and after.
   */
  public get size() {
    return this.type.size;
  }

  /**
   * Returns the type of the entry.
   */
  public get type() {
    return this.constructor as Entry.AnyClass;
  }

  /**
   * Returns the result of calling `items()`, for debugging purposes.
   */
  private get debugItems() {
    return this.items();
  }

  /**
   * Replays the recorded entry.
   */
  public abstract replay(context: Context.WithoutActiveEditor): Thenable<void>;

  /**
   * Returns the items that make up the entry.
   */
  public abstract items(): Items;

  /**
   * Returns the item at the given index.
   */
  protected item<I extends keyof Items & number>(index: I) {
    return this.buffer[this.offset + 1 + index];
  }

  private static _entryIds = 0;

  /**
   * Returns an abstract class that should be extended to implement a new
   * `Entry`.
   */
  public static define<Items extends readonly [...RecordValue[]]>(size: Items["length"]) {
    const id = this._entryIds++;

    abstract class EntryWithSize extends BaseEntry<Readonly<Items>> {
      public static readonly size = size;
      public static readonly id = id;
    }

    // We need to wrap `EntryWithSize` into an actual, textually-representable
    // type below in order to generate a valid declaration for `define` in a
    // `.d.ts` file.
    return EntryWithSize as unknown as {
      readonly size: number;
      readonly id: number;

      new(
        ...args: typeof BaseEntry extends abstract new(...args: infer Args) => any ? Args : never
      ): BaseEntry<Readonly<Items>>;
    };
  }
}

/**
 * An action that cannot be reliably replayed and that interrupts a
 * recording.
 */
export class BreakEntry extends BaseEntry.define<[]>(0) {
  public replay() {
    return Promise.resolve();
  }

  public items() {
    return [] as const;
  }
}

/**
 * A selection translation.
 */
export class TranslateSelectionEntry extends BaseEntry.define<
  [activeTranslation: number, anchorTranslation: number]
>(2) {
  public replay(context: Context.WithoutActiveEditor) {
    Context.assert(context);

    const document = context.document,
          activeTranslation = this.activeTranslation(),
          anchorTranslation = this.anchorTranslation();

    context.run(() => Selections.updateByIndex((_, selection) => {
      const newActive = Positions.offsetOrEdge(selection.active, activeTranslation, document),
            newAnchor = Positions.offsetOrEdge(selection.anchor, anchorTranslation, document);

      return new vscode.Selection(newAnchor, newActive);
    }));

    return Promise.resolve();
  }

  public activeTranslation() {
    return this.item(0);
  }

  public anchorTranslation() {
    return this.item(1);
  }

  public items() {
    return [this.activeTranslation(), this.anchorTranslation()] as const;
  }
}

/**
 * An insertion before each selection (cursor moves forward).
 */
export class InsertBeforeEntry extends BaseEntry.define<[insertedText: string]>(1) {
  public replay(context: Context.WithoutActiveEditor) {
    Context.assert(context);

    const editor = context.editor as vscode.TextEditor;

    return editor.edit((editBuilder) => {
      const insertedText = this.insertedText();

      for (const selection of editor.selections) {
        editBuilder.insert(selection.start, insertedText);
      }
    }, noUndoStops).then(() => {});
  }

  public insertedText() {
    return this.recorder.getString(this.item(0));
  }

  public items() {
    return [this.insertedText()] as const;
  }
}

/**
 * An insertion after each selection (cursor does not move).
 */
export class InsertAfterEntry extends BaseEntry.define<[insertedText: string]>(1) {
  public replay(context: Context.WithoutActiveEditor) {
    Context.assert(context);

    const editor = context.editor as vscode.TextEditor;

    return editor.edit((editBuilder) => {
      const insertedText = this.insertedText();

      for (const selection of editor.selections) {
        editBuilder.replace(selection.end, insertedText);
      }
    }, noUndoStops).then(() => {});
  }

  public insertedText() {
    return this.recorder.getString(this.item(0));
  }

  public items() {
    return [this.insertedText()] as const;
  }
}

/**
 * A deletion before each selection (cursor moves backward).
 */
export class DeleteBeforeEntry extends BaseEntry.define<[deletionLength: number]>(1) {
  public replay(context: Context.WithoutActiveEditor) {
    Context.assert(context);

    const editor = context.editor as vscode.TextEditor;

    return editor.edit((editBuilder) => {
      const deletionLength = this.deletionLength(),
            document = editor.document;

      for (const selection of editor.selections) {
        const endPosition = selection.start,
              startPosition = Positions.offsetOrEdge(endPosition, -deletionLength, document);

        editBuilder.delete(new vscode.Range(startPosition, endPosition));
      }
    }).then(() => {});
  }

  public deletionLength() {
    return this.item(0);
  }

  public items() {
    return [this.deletionLength()] as const;
  }
}

/**
 * A deletion after each selection (cursor does not move).
 */
export class DeleteAfterEntry extends BaseEntry.define<[deletionLength: number]>(1) {
  public replay(context: Context.WithoutActiveEditor) {
    Context.assert(context);

    const editor = context.editor as vscode.TextEditor;

    return editor.edit((editBuilder) => {
      const deletionLength = this.deletionLength(),
            document = editor.document;

      for (const selection of editor.selections) {
        const startPosition = selection.end,
              endPosition = Positions.offsetOrEdge(startPosition, deletionLength, document);

        editBuilder.delete(new vscode.Range(startPosition, endPosition));
      }
    }).then(() => {});
  }

  public deletionLength() {
    return this.item(0);
  }

  public items() {
    return [this.deletionLength()] as const;
  }
}

/**
 * A text replacement.
 */
export class ReplaceWithEntry extends BaseEntry.define<[text: string]>(1) {
  public replay(context: Context.WithoutActiveEditor) {
    Context.assert(context);

    const editor = context.editor as vscode.TextEditor;

    return editor.edit((editBuilder) => {
      const text = this.text();

      for (const selection of editor.selections) {
        editBuilder.replace(selection, text);
      }
    }).then(() => {});
  }

  public text() {
    return this.recorder.getString(this.item(0));
  }

  public items() {
    return [this.text()] as const;
  }
}

/**
 * An active text editor change.
 */
export class ChangeTextEditorEntry extends BaseEntry.define<[uri: vscode.Uri]>(1) {
  public replay() {
    return vscode.window.showTextDocument(this.uri()).then(() => {});
  }

  public uri() {
    return this.recorder.getObject<vscode.Uri>(this.item(0));
  }

  public items() {
    return [this.uri()] as const;
  }
}

/**
 * A change of the active text editor mode.
 */
export class ChangeTextEditorModeEntry extends BaseEntry.define<[mode: Mode]>(1) {
  public replay(context: Context.WithoutActiveEditor) {
    Context.assert(context);

    return context.switchToMode(this.mode());
  }

  public mode() {
    return this.recorder.getObject<Mode>(this.item(0));
  }

  public items() {
    return [this.mode()] as const;
  }
}

/**
 * An internal command invocation.
 */
export class ExecuteCommandEntry extends BaseEntry.define<
  [descriptor: CommandDescriptor, argument: object]
>(2) {
  public async replay(context: Context.WithoutActiveEditor) {
    const descriptor = this.descriptor(),
          argument = this.argument();

    if ((descriptor.flags & CommandDescriptor.Flags.DoNotReplay) === 0) {
      await descriptor.replay(context, argument);
    }
  }

  public descriptor() {
    return this.recorder.getDescriptor(this.item(0));
  }

  public argument() {
    return this.recorder.getObject<{}>(this.item(1));
  }

  public items() {
    return [this.descriptor(), this.argument()] as const;
  }
}

/**
 * An external command invocation.
 */
export class ExecuteExternalCommandEntry extends BaseEntry.define<
  [identifier: string, argument: object]
>(2) {
  public replay() {
    return vscode.commands.executeCommand(this.identifier(), this.argument()).then(() => {});
  }

  public identifier() {
    return this.recorder.getString(this.item(0));
  }

  public argument() {
    return this.recorder.getObject<{}>(this.item(1));
  }

  public items() {
    return [this.identifier(), this.argument()] as const;
  }
}

export const EntryClasses = {
  Break: BreakEntry,
  ChangeTextEditor: ChangeTextEditorEntry,
  ChangeTextEditorMode: ChangeTextEditorModeEntry,
  DeleteAfter: DeleteAfterEntry,
  DeleteBefore: DeleteBeforeEntry,
  ExecuteCommand: ExecuteCommandEntry,
  ExecuteExternalCommand: ExecuteExternalCommandEntry,
  InsertAfter: InsertAfterEntry,
  InsertBefore: InsertBeforeEntry,
  ReplaceWith: ReplaceWithEntry,
  TranslateSelection: TranslateSelectionEntry,
};

export const Entry = {
  ...EntryClasses,

  /**
   * Returns the class of the entry corresponding to the given entry identifier.
   */
  byId(id: Entry.Identifier) {
    return sortedEntries[id];
  },

  /**
   * Returns the entry corresponding to the given entry identifier.
   */
  instantiate(id: Entry.Identifier, ...args: ConstructorParameters<Entry.AnyClass>) {
    return new sortedEntries[id](...args);
  },

  /**
   * Returns the size of the object at the given index.
   */
  size(id: Entry.Identifier) {
    return this.byId(id).size;
  },
};

const sortedEntries = Object.values(EntryClasses).slice().sort((a, b) => a.id - b.id);

export declare namespace Entry {
  export type Identifier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

  export type AnyClass = (typeof EntryClasses)[keyof typeof EntryClasses];
  export type Any = InstanceType<AnyClass>;
}
