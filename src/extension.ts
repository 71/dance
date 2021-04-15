import * as vscode from "vscode";

import * as api from "./api";
import { loadCommands } from "./commands/load-all";
import { Extension } from "./state/extension";

/**
 * Name of the extension, used in commands and settings.
 */
export const extensionName = "dance";

/**
 * Global state of the extension.
 */
export let extensionState: Extension | undefined;

let isActivated = false;

/**
 * Function called by VS Code to activate the extension.
 */
export function activate() {
  isActivated = true;

  const extensionData = vscode.extensions.getExtension(`gregoire.${extensionName}`),
        extensionPackageJSON = extensionData?.packageJSON;

  if (extensionPackageJSON?.[`${extensionName}.disableArbitraryCodeExecution`]) {
    api.run.disable();
  }

  if (extensionPackageJSON?.[`${extensionName}.disableArbitraryCommandExecution`]) {
    api.execute.disable();
  }

  return loadCommands().then((commands) => {
    if (isActivated) {
      return extensionState = new Extension(commands);
    }
    return;
  });
}

/**
 * Function called by VS Code to deactivate the extension.
 */
export function deactivate() {
  isActivated = false;
  extensionState?.dispose();
}

export { api };
