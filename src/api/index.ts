import * as vscode from "vscode";

export * from "./clipboard";
export * from "./context";
export * from "./edit";
export * from "./edit/linewise";
export * from "./errors";
export * from "./functional";
export * from "./history";
export * from "./keybindings";
export * from "./lines";
export * from "./menu";
export * from "./modes";
export * from "./positions";
export * from "./prompt";
export * from "./registers";
export * from "./run";
export * from "./search";
export * from "./search/lines";
export * from "./search/move";
export * from "./search/move-to";
export * from "./search/pairs";
export * from "./search/range";
export * from "./search/word";
export * from "./selections";
export * from "./types";

/**
 * Returns the module exported by the extension with the given identifier.
 */
export function extension<T>(extensionId: string) {
  return vscode.extensions.getExtension<T>(extensionId)?.exports;
}
