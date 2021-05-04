import * as vscode from "vscode";

import { Argument } from ".";
import { Context, Selections } from "../api";

/**
 * Moving the editor view.
 *
 * #### Predefined keybindings
 *
 * | Title                   | Keybinding     | Command                                          |
 * | ----------------------- | -------------- | ------------------------------------------------ |
 * | Show view menu          | `v` (normal)   | `[".openMenu", { input: "view"               }]` |
 * | Show view menu (locked) | `s-v` (normal) | `[".openMenu", { input: "view", locked: true }]` |
 */
declare module "./view";

/**
 * Reveals a position based on the main cursor.
 */
export function line(
  _: Context,
  at: Argument<"top" | "center" | "bottom"> = "center",
) {
  return vscode.commands.executeCommand(
    "revealLine",
    { at, lineNumber: Selections.activeLine(_.mainSelection) },
  );
}
