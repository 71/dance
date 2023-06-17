import * as vscode from "vscode";

import type { Extension } from "./extension";
import { command, SelectionBehavior } from "../api";
import { extensionName } from "../utils/constants";
import { SettingsValidator } from "../utils/settings-validator";

/**
 * An editing mode.
 */
export class Mode {
  private readonly _onChanged = new vscode.EventEmitter<readonly [Mode, readonly (keyof Mode)[]]>();
  private readonly _onDeleted = new vscode.EventEmitter<Mode>();
  private _changeSubscription: vscode.Disposable | undefined;

  private _raw: Mode.Configuration = {};
  private _inheritsFrom: Mode;
  private _cursorStyle = vscode.TextEditorCursorStyle.Line;
  private _lineHighlight?: string | vscode.ThemeColor;
  private _lineNumbers = vscode.TextEditorLineNumbersStyle.On;
  private _selectionDecorationType?: vscode.TextEditorDecorationType;
  private _hiddenSelectionsIndicatorsDecorationType?: vscode.TextEditorDecorationType;
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

  public get hiddenSelectionsIndicatorsDecorationType() {
    return this._hiddenSelectionsIndicatorsDecorationType;
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

  /**
   * @deprecated Avoid using this property directly.
   */
  public get raw() {
    return this._raw;
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

    this._changeSubscription = this._inheritsFrom?.onChanged(this._onParentModeChanged, this);
  }

  /**
   * Disposes of the mode.
   */
  public dispose() {
    this._changeSubscription?.dispose();

    this._onDeleted.fire(this);

    this._onChanged.dispose();
    this._onDeleted.dispose();
  }

  private _onParentModeChanged([inheritFrom, keys]: readonly [Mode, readonly (keyof Mode)[]]) {
    const updated = [] as (keyof Mode)[];

    for (const key of keys) {
      if (inheritFrom[key] !== this[key] && key !== "inheritsFrom") {
        updated.push(key);
      }
    }

    if (updated.length > 0) {
      this.apply(this._raw, new SettingsValidator());
      this._onChanged.fire([this, updated]);
    }
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
      this._changeSubscription?.dispose();
      this._inheritsFrom = willInheritFrom;
      this._changeSubscription = willInheritFrom.onChanged(this._onParentModeChanged, this);
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

    // Hidden selections indicators decorations.
    const hiddenSelectionsIndicatorsDecoration = map(
      "hiddenSelectionsIndicatorsDecoration", "hiddenSelectionsIndicatorsDecorationType",
      Mode.decorationObjectToDecorationRenderOptions);

    if (hiddenSelectionsIndicatorsDecoration === undefined
        || Object.keys(hiddenSelectionsIndicatorsDecoration).length === 0) {
      if (this._raw?.hiddenSelectionsIndicatorsDecoration != null) {
        this._hiddenSelectionsIndicatorsDecorationType!.dispose();
      }

      this._hiddenSelectionsIndicatorsDecorationType = undefined;
      changedProperties.push("hiddenSelectionsIndicatorsDecorationType");
    } else if (hiddenSelectionsIndicatorsDecoration
               !== this._hiddenSelectionsIndicatorsDecorationType) {
      if ("key" in hiddenSelectionsIndicatorsDecoration) {
        // Existing TextEditorDecorationType inherited from `up` or `top`.
        this._hiddenSelectionsIndicatorsDecorationType = hiddenSelectionsIndicatorsDecoration;
        changedProperties.push("hiddenSelectionsIndicatorsDecorationType");
      } else if (JSON.stringify(raw.hiddenSelectionsIndicatorsDecoration)
                 !== JSON.stringify(this._raw.hiddenSelectionsIndicatorsDecoration)) {
        // New DecorationRenderOptions we just parsed.
        this._hiddenSelectionsIndicatorsDecorationType =
          vscode.window.createTextEditorDecorationType(hiddenSelectionsIndicatorsDecoration);
        changedProperties.push("hiddenSelectionsIndicatorsDecorationType");
      }
    }

    // Events (subscribers don't care about changes to these properties, so we
    // don't add them to the `changedProperties`).
    this._onEnterMode = raw.onEnterMode ?? [];
    this._onLeaveMode = raw.onLeaveMode ?? [];

    // Save raw JSON for future reference and notify subscribers of changes.
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
    root = true,
  ) {
    const options: vscode.DecorationRenderOptions = {};

    for (const name of ["backgroundColor", "borderColor"] as const) {
      const value = object[name];

      if (value) {
        validator.forProperty(name, (v) => options[name] = Mode.stringToColor(value, v, "#000"));
      }
    }

    for (const name of ["borderRadius", "borderStyle", "borderWidth", "fontStyle"] as const) {
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

    if (root) {
      for (const name of ["after", "before"] as const) {
        const value = object[name];

        if (value != null) {
          validator.forProperty(
            name,
            (v) => options[name] = Mode.decorationObjectToDecorationRenderOptions(
              value, v, /* root= */ false),
          );
        }
      }
    } else {
      for (const name of ["color"] as const) {
        const value = (object as any)[name];

        if (value != null) {
          validator.forProperty(name, (v) => options[name] = Mode.stringToColor(value, v, "#000"));
        }
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

export declare namespace Mode {
  /**
   * The configuration of a `Mode` as specified in the user preferences.
   */
  export interface Configuration {
    cursorStyle?: Configuration.CursorStyle;
    decorations?: Configuration.Decoration[] | Configuration.Decoration;
    hiddenSelectionsIndicatorsDecoration?: Configuration.Decoration;
    inheritFrom?: string | null;
    lineHighlight?: string | null;
    lineNumbers?: Configuration.LineNumbers;
    onEnterMode?: readonly command.Any[];
    onLeaveMode?: readonly command.Any[];
    selectionBehavior?: Configuration.SelectionBehavior | null;
  }

  /**
   * A mode decoration.
   */
  export interface Decoration {
    readonly applyTo: "all" | "main" | "secondary";
    readonly renderOptions: vscode.DecorationRenderOptions;
    readonly type: vscode.TextEditorDecorationType;
  }

  export /* enum */ namespace Configuration {
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
      readonly after?: Omit<Decoration, "after" | "applyTo" | "before"> & { color: string };
      readonly before?: Omit<Decoration, "after" | "applyTo" | "before"> & { color: string };
      readonly backgroundColor?: string;
      readonly borderColor?: string;
      readonly borderStyle?: string;
      readonly borderRadius?: string;
      readonly borderWidth?: string;
      readonly fontStyle?: string;
      readonly isWholeLine?: boolean;
    }
  }
}

/**
 * The set of all modes.
 */
export class Modes implements Iterable<Mode> {
  private readonly _vscodeModeDefaults: Mode.Configuration = {
    cursorStyle: "line",
    inheritFrom: null,
    lineHighlight: null,
    lineNumbers: "on",
    selectionBehavior: "caret",
    decorations: [],
  };
  private readonly _vscodeMode = new Mode(this, "", undefined!);

  private readonly _inputModeDefaults: Mode.Configuration = {
    cursorStyle: "underline-thin",
  };
  private readonly _inputMode = new Mode(this, "input", this._inputModeDefaults);

  private readonly _modes = new Map<string, Mode>();

  private _defaultMode = new Mode(this, "default", {});

  public constructor(extension: Extension) {
    for (const builtin of [this._defaultMode, this._inputMode, this._vscodeMode]) {
      this._modes.set(builtin.name, builtin);
    }

    this._vscodeMode.apply(this._vscodeModeDefaults, new SettingsValidator());
    this._observePreferences(extension);
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

  public [Symbol.iterator]() {
    return this._modes.values();
  }

  public *userModes() {
    for (const mode of this._modes.values()) {
      if (mode.name !== "input" && !mode.isPendingDeletion) {
        yield mode;
      }
    }
  }

  /**
   * Starts listening to changes in user preferences that may lead to updates to
   * user modes.
   */
  private _observePreferences(extension: Extension) {
    // Mode definitions.
    extension.observePreference<Modes.Configuration>(".modes", (value, validator, inspect) => {
      let isEmpty = true;
      const removeModes = new Set(this._modes.keys()),
            expectedDefaultModeName = vscode.workspace.getConfiguration(extensionName)
              .get<string>("defaultMode");

      removeModes.delete(this.inputMode.name);
      removeModes.delete(this._defaultMode.name);

      for (const modeName in value) {
        removeModes.delete(modeName);

        let mode = this._modes.get(modeName),
            configuration = value[modeName];

        if (mode === this._vscodeMode) {
          configuration = { ...this._vscodeModeDefaults, ...configuration };
        } else if (mode === this._inputMode) {
          configuration = { ...this._inputModeDefaults, ...configuration };
        } else {
          isEmpty = false;
        }

        if (!vscode.workspace.isTrusted) {
          const globalConfig = inspect.globalValue?.[modeName],
                defaultConfig = inspect.defaultValue?.[modeName];

          if (globalConfig !== undefined || defaultConfig !== undefined) {
            // Mode is a global mode; make sure that the local workspace does not
            // override its `on{Enter,Leave}Mode` hooks (to make sure loading a
            // workspace will not execute arbitrary code).
            configuration.onEnterMode = globalConfig?.onEnterMode ?? defaultConfig?.onEnterMode;
            configuration.onLeaveMode = globalConfig?.onLeaveMode ?? defaultConfig?.onLeaveMode;
          }
        }

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
      if (value === "input" || value === "") {
        return validator.reportInvalidSetting(`mode cannot be used as default: "${value}"`);
      }

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
        this._vscodeModeDefaults.cursorStyle = value;
        this._vscodeMode.apply({ ...this._vscodeModeDefaults }, validator);
      },
      true,
    );

    extension.observePreference<Mode.Configuration.LineNumbers>(
      "editor.lineNumbers",
      (value, validator) => {
        this._vscodeModeDefaults.lineNumbers = value;
        this._vscodeMode.apply({ ...this._vscodeModeDefaults }, validator);
      },
      true,
    );
  }
}

export declare namespace Modes {
  export interface Configuration {
    readonly [modeName: string]: Mode.Configuration;
  }
}
