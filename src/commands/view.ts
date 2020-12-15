import * as vscode from "vscode";

import { Command, CommandFlags, registerCommand } from ".";

function moveViewTo(lineNumber: number, at: "center" | "top" | "bottom") {
  console.log("move view to: " + lineNumber + ", at: " + at);
  return vscode.commands.executeCommand("revealLine", {
    lineNumber,
    at,
  });
}

registerCommand(Command.viewCenterVertical, CommandFlags.None, ({ editor }) => {
  const res = moveViewTo(editor.selection.start.line, "center");
});

registerCommand(Command.viewTop, CommandFlags.None, ({ editor }) => {
  moveViewTo(editor.selection.start.line, "top");
});

registerCommand(Command.viewBottom, CommandFlags.None, ({ editor }) => {
  moveViewTo(editor.selection.start.line, "bottom");
});
