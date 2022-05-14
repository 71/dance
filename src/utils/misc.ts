import * as vscode from "vscode";

/**
 * An object passed to `vscode.TextEditor.edit` to indicate that no undo stops
 * should be implicitly inserted.
 */
export const noUndoStops: Parameters<vscode.TextEditor["edit"]>[1] =
  Object.freeze({ undoStopBefore: false, undoStopAfter: false });

const dummyPosition = new vscode.Position(0, 0),
      dummyRange = new vscode.Range(dummyPosition, dummyPosition),
      dummyUndoStops: Parameters<vscode.TextEditor["edit"]>[1] =
        Object.freeze({ undoStopBefore: false, undoStopAfter: true });

/**
 * Performs a dummy edit on a text document, inserting an undo stop.
 */
export async function performDummyEdit(editor: vscode.TextEditor) {
  // VS Code ignores edits where no interaction is performed with the editor, so
  // we delete an empty range at the start of the document.
  await editor.edit((editBuilder) => editBuilder.delete(dummyRange), dummyUndoStops);
}

/**
 * Returns the selections of the given editor. **Selections are returned
 * as-is**, with no processing related to `SelectionBehavior`s. In most cases,
 * `Context.selections` or `Selections.current` is a better choice.
 */
export function unsafeSelections(editor: vscode.TextEditor) {
  return editor.selections;
}

export const workspaceSettingsPropertyNames = [
  "workspaceFolderValue",
  "workspaceFolderLanguageValue",
  "workspaceValue",
  "workspaceLanguageValue",
] as const;