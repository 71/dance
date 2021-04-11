import * as vscode from "vscode";

/**
 * An object passed to `vscode.TextEditor.edit` to indicate that no undo stops
 * should be implicitly inserted.
 */
export const noUndoStops: Parameters<vscode.TextEditor["edit"]>[1] =
  Object.freeze({ undoStopBefore: false, undoStopAfter: false });
