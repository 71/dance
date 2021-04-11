import * as vscode from "vscode";
import { command } from "./api";
import { Extension, SelectionBehavior } from "./state/extension";
import { SettingsValidator } from "./utils/settings-validator";

/**
 * An editing mode.
 */
export class Mode {
  private readonly _onChanged = new vscode.EventEmitter<readonly [Mode, readonly (keyof Mode)[]]>();
  private readonly _onDeleted = new vscode.EventEmitter<Mode>();

  private _raw: Mode.Configuration = {};
  private _inheritsFrom: Mode;
  private _cursorStyle = vscode.TextEditorCursorStyle.Line;
  private _lineDecorationType?: vscode.TextEditorDecorationType;
  private _lineHighlight?: string | vscode.ThemeColor;
  private _lineNumbers = vscode.TextEditorLineNumbersStyle.On;
  private _selectionDecorationOptions?: vscode.DecorationRenderOptions;
  private _selectionDecorationType?: vscode.TextEditorDecorationType;
  private _selectionBehavior = SelectionBehavior.Caret;
  private _onEnterMode: readonly command.Any[] = [];
  private _onLeaveMode: readonly command.Any[] = [];
  private _decorations: readonly Mode.Decoration[] = [];

  public get onChanged() {
    return this._onChanged.event;
  }

  public get onDeleted() {
    return this._onDeleted.event;
  }

  public get inheritsFrom() {
    return this._inheritsFrom;
  }

  public get cursorStyle() {
    return this._cursorStyle;
  }

  public get lineNumbers() {
    return this._lineNumbers;
  }

  public get lineHighlight() {
    return this._lineHighlight;
  }

  public get selectionDecorationType() {
    return this._selectionDecorationType;
  }

  public get selectionBehavior() {
    return this._selectionBehavior;
  }

  public get onEnterMode() {
    return this._onEnterMode;
  }

  public get onLeaveMode() {
    return this._onLeaveMode;
  }

  public get decorations() {
    return this._decorations;
  }

  public constructor(
    public readonly modes: Modes,
    public readonly name: string,
    rawConfiguration: Mode.Configuration,
    public isPendingDeletion = false,
  ) {
    this._inheritsFrom = modes.vscodeMode;
    this._raw = {};

    if (rawConfiguration != null) {
      this.apply(rawConfiguration, new SettingsValidator());
    }
  }

  /**
   * Disposes of the mode.
   */
  public dispose() {
    this._onDeleted.fire(this);

    this._onChanged.dispose();
    this._onDeleted.dispose();
  }

  /**
   * Updates an underlying value of the mode.
   */
  public update<K extends string & keyof this>(key: `_${K}`, value: this[K]) {
    if (this[key as keyof this] === value) {
      return;
    }

    this[key as keyof this] = value;
    this._onChanged.fire([this, [key.slice(1) as keyof Mode]]);
  }

  /**
   * Applies a new configuration to the mode, notifying subscribers of changes
   * if needed.
   */
  public apply(raw: Mode.Configuration, validator: SettingsValidator) {
    const willInheritFrom = raw.inheritFrom == null
      ? this.modes.vscodeMode
      : this.modes.getOrCreateDummy(raw.inheritFrom);
    const changedProperties: (keyof Mode)[] = [];

    if (willInheritFrom !== this._inheritsFrom) {
      this._inheritsFrom = willInheritFrom;
      changedProperties.push("inheritsFrom");
    }

    const up = willInheritFrom,
          top = this.modes.vscodeMode,
          map = <RN extends keyof Mode.Configuration, N extends keyof Mode, C>(
            rawName: RN,
            name: N,
            convert: (value: Exclude<Mode.Configuration[RN], null | undefined>,
                      validator: SettingsValidator) => C,
          ) => {
            const value = raw[rawName];

            if (value === undefined || value === "inherit") {
              // Unspecified: use parent value.
              return up[name];
            }
            if (value === null) {
              // Null: use VS Code value.
              return top[name];
            }

            return validator.forProperty(rawName, (validator) => convert(value as any, validator));
          };

    // Cursor style.
    const cursorStyle = map("cursorStyle", "cursorStyle", Mode.cursorStyleStringToCursorStyle);

    if (this._cursorStyle !== cursorStyle) {
      this._cursorStyle = cursorStyle;
      changedProperties.push("cursorStyle");
    }

    // Line numbers.
    const lineNumbers = map("lineNumbers", "lineNumbers", Mode.lineNumbersStringToLineNumbersStyle);

    if (this._lineNumbers !== lineNumbers) {
      this._lineNumbers = lineNumbers;
      changedProperties.push("lineNumbers");
    }

    // Selection behavior.
    const selectionBehavior = map("selectionBehavior", "selectionBehavior",
                                  Mode.selectionBehaviorStringToSelectionBehavior);

    if (this._selectionBehavior !== selectionBehavior) {
      this._selectionBehavior = selectionBehavior;
      changedProperties.push("selectionBehavior");
    }

    // Selection decorations.
    const disposePreviousDecorations = this._raw?.decorations != null;
    let decorations = raw.decorations;

    if (decorations === undefined) {
      if (this._raw.decorations !== undefined) {
        if (disposePreviousDecorations) {
          this._decorations.forEach((d) => d.type.dispose());
        }

        this._decorations = up._decorations;
        changedProperties.push("decorations");
      }
    } else if (decorations === null) {
      if (this._raw.decorations !== null) {
        if (disposePreviousDecorations) {
          this._decorations.forEach((d) => d.type.dispose());
        }

        this._decorations = top._decorations;
        changedProperties.push("decorations");
      }
    } else if (JSON.stringify(decorations) !== JSON.stringify(this._raw?.decorations)) {
      if (!Array.isArray(decorations)) {
        decorations = [decorations as Mode.Configuration.Decoration];
      }

      if (disposePreviousDecorations) {
        this._decorations.forEach((d) => d.type.dispose());
      }

      validator.enter("decorations");

      this._decorations = decorations.flatMap((d) => {
        const validatorErrors = validator.errors.length,
              renderOptions = Mode.decorationObjectToDecorationRenderOptions(d, validator),
              applyTo = Mode.applyToStringToApplyTo(d.applyTo ?? "all", validator);

        if (validator.errors.length > validatorErrors) {
          return [];
        }

        return [{
          applyTo,
          renderOptions,
          type: vscode.window.createTextEditorDecorationType(renderOptions),
        }];
      });

      validator.leave();
      changedProperties.push("decorations");
    }

    // Events (subscribers don't care about changes to these properties, so we
    // don't add them to the `changedProperties`).
    this._onEnterMode = raw.onEnterMode ?? [];
    this._onLeaveMode = raw.onLeaveMode ?? [];
    this._raw = raw;

    if (changedProperties.length > 0) {
      this._onChanged.fire([this, changedProperties]);
    }
  }

  /**
   * Validates and converts a string to a `vscode.TextEditorLineNumbersStyle`
   * enum value.
   */
  public static lineNumbersStringToLineNumbersStyle(
    lineNumbers: Mode.Configuration.LineNumbers,
    validator: SettingsValidator,
  ) {
    switch (lineNumbers) {
    case "on":
      return vscode.TextEditorLineNumbersStyle.On;
    case "off":
      return vscode.TextEditorLineNumbersStyle.Off;
    case "relative":
      return vscode.TextEditorLineNumbersStyle.Relative;

    default:
      validator.reportInvalidSetting(`unrecognized lineNumbers "${lineNumbers}"`, "lineNumbers");
      return vscode.TextEditorLineNumbersStyle.On;
    }
  }

  /**
   * Validates and converts a string to a `vscode.TextEditorCursorStyle` enum
   * value.
   */
  public static cursorStyleStringToCursorStyle(
    cursorStyle: Mode.Configuration.CursorStyle,
    validator: SettingsValidator,
  ) {
    switch (cursorStyle) {
    case "block":
      return vscode.TextEditorCursorStyle.Block;
    case "block-outline":
      return vscode.TextEditorCursorStyle.BlockOutline;
    case "line":
      return vscode.TextEditorCursorStyle.Line;
    case "line-thin":
      return vscode.TextEditorCursorStyle.LineThin;
    case "underline":
      return vscode.TextEditorCursorStyle.Underline;
    case "underline-thin":
      return vscode.TextEditorCursorStyle.UnderlineThin;

    default:
      validator.reportInvalidSetting(`unrecognized cursorStyle "${cursorStyle}"`, "cursorStyle");
      return vscode.TextEditorCursorStyle.Line;
    }
  }

  /**
   * Validates and converts a string to a `SelectionBehavior` enum value.
   */
  public static selectionBehaviorStringToSelectionBehavior(
    behavior: Mode.Configuration.SelectionBehavior,
    validator: SettingsValidator,
  ) {
    switch (behavior) {
    case "character":
      return SelectionBehavior.Character;
    case "caret":
      return SelectionBehavior.Caret;

    default:
      validator.reportInvalidSetting(
        `unrecognized selectionBehavior "${behavior}"`,
        "selectionBehavior",
      );
      return SelectionBehavior.Caret;
    }
  }

  /**
   * Validates and converts a configuration decoration to an actual
   * `vscode.DecorationRenderOptions` object.
   */
  public static decorationObjectToDecorationRenderOptions(
    object: Mode.Configuration.Decoration,
    validator: SettingsValidator,
  ) {
    const options: vscode.DecorationRenderOptions = {};

    for (const name of ["backgroundColor", "borderColor"] as const) {
      const value = object[name];

      if (value) {
        validator.enter(name);
        options[name] = this.stringToColor(value, validator, "#000");
        validator.leave();
      }
    }

    for (const name of ["borderStyle"] as const) {
      const value = object[name];

      if (value) {
        options[name] = value;
      }
    }

    for (const name of ["isWholeLine"] as const) {
      const value = object[name];

      if (value != null) {
        options[name] = !!object[name];
      }
    }

    for (const name of ["borderRadius", "borderWidth"] as const) {
      const value = object[name];

      if (value) {
        options[name] = value;
      }
    }

    return options;
  }

  /**
   * Validates and converts a string value to a valid `applyTo` value.
   */
  public static applyToStringToApplyTo(value: string, validator: SettingsValidator) {
    const applyTo = value;

    if (!["all", "main", "secondary"].includes(applyTo)) {
      validator.reportInvalidSetting(`unrecognized applyTo ${JSON.stringify(applyTo)}`,
                                     "applyTo");

      return "all";
    }

    return applyTo as "all" | "main" | "secondary";
  }

  /**
   * Validates and converts a string value to a string color or
   * `vscode.ThemeColor`.
   */
  public static stringToColor(value: string, validator: SettingsValidator, invalidValue = "") {
    if (typeof value !== "string" || value.length === 0) {
      validator.reportInvalidSetting("color must be a non-empty string");

      return invalidValue;
    }

    if (value[0] === "$") {
      if (/^\$[\w]+(\.\w+)*$/.test(value)) {
        return new vscode.ThemeColor(value.slice(1));
      }

      validator.reportInvalidSetting("invalid color reference " + value);
      return invalidValue;
    }

    if (value[0] === "#") {
      if (/^#([a-fA-F0-9]{3}|[a-fA-F0-9]{6}|[a-fA-F0-9]{8})$/.test(value)) {
        return value;
      }

      validator.reportInvalidSetting("invalid color " + value);
      return invalidValue;
    }

    if (value.startsWith("rgb")) {
      if (/^rgb\( *\d+ *, *\d+ *, *\d+ *\)$|^rgba\( *\d+ *, *\d+ *, *\d+ *, *\d+ *\)$/.test(value)) {
        return value;
      }

      validator.reportInvalidSetting("invalid color " + value);
      return invalidValue;
    }

    validator.reportInvalidSetting("unknown color format " + value);
    return invalidValue;
  }
}

export namespace Mode {
  /**
   * The configuration of a `Mode` as specified in the user preferences.
   */
  export interface Configuration {
    readonly cursorStyle?: Configuration.CursorStyle;
    readonly decorations?: Configuration.Decoration[] | Configuration.Decoration;
    readonly inheritFrom?: string | null;
    readonly lineHighlight?: string | null;
    readonly lineNumbers?: Configuration.LineNumbers;
    readonly onEnterMode?: readonly command.Any[];
    readonly onLeaveMode?: readonly command.Any[];
    readonly selectionBehavior?: Configuration.SelectionBehavior | null;
  }

  /**
   * A mode decoration.
   */
  export interface Decoration {
    readonly applyTo: "all" | "main" | "secondary";
    readonly renderOptions: vscode.DecorationRenderOptions;
    readonly type: vscode.TextEditorDecorationType;
  }

  export namespace Configuration {
    /**
     * A valid cursor style value in a `Mode.Configuration`.
     */
    export type CursorStyle =
      | "line"
      | "block"
      | "underline"
      | "line-thin"
      | "block-outline"
      | "underline-thin";

    /**
     * A valid line numbers value in a `Mode.Configuration`.
     */
    export type LineNumbers = "on" | "off" | "relative";

    /**
     * A valid selection behavior value in a `Mode.Configuration`.
     */
    export type SelectionBehavior = "caret" | "character";

    /**
     * A decoration.
     */
    export interface Decoration {
      readonly applyTo?: "all" | "main" | "secondary";
      readonly backgroundColor?: string;
      readonly borderColor?: string;
      readonly borderStyle?: string;
      readonly borderRadius?: string;
      readonly borderWidth?: string;
      readonly isWholeLine?: boolean;
    }
  }
}

/**
 * The set of all modes.
 */
export class Modes {
  private readonly _modes = new Map<string, Mode>();

  private readonly _vscodeMode = new Mode(this, "", undefined!);
  private readonly _inputMode = new Mode(this, "input", undefined!);
  private _defaultMode = new Mode(this, "default", {});

  public constructor() {
    for (const builtin of [this._defaultMode, this._inputMode]) {
      this._modes.set(builtin.name, builtin);
    }

    this._vscodeMode.apply({
      cursorStyle: "line",
      inheritFrom: null,
      lineHighlight: null,
      lineNumbers: "on",
      selectionBehavior: "caret",
      decorations: [],
    }, new SettingsValidator());
  }

  /**
   * The default mode configured using `dance.defaultMode`.
   */
  public get defaultMode() {
    return this._defaultMode;
  }

  /**
   * The input mode, set when awaiting user input.
   */
  public get inputMode() {
    return this._inputMode;
  }

  /**
   * The "VS Code" mode, which represents the settings assigned to the editor
   * without taking Dance settings into account.
   */
  public get vscodeMode() {
    return this._vscodeMode;
  }

  /**
   * Returns the `Mode` with the given name, or `undefined` if no such mode is
   * defined.
   */
  public get(name: string) {
    return this._modes.get(name);
  }

  /**
   * Returns the `Mode` with the given name, or creates one if no such mode is
   * defined.
   */
  public getOrCreateDummy(name: string) {
    let mode = this._modes.get(name);

    if (mode === undefined) {
      this._modes.set(name, mode = new Mode(this, name, {}, /* isPendingDeletion= */ true));
    }

    return mode;
  }

  /**
   * Starts listening to changes in user preferences that may lead to updates to
   * user modes.
   */
  public observePreferences(extension: Extension) {
    // Mode definitions.
    extension.observePreference<Modes.Configuration>(".modes", (value, validator) => {
      let isEmpty = true;
      const removeModes = new Set(this._modes.keys()),
            expectedDefaultModeName = extension.configuration.get<string>("defaultMode");

      removeModes.delete(this.inputMode.name);

      for (const modeName in value) {
        removeModes.delete(modeName);

        if (modeName === "input" || modeName === "") {
          validator.reportInvalidSetting(`a mode cannot be named "${modeName}"`);
          continue;
        }

        let mode = this._modes.get(modeName);
        const configuration = value[modeName];

        if (mode === undefined) {
          this._modes.set(modeName, mode = new Mode(this, modeName, configuration));

          if (modeName === expectedDefaultModeName) {
            this._defaultMode.dispose();
            this._defaultMode = mode;
          }
        } else {
          mode.isPendingDeletion = false;
          mode.apply(configuration, validator);
        }

        isEmpty = false;
      }

      if (isEmpty) {
        validator.reportInvalidSetting("at least one mode must be defined");
      }

      const actualDefaultModeName = this._defaultMode.name;

      for (const modeName of removeModes) {
        if (modeName === actualDefaultModeName) {
          validator.reportInvalidSetting(
            "default mode was removed, please update dance.defaultMode",
          );
        } else {
          this._modes.get(modeName)!.dispose();
        }

        this._modes.delete(modeName);
      }
    }, true);

    // Default mode.
    extension.observePreference<string>(".defaultMode", (value, validator) => {
      const mode = this._modes.get(value);

      if (mode === undefined) {
        return validator.reportInvalidSetting("mode does not exist: " + value);
      }

      if (!this._modes.has(this._defaultMode.name)) {
        // Default mode had previously been deleted; we can now dispose of it.
        this._defaultMode.dispose();
      }

      this._defaultMode = mode;
    }, true);

    // VS Code settings.
    extension.observePreference<Mode.Configuration.CursorStyle>(
      "editor.cursorStyle",
      (value, validator) => {
        this._vscodeMode.update(
          "_cursorStyle",
          Mode.cursorStyleStringToCursorStyle(value, validator),
        );
      },
      true,
    );

    extension.observePreference<Mode.Configuration.LineNumbers>(
      "editor.lineNumbers",
      (value, validator) => {
        this._vscodeMode.update(
          "_lineNumbers",
          Mode.lineNumbersStringToLineNumbersStyle(value, validator),
        );
      },
      true,
    );
  }
}

export namespace Modes {
  export interface Configuration {
    readonly [modeName: string]: Mode.Configuration;
  }
}
