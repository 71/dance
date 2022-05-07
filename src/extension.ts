import * as vscode from "vscode";

import * as api from "./api";
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
export async function activate() {
  isActivated = true;

  const extensionData = vscode.extensions.getExtension(extensionId),
        extensionPackageJSON = extensionData?.packageJSON;

  if (extensionPackageJSON?.[`${extensionName}.disableArbitraryCodeExecution`]) {
    api.disableRunFunction();
  } else {
    api.setRunGlobals({ vscode, ...api });
  }

  if (extensionPackageJSON?.[`${extensionName}.disableArbitraryCommandExecution`]) {
    api.disableExecuteFunction();
  }

  const { commands } = await import("./commands/load-all");

  if (!isActivated) {
    return;
  }

  return { api, extension: (extensionState = new Extension(commands)) };
}

/**
 * Function called by VS Code to deactivate the extension.
 */
export function deactivate() {
  isActivated = false;
  extensionState?.dispose();
}

export { api };
