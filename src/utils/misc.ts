import * as vscode from "vscode";
import { Context, prompt, Selections } from "../api";
import { Input, SetInput } from "../commands";

/**
 * An object passed to `vscode.TextEditor.edit` to indicate that no undo stops
 * should be implicitly inserted.
 */
export const noUndoStops: Parameters<vscode.TextEditor["edit"]>[1] =
  Object.freeze({ undoStopBefore: false, undoStopAfter: false });

export async function manipulateSelectionsInteractively<I, R>(
  _: Context,
  input: Input<I>,
  setInput: SetInput<R>,
  interactive: boolean,
  options: vscode.InputBoxOptions,
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
