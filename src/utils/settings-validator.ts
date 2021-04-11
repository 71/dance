import * as vscode from "vscode";

/**
 * A class used to validate settings.
 */
export class SettingsValidator {
  public readonly path: string[] = [];
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

  public forProperty<T>(property: string, f: (validator: this) => T) {
    this.enter(property);

    try {
      return f(this);
    } finally {
      this.leave();
    }
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

    return vscode.window.showErrorMessage("Invalid settings: " + errors.join(" — "));
  }

  public throwErrorIfNeeded() {
    const errors = this.errors;

    if (errors.length === 0) {
      return;
    }

    throw new Error("Invalid settings: " + errors.join(" — "));
  }

  public static displayErrorIfNeeded<T>(path: string, f: (validator: SettingsValidator) => T) {
    const validator = new SettingsValidator(path),
          result = f(validator);
    validator.displayErrorIfNeeded();
    return result;
  }

  public static throwErrorIfNeeded<T>(path: string, f: (validator: SettingsValidator) => T) {
    const validator = new SettingsValidator(path),
          result = f(validator);
    validator.throwErrorIfNeeded();
    return result;
  }
}
