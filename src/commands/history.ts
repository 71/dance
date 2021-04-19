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
 * Move backward in history.
 *
 * @keys `a-u` (normal)
 */
export function backward() {
}

/**
 * Move forward in history.
 *
 * @keys `s-a-u` (normal)
 */
export function forward() {
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
 * Play macro.
 *
 * @keys `q` (normal)
 */
export function recording_play(
  repetitions: number,
  register: RegisterOr<"arobase", Register.Flags.CanReadWriteMacros>,
) {
  const commands = register.getRecordedCommands();

  for (let i = 0; i < repetitions; i++) {
    todo();
  }
}

const recordingPerRegister = new WeakMap<Register, ActiveRecording>();

/**
 * Start recording macro.
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
 * Stop recording macro.
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

  register.setRecordedCommands(recording.complete());
}
