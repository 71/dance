import * as vscode from "vscode";
import { CommandContext } from "../command";
import { Register } from "../register";

/**
 * Undo.
 *
 * @keys `u` (normal)
 */
export function undo(context: CommandContext) {
  context.ignoreInHistory();

  return vscode.commands.executeCommand("undo");
}

/**
 * Redo.
 *
 * @keys `s-u` (normal)
 */
export function redo(context: CommandContext) {
  context.ignoreInHistory();

  return vscode.commands.executeCommand("redo");
}

/**
 * Move backward in history.
 *
 * @keys `a-u` (normal)
 */
export function backward(context: CommandContext) {
  context.notImplemented();
}

/**
 * Move forward in history.
 *
 * @keys `s-a-u` (normal)
 */
export function forward(context: CommandContext) {
  context.notImplemented();
}

/**
 * Repeat last change.
 *
 * | Title                        | Identifier               | Keybinding     | Commands                                                        |
 * | ---------------------------- | ------------------------ | -------------- | --------------------------------------------------------------- |
 * | Repeat last selection change | `repeat.selection`       |                | `[".history.repeat", { include: "dance.selections.+" }]`        |
 * | Repeat last object selection | `repeat.objectSelection` | `a-.` (normal) | `[".history.repeat", { include: "dance.selections.object.+" }]` |
 */
export function repeat(
  context: CommandContext,
  repetitions: number,
  argument?: { include?: string; exclude?: string },
) {
  for (let i = 0; i < repetitions; i++) {
    context.notImplemented();
  }
}

/**
 * Repeat last edit without a command.
 *
 * @keys `.` (normal)
 */
export function repeat_edit(context: CommandContext, repetitions: number) {
  for (let i = 0; i < repetitions; i++) {
    context.notImplemented();
  }
}

/**
 * Play macro.
 *
 * @keys `q` (normal)
 */
export function recording_play(context: CommandContext, repetitions: number, register?: Register) {
  const actualRegister = getRecordingRegister(context, register),
        commands = actualRegister.getRecordedCommands();

  for (let i = 0; i < repetitions; i++) {
    context.notImplemented();
  }
}

/**
 * Start recording macro.
 *
 * @keys `s-q` (normal)
 */
export function recording_start(context: CommandContext, register?: Register) {
  const actualRegister = getRecordingRegister(context, register);

  context.notImplemented();
}

/**
 * Stop recording macro.
 *
 * @keys `escape` (normal)
 */
export function recording_stop(context: CommandContext, register?: Register) {
  // Note: this command executes even if a macro recording is not in progess,
  // so that <esc> will noop instead of defaulting to deselecting in VSCode.
  const actualRegister = getRecordingRegister(context, register);

  context.notImplemented();
}

function getRecordingRegister(context: CommandContext, chosen: Register | undefined) {
  if (chosen === undefined) {
    return context.extensionState.registers.arobase as Register.ReadableWriteableMacros;
  }

  chosen.assertFlags(Register.Flags.CanReadWriteMacros);

  return chosen as unknown as Register.ReadableWriteableMacros;
}
