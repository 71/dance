import * as vscode from "vscode";

import { Argument, RegisterOr } from ".";
import { todo } from "../api";
import { Register } from "../register";

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

/**
 * Start recording macro.
 *
 * @keys `s-q` (normal)
 */
export function recording_start(
  register: RegisterOr<"arobase", Register.Flags.CanReadWriteMacros>,
) {
  todo();
}

/**
 * Stop recording macro.
 *
 * @keys `escape` (normal, recording)
 */
export function recording_stop(
  register: RegisterOr<"arobase", Register.Flags.CanReadWriteMacros>,
) {
  // Note: this command executes even if a macro recording is not in progess,
  // so that <esc> will noop instead of defaulting to deselecting in VSCode.
  todo();
}
