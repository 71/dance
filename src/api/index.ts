import * as vscode from "vscode";

export * from "./clipboard";
export * from "./context";
export * from "./edit";
export * from "./edit/linewise";
export * from "./errors";
export * from "./functional";
export * from "./history";
export * from "./keybindings";
export * from "./menu";
export * from "./modes";
export * from "./prompt";
export * from "./run";
export * from "./search";
export * from "./search/lines";
export * from "./search/move";
export * from "./search/move-to";
export * from "./search/pairs";
export * from "./search/word";
export * from "./types";

/**
 * Operations on lines in `vscode`.
 */
export * as Lines from "./lines";
export { firstVisibleLine, middleVisibleLine, lastVisibleLine } from "./lines";

/**
 * Operations on ranges of text objects.
 */
export * as Objects from "./search/objects";

/**
 * Operations on `vscode.Position`s.
 */
export * as Positions from "./positions";

/**
 * Operations on `vscode.Selection`s.
 */
export * as Selections from "./selections";

/**
 * Operations on `Register`s.
 */
export * as Registers from "./registers";

/**
 * Returns the module exported by the extension with the given identifier.
 */
export function extension<T>(extensionId: string) {
  return vscode.extensions.getExtension<T>(extensionId)?.exports;
}
