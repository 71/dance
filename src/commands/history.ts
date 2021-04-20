import * as vscode from "vscode";

import { Argument, RegisterOr } from ".";
import { ArgumentError, Context, todo } from "../api";
import { Register } from "../state/registers";
import { ActiveRecording } from "../state/recorder";

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
 * | Title                        | Identifier               | Keybinding     | Commands                                                        |
 * | ---------------------------- | ------------------------ | -------------- | --------------------------------------------------------------- |
 * | Repeat last selection change | `repeat.selection`       |                | `[".history.repeat", { "include": "dance.selections.+" }]`        |
 * | Repeat last object selection | `repeat.objectSelection` | `a-.` (normal) | `[".history.repeat", { "include": "dance.selections.object.+" }]` |
 */
export function repeat(
  repetitions: number,

  include?: Argument<string>,
  exclude?: Argument<string>,
) {
  for (let i = 0; i < repetitions; i++) {
    todo();
  }
}

/**
 * Repeat last edit without a command.
 *
 * @keys `.` (normal)
 */
export function repeat_edit(repetitions: number) {
  for (let i = 0; i < repetitions; i++) {
    todo();
  }
}

/**
 * Replay recording.
 *
 * @keys `q` (normal)
 */
export function recording_play(
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
    recording.replay(_);
  }
}

const recordingPerRegister = new WeakMap<Register, ActiveRecording>();

/**
 * Start recording.
 *
 * @keys `s-q` (normal)
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

  register.setRecording(recording.complete());
}
