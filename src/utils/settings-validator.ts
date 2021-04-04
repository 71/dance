import * as vscode from "vscode";

/**
 * A class used to validate settings.
 */
export class SettingsValidator {
  public readonly path: string[] = ["dance"];
  public readonly errors: string[] = [];

  public constructor(...path: string[]) {
    this.path.push(...path);
  }

  public enter(property: string) {
    this.path.push(property);
  }

  public leave() {
    this.path.pop();
  }

  public reportInvalidSetting(message: string, name?: string) {
    const suffix = name === undefined ? "" : "." + name;

    this.errors.push(`${this.path.join(".")}${suffix}: ${message}`);
  }

  public displayErrorIfNeeded() {
    const errors = this.errors;

    if (errors.length === 0) {
      return;
    }

    return vscode.window.showInformationMessage("Invalid settings: " + errors.join(" — "));
  }

  public throwErrorIfNeeded() {
    const errors = this.errors;

    if (errors.length === 0) {
      return;
    }

    throw new Error("Invalid settings: " + errors.join(" — "));
  }
}
