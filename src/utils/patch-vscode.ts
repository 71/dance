import * as vscode from "vscode";

import { extensionId } from "./constants";

interface MonkeyPatch {
  active(): boolean;
  contribute(extension: typeof extensionId, options: {
    readonly folderMap: Record<string, string>;
    readonly browserModules: readonly string[];
    readonly mainProcessModules: readonly string[];
  }): void;
}

/**
 * Try patching VS Code to enable advanced features of Dance.
 */
export async function tryPatchVscode(extensionPath: vscode.Uri) {
  const monkeyPatch = await vscode.extensions.getExtension<MonkeyPatch>("iocave.monkey-patch")?.activate();

  if (monkeyPatch?.active()) {
    monkeyPatch.contribute(extensionId, {
      folderMap: {
        "dance-modules": vscode.Uri.joinPath(extensionPath, "src/injected").fsPath,
      },
      browserModules: [
        "dance-modules/browser",
      ],
      mainProcessModules: [
        // "dance-modules/main-process",
      ],
    });
  }
}
