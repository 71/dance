import * as vscode from "vscode";
import { Context } from "./context";

/**
 * Copies the given text to the clipboard.
 */
export function copy(text: string) {
  return Context.wrap(vscode.env.clipboard.writeText(text));
}

/**
 * Returns the text in the clipboard.
 */
export function clipboard() {
  return Context.wrap(vscode.env.clipboard.readText());
}
