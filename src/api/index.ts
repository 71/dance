import * as vscode from "vscode";

export * from "./edit";
export * from "./edit/linewise";
export * from "./clipboard";
export * from "./context";
export * from "./functional";
export * from "./modes";
export * from "./positions";
export * from "./run";
export * from "./search";
export * from "./search/move";
export * from "./search/pairs";
export * from "./selections";

/**
 * Returns the module exported by the extension with the given identifier.
 */
export function extension<T>(extensionId: string) {
  return vscode.extensions.getExtension<T>(extensionId)?.exports;
}
