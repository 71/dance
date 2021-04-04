import * as vscode from "vscode";
import { Context } from "./context";

/**
 * Un-does the last action.
 */
export function undo() {
  return vscode.commands.executeCommand("undo");
}

/**
 * Re-does the last action.
 */
export function redo() {
  return vscode.commands.executeCommand("redo");
}

/**
 * Marks a change, inserting a history undo stop.
 */
export function markChange(editor = Context.current.editor) {
  return Context.wrap(
    editor.edit(() => {}, { undoStopBefore: true, undoStopAfter: false }).then(() => {}),
  );
}
