import * as vscode from "vscode";

import * as api from "./api";
import { loadCommands } from "./commands/load-all";
import { Extension } from "./state/extension";
import { extensionId, extensionName } from "./utils/constants";

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

  const extensionData = vscode.extensions.getExtension(extensionId),
        extensionPackageJSON = extensionData?.packageJSON;

  if (extensionPackageJSON?.[`${extensionName}.disableArbitraryCodeExecution`]) {
    api.run.disable();
  } else {
    api.run.setGlobals({ vscode, ...api });
  }

  if (extensionPackageJSON?.[`${extensionName}.disableArbitraryCommandExecution`]) {
    api.execute.disable();
  }

  return loadCommands().then((commands) => {
    if (isActivated) {
      return { api, extension: (extensionState = new Extension(commands)) };
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
