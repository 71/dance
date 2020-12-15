import * as vscode from "vscode";

import { Command, CommandFlags, CommandState, InputKind, registerCommand } from ".";
import { EditorState } from "../state/editor";

const getMenu = (name: string) => (editorState: EditorState) => {
  const menuItems = editorState.extension.menus.get(name)!.items;

  return Object.entries(menuItems).map((x) => [x[0], x[1].text]) as [string, string][];
};

const executeMenuItem = async (editorState: EditorState, name: string, i: number) => {
  const menuItems = editorState.extension.menus.get(name)!.items;
  const menuItem = Object.values(menuItems)[i];

  try {
    await vscode.commands.executeCommand(menuItem.command, menuItem.args);
  } catch (e) {
    const str = `${e}`.replace(/^Error: /, "");

    vscode.window.showErrorMessage(`Command did not succeed successfully: ${str}.`);
  }
};

// TODO: Make just merely opening the menu not count as a command execution
// and do not record it.
registerCommand(
  Command.view,
  CommandFlags.ChangeSelections,
  InputKind.ListOneItemOrCount,
  getMenu("view"),
  (editorState, state) => {
    if (state.input !== null)
      return executeMenuItem(editorState, "view", state.input);
    return;
  },
);

async function toCenter() {
  let currentLineNumber = vscode.window.activeTextEditor?.selection.start.line;
  await vscode.commands.executeCommand("revealLine", {
    lineNumber: currentLineNumber,
    at: "center"
  });
}

async function toTop() {
  let currentLineNumber = vscode.window.activeTextEditor?.selection.start.line;
  await vscode.commands.executeCommand("revealLine", {
    lineNumber: currentLineNumber,
    at: "top"
  });
}

async function toBottom() {
  let currentLineNumber = vscode.window.activeTextEditor?.selection.start.line;
  await vscode.commands.executeCommand("revealLine", {
    lineNumber: currentLineNumber,
    at: "bottom"
  });
}

vscode.commands.registerCommand(Command.viewCenterVertical, async () => await toCenter());
vscode.commands.registerCommand(Command.viewTop, async () => await toTop());
vscode.commands.registerCommand(Command.viewBottom, async () => await toBottom());
