import * as vscode from "vscode";
import { RegisterOr } from ".";
import { Context, prompt, todo } from "../api";
import { Register } from "../register";

/**
 * Utilities for setting up keybindings.
 */
declare module "./keybindings";

/**
 * Set up Dance keybindings.
 */
export async function setup(_: Context, register: RegisterOr<"dquote", Register.Flags.CanWrite>) {
  await vscode.commands.executeCommand("workbench.action.openGlobalKeybindingsFile");
  await _.switchToDocument(_.extensionState.activeEditorState!.editor.document);

  const action = await prompt.one([
    ["y", "yank keybindings to register"],
    ["a", "append keybindings"],
    ["p", "prepend keybindings"],
  ]);

  const keybindings = await prompt.many([
    ["d", "default keybindings"],
  ]);

  todo();
}
