import * as vscode from "vscode";

/**
 * Watches extensions, displaying warnings if potential conflicts are detected.
 */
export function watchKeymaps(): vscode.Disposable {
  return vscode.extensions.onDidChange(checkKeymaps);
}

function checkKeymaps(): void {
  /** Map from mode name to contributing extensions. */
  const contributedModes = new Map<string, string[]>();
  let hasConflict = false;

  // Find extensions that contribute Dance modes.
  for (const extension of vscode.extensions.all) {
    const packageJSON = extension.packageJSON;
    const modes = packageJSON?.contributes?.configurationDefaults
      ?.["dance.modes"];

    if (typeof modes !== "object") {
      continue;
    }

    const extensionName = extension.packageJSON?.displayName ??
      extension.packageJSON?.name;
    const extensionDisplayName = extensionName === undefined
      ? extension.id
      : `${extensionName} (${extension.id})`;

    for (const mode in modes) {
      const existing = contributedModes.get(mode);

      if (existing === undefined) {
        contributedModes.set(mode, [extensionDisplayName]);
      } else {
        existing.push(extensionDisplayName);
        hasConflict = true;
      }
    }
  }

  if (!hasConflict) {
    return;
  }

  // Aggregate conflicting extensions.
  const conflictingExtensions = new Set<string>();

  for (const extensionNames of contributedModes.values()) {
    if (extensionNames.length > 1) {
      for (const extensionName of extensionNames) {
        conflictingExtensions.add(extensionName);
      }
    }
  }

  // Display error message.
  vscode.window.showWarningMessage(
    `Multiple extensions contribute conflicting Dance modes: ${
      Array.from(conflictingExtensions).sort().join(", ")
    }`,
  );
}
