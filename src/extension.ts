import * as vscode from "vscode";

import * as api from "./api";
import { Extension } from "./state/extension";

/**
 * Name of the extension, used in commands and settings.
 */
export const extensionName = "dance";

/**
 * Global state of the extension.
 */
export let extensionState: Extension;

/**
 * Function called by VS Code to activate the extension.
 */
export function activate() {
  extensionState = new Extension();

  const extensionData = vscode.extensions.getExtension(`gregoire.${extensionName}`),
        extensionPackageJSON = extensionData?.packageJSON;

  if (extensionPackageJSON?.[`${extensionName}.disableArbitraryCodeExecution`]) {
    api.run.disable();
  }

  if (extensionPackageJSON?.[`${extensionName}.disableArbitraryCommandExecution`]) {
    api.execute.disable();
  }
}

/**
 * Function called by VS Code to deactivate the extension.
 */
export function deactivate() {
  extensionState.dispose();
}

export { api };
