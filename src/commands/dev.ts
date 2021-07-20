import * as vscode from "vscode";

import type { Argument } from ".";
import { Context, SelectionBehavior } from "../api";
import type { Extension } from "../state/extension";

/**
 * Developer utilities for Dance.
 */
declare module "./dev";

/**
 * Set the selection behavior of the specified mode.
 */
export function setSelectionBehavior(
  _: Context,
  extension: Extension,

  mode?: Argument<string>,
  value?: Argument<"caret" | "character">,
) {
  const selectedMode = mode === undefined ? _.mode : extension.modes.get(mode);

  if (selectedMode !== undefined) {
    if (value === undefined) {
      value = selectedMode.selectionBehavior === SelectionBehavior.Caret ? "character" : "caret";
    }

    selectedMode.update(
      "_selectionBehavior",
      value === "character" ? SelectionBehavior.Character : SelectionBehavior.Caret,
    );
  }
}

/**
 * Copies the last encountered error message.
 */
export function copyLastErrorMessage(extension: Extension) {
  if (extension.lastErrorMessage === undefined) {
    return Promise.resolve();
  }

  return vscode.env.clipboard.writeText(extension.lastErrorMessage);
}
