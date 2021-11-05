import * as vscode from "vscode";

import { Context } from "./context";

/**
 * Un-does the last action.
 */
export function undo() {
  return Context.wrap(vscode.commands.executeCommand("undo"));
}

/**
 * Re-does the last action.
 */
export function redo() {
  return Context.wrap(vscode.commands.executeCommand("redo"));
}
