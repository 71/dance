import * as vscode from "vscode";

import { Argument, CommandDescriptor, RegisterOr } from ".";
import { ArgumentError, Context } from "../api";
import { Register } from "../state/registers";
import { ActiveRecording, Recorder, Recording } from "../state/recorder";

/**
 * Interact with history.
 */
declare module "./history";

/**
 * Undo.
 *
 * @keys `u` (normal)
 */
export function undo() {
  return vscode.commands.executeCommand("undo");
}

/**
 * Redo.
 *
 * @keys `s-u` (normal)
 */
export function redo() {
  return vscode.commands.executeCommand("redo");
}

/**
 * Undo a change of selections.
 *
 * @keys `a-u` (normal)
 */
export function undo_selections() {
  return vscode.commands.executeCommand("cursorUndo");
}

/**
 * Redo a change of selections.
 *
 * @keys `s-a-u` (normal)
 */
export function redo_selections() {
  return vscode.commands.executeCommand("cursorRedo");
}

/**
 * Repeat last change.
 *
 * @noreplay
 *
 * | Title                        | Identifier         | Keybinding     | Commands                                                                    |
 * | ---------------------------- | ------------------ | -------------- | --------------------------------------------------------------------------- |
 * | Repeat last selection change | `repeat.selection` |                | `[".history.repeat", { include: "dance\\.(seek|select|selections)\\..+" }]` |
 * | Repeat last seek             | `repeat.seek`      | `a-.` (normal) | `[".history.repeat", { include: "dance\\.seek\\..+" }]`                     |
 */
export async function repeat(
  _: Context,
  repetitions: number,

  include: Argument<string | RegExp> = /.+/,
) {
  if (typeof include === "string") {
    include = new RegExp(include, "u");
  }

  let commandDescriptor: CommandDescriptor,
      commandArgument: object;

  const cursor = _.extension.recorder.cursorFromEnd();

  for (;;) {
    if (cursor.is(Recording.ActionType.Command)
        && include.test(cursor.commandDescriptor().identifier)) {
      commandDescriptor = cursor.commandDescriptor();
      commandArgument = cursor.commandArgument();
      break;
    }

    if (!cursor.previous()) {
      throw new Error("no previous command matching " + include);
    }
  }

  for (let i = 0; i < repetitions; i++) {
    await commandDescriptor.replay(_, commandArgument);
  }
}

/**
 * Repeat last edit without a command.
 *
 * @keys `.` (normal)
 * @noreplay
 */
export async function repeat_edit(_: Context, repetitions: number) {
  const recorder = _.extension.recorder,
        cursor = recorder.cursorFromEnd();
  let startCursor: Recorder.Cursor | undefined,
      endCursor: Recorder.Cursor | undefined;

  for (;;) {
    if (cursor.is(Recording.ActionType.Command)
        && cursor.commandDescriptor().identifier === "dance.modes.set") {
      const modeName = cursor.commandArgument().input as string;

      if (modeName === "normal") {
        endCursor = cursor.clone();
      } else if (modeName === "insert" && endCursor !== undefined) {
        startCursor = cursor.clone();
        break;
      }
    }

    if (!cursor.previous()) {
      throw new Error("cannot find switch to normal or insert mode");
    }
  }

  // TODO: almost there, but not completely
  for (let i = 0; i < repetitions; i++) {
    for (let cursor = startCursor.clone(); cursor.isBeforeOrEqual(endCursor); cursor.next()) {
      await cursor.replay(_);
    }
  }
}

/**
 * Replay recording.
 *
 * @keys `q` (normal)
 * @noreplay
 */
export async function recording_play(
  _: Context.WithoutActiveEditor,

  repetitions: number,
  register: RegisterOr<"arobase", Register.Flags.CanReadWriteMacros>,
) {
  const recording = register.getRecording();

  ArgumentError.validate(
    "recording",
    recording !== undefined,
    () => `register "${register.name}" does not hold a recording`,
  );

  for (let i = 0; i < repetitions; i++) {
    await recording.replay(_);
  }
}

const recordingPerRegister = new WeakMap<Register, ActiveRecording>();

/**
 * Start recording.
 *
 * @keys `s-q` (normal)
 * @noreplay
 */
export function recording_start(
  _: Context,
  register: RegisterOr<"arobase", Register.Flags.CanReadWriteMacros>,
) {
  ArgumentError.validate(
    "register",
    !recordingPerRegister.has(register),
    "a recording is already active",
  );

  const recording = _.extension.recorder.startRecording();

  recordingPerRegister.set(register, recording);
}

/**
 * Stop recording.
 *
 * @keys `escape` (normal, recording)
 * @noreplay
 */
export function recording_stop(
  _: Context,
  register: RegisterOr<"arobase", Register.Flags.CanReadWriteMacros>,
) {
  const recording = recordingPerRegister.get(register);

  ArgumentError.validate(
    "register",
    recording !== undefined,
    "no recording is active in the given register",
  );

  recordingPerRegister.delete(register);
  register.setRecording(recording.complete());
}
