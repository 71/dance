import * as vscode from "vscode";
import { CommandDescriptor } from "../commands";
import { Register } from "../register";
import { Context } from "./context";
import { assert, todo } from "./errors";

type RecordValue = Recording.ActionType | CommandDescriptor | object;

/**
 * A class used to record actions as they happen.
 */
export class Recorder {
  private readonly _previousBuffers: (readonly RecordValue[])[] = [];
  private readonly _buffer: RecordValue[] = [];

  private _handles = new WeakMap<Recorder.Handle, [number, CommandDescriptor, object]>();
  private _handlesCount = 0;

  /**
   * Records the invocation of a command, and returns a `Handle` that can be
   * used to mark the end of the command, the cancellation of the execution, or
   * to specify how the command should be interpreted.
   */
  public recordCommand(descriptor: CommandDescriptor, argument: Record<string, any>) {
    const handle = new Recorder.Handle(this);

    this._handles.set(handle, [this._buffer.length, descriptor, argument]);

    return handle;
  }

  /**
   * Records a change of a selection.
   */
  public recordExternalSelectionChange(e: vscode.TextEditorSelectionChangeEvent) {
    if (vscode.window.activeTextEditor !== e.textEditor) {
      return;
    }

    if (e.kind !== vscode.TextEditorSelectionChangeKind.Command) {
      // Selection changed due to user interaction outside of our control --
      // cancel recording.
      this._handles = new WeakMap();
      this._handlesCount = 0;

      return;
    }

    const selections = e.selections;

    this._buffer.push(Recording.ActionType.SelectionChange, e.selections);
    this.splitBufferIfNeeded();
  }

  /**
   * Records a change to a document.
   */
  public recordExternalTextChange(e: vscode.TextDocumentChangeEvent) {
    const editor = vscode.window.activeTextEditor;

    if (editor?.document !== e.document) {
      return;
    }

    // If any of the changes happened "far" from a current selection, we
    // consider that we didn't have any control over it and ignore it.
    const changes = e.contentChanges,
          selections = editor.selections;

    for (let changeIdx = 0; changeIdx < changes.length; changeIdx++) {
      const change = changes[changeIdx];
    }

    this._buffer.push(todo());
    this.splitBufferIfNeeded();
  }

  public startRecording(register: Register.WithFlags<Register.Flags.CanReadWriteMacros>) {
    const statusBarItem = vscode.window.createStatusBarItem();

    statusBarItem.command = "dance.history.recording.stop";
    statusBarItem.text = `Macro recording in ${register.name}`;

    return vscode.commands
      .executeCommand("setContext", "dance.recording", true)
      .then(() => statusBarItem);
  }

  public stopRecording() {
    return vscode.commands.executeCommand("setContext", "dance.recording", false);
  }

  /**
   * Do not use -- internal implementation detail.
   *
   * @deprecated
   */
  public notifyHandleCompleted(handle: Recorder.Handle) {
    const data = this._handles.get(handle);

    if (data === undefined) {
      return;
    }

    const [offset, command, argument] = data;

    this._handles.delete(handle);
    this._handlesCount--;

    this._buffer.splice(offset, 0, Recording.ActionType.Command, command, argument);
    this.splitBufferIfNeeded();
  }

  /**
   * Do not use -- internal implementation detail.
   *
   * @deprecated
   */
  public notifyHandleDiscarded(handle: Recorder.Handle) {
    if (this._handles.delete(handle)) {
      this._handlesCount--;
    }
  }

  private splitBufferIfNeeded() {
    const buffer = this._buffer;

    if (this._handlesCount > 0 || buffer.length < 8192) {
      return;
    }

    this._previousBuffers.push(buffer.splice(0));
  }
}

export namespace Recorder {
  /**
   * The handle to a currently-recording command.
   */
  export class Handle {
    private readonly _recorder: Recorder;

    public constructor(recorder: Recorder) {
      this._recorder = recorder;
    }

    /**
     * Marks the command as completed.
     */
    public complete() {
      this._recorder.notifyHandleCompleted(this);
    }

    /**
     * Discards the recording of the command.
     */
    public discard() {
      this._recorder.notifyHandleDiscarded(this);
    }
  }
}

/**
 * A recording of actions performed in VS Code.
 */
export class Recording implements Iterable<Recording.Entry> {
  private readonly _buffer: readonly RecordValue[];
  private readonly _offset: number;
  private readonly _length: number;

  private constructor(buffer: readonly RecordValue[], offset: number, length: number) {
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

      case Recording.ActionType.SelectionChange:
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
    /** Internal command invoked. */
    Command,

    /** Selection change. */
    SelectionChange,

    /** Text inserted after a selection. */
    TextInsertedAfter,

    /** Text inserted before a selection. */
    TextInsertedBefore,

    /** Text removed after a selection. */
    TextRemovedAfter,

    /** Text removed before a selection. */
    TextRemovedBefore,
  }

  /**
   * A recorded action.
   */
  export type Entry
    = readonly [t: ActionType.Command, command: CommandDescriptor, argument: object]
    | readonly [t: ActionType.SelectionChange]
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

      if (type === Recording.ActionType.SelectionChange) {
        const value = [Recording.ActionType.SelectionChange] as const;

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
