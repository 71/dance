import * as vscode from "vscode";

import { Context, prompt, Selections } from "../api";
import { Input, SetInput } from "../commands";

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
export function performDummyEdit(editor: vscode.TextEditor) {
  // VS Code ignores edits where no interaction is performed with the editor, so
  // we delete an empty range at the start of the document.
  return editor
    .edit((editBuilder) => editBuilder.delete(dummyRange), dummyUndoStops)
    .then(() => {});
}

/**
 * Returns the selections of the given editor. **Selections are returned
 * as-is**, with no processing related to `SelectionBehavior`s. In most cases,
 * `Context.selections` or `Selections.current` is a better choice.
 */
export function unsafeSelections(editor: vscode.TextEditor) {
  return editor.selections;
}

export async function manipulateSelectionsInteractively<I, R>(
  _: Context,
  input: Input<I>,
  setInput: SetInput<R>,
  interactive: boolean,
  options: prompt.Options,
  f: (input: string | I, selections: readonly vscode.Selection[]) => Thenable<R>,
) {
  const selections = _.selections;

  function execute(input: string | I) {
    return _.runAsync(() => f(input, selections));
  }

  function undo() {
    Selections.set(selections);
  }

  if (input === undefined) {
    setInput(await prompt.interactive(execute, undo, options, interactive));
  } else {
    await execute(input);
  }
}

export const workspaceSettingsPropertyNames = [
  "workspaceFolderValue",
  "workspaceFolderLanguageValue",
  "workspaceValue",
  "workspaceLanguageValue",
] as const;