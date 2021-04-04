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

  if (process.env.VERBOSE_LOGGING === "true") {
    // Log all commands we need to implement
    Promise.all([vscode.commands.getCommands(true), import("../commands/index")]).then(
      ([registeredCommands, { commands }]) => {
        for (const command of Object.values(commands)) {
          if (registeredCommands.indexOf(command.id) === -1) {
            console.warn("Command", command.id, "is defined but not implemented.");
          }
        }
      },
    );
  }
}

/**
 * Function called by VS Code to deactivate the extension.
 */
export function deactivate() {
  extensionState.dispose();
}

export { api };
