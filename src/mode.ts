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
  private _lineHighlight?: string;
  private _lineNumbers = vscode.TextEditorLineNumbersStyle.On;
  private _selectionDecorationOptions?: vscode.DecorationRenderOptions;
  private _selectionDecorationType?: vscode.TextEditorDecorationType;
  private _selectionBehavior = SelectionBehavior.Caret;
  private _onEnterMode: readonly command.Any[] = [];
  private _onLeaveMode: readonly command.Any[] = [];

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

  public get lineDecorationType() {
    return this._lineDecorationType;
  }

  public get selectionDecorationOptions() {
    return this._selectionDecorationOptions;
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

  public constructor(
    public readonly modes: Modes,
    public readonly name: string,
    rawConfiguration: Mode.Configuration,
    public isPendingDeletion = false,
  ) {
    this._inheritsFrom = modes.vscodeMode;
    this._raw = rawConfiguration;

    this.apply(rawConfiguration, new SettingsValidator());
  }

  public dispose() {
    this._onDeleted.fire(this);

    this._onChanged.dispose();
    this._onDeleted.dispose();
  }

  public update<K extends string & keyof this>(key: `_${K}`, value: this[K]) {
    if (this[key as keyof this] === value) {
      return;
    }

    this[key as keyof this] = value;
    this._onChanged.fire([this, [key.slice(1) as keyof Mode]]);
  }

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
          map = <RN extends keyof Mode.Configuration, N extends keyof Mode>(
            rawName: RN,
            name: N,
            convert: (value: Exclude<Mode.Configuration[RN], null | undefined>,
                      validator: SettingsValidator) => Mode[N],
          ) => {
            const value = raw[rawName];

            if (value === undefined) {
              // Unspecified: use parent value.
              return up[name];
            }
            if (value === null) {
              // Null: use VS Code value.
              return top[name];
            }

            return convert(value as any, validator);
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

    // Line highlight.
    const lineHighlight = map("lineHighlight", "lineHighlight", (value) => value);

    if (this._lineHighlight !== lineHighlight) {
      this._lineHighlight = lineHighlight;
      changedProperties.push("lineHighlight", "lineDecorationType");

      this._lineDecorationType?.dispose();

      if (lineHighlight === undefined || lineHighlight.length === 0) {
        this._lineDecorationType = undefined;
      } else {
        this._lineDecorationType = vscode.window.createTextEditorDecorationType({
          backgroundColor: lineHighlight[0] === "#"
            ? lineHighlight
            : new vscode.ThemeColor(lineHighlight),
          isWholeLine: true,
        });
      }
    }

    // Selection decorations.
    const selectionDecorationOptions = map("selectionStyle", "selectionDecorationOptions",
                                           Mode.decorationObjectToDecorationRenderOptions);

    if (selectionDecorationOptions !== undefined) {
      const currentOptions = this._selectionDecorationOptions;
      let changed = false;

      if (currentOptions === undefined) {
        changed = true;
      } else {
        const currentKeys = new Set(Object.keys(currentOptions));

        for (const key in selectionDecorationOptions) {
          if (!currentKeys.delete(key)) {
            changed = true;
            break;
          }
        }

        if (!changed && currentKeys.size > 0) {
          changed = true;
        }

        if (!changed) {
          for (const key in currentOptions) {
            const currentValue = currentOptions[key as keyof typeof currentOptions],
                  value = selectionDecorationOptions[key as keyof typeof currentOptions];

            if (currentValue !== value) {
              changed = true;
              break;
            }
          }
        }
      }

      if (changed) {
        this._selectionDecorationOptions = selectionDecorationOptions;
        this._selectionDecorationType?.dispose();
        this._selectionDecorationType
          = vscode.window.createTextEditorDecorationType(selectionDecorationOptions);
        changedProperties.push("selectionDecorationType", "selectionDecorationOptions");
      }
    } else if (this._selectionDecorationOptions !== undefined) {
      this._selectionDecorationOptions = undefined;
      this._selectionDecorationType?.dispose();
      this._selectionDecorationType = undefined;
      changedProperties.push("selectionDecorationType", "selectionDecorationOptions");
    }

    // Events (subscribers don't care about changes to these properties, so we
    // don't add them to the `changedProperties`).
    this._onEnterMode = raw.onEnterMode ?? [];
    this._onLeaveMode = raw.onLeaveMode ?? [];

    if (changedProperties.length > 0) {
      this._onChanged.fire([this, changedProperties]);
    }
  }

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

  public static selectionBehaviorStringToSelectionBehavior(
    behavior: "caret" | "character",
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

  public static decorationObjectToDecorationRenderOptions(
    object: Mode.Configuration.Decoration,
    validator: SettingsValidator,
  ) {
    const options: vscode.DecorationRenderOptions = {};

    for (const name of ["backgroundColor", "borderColor"] as const) {
      const value = object[name];

      if (value) {
        options[name] = value[0] === "#" ? value : new vscode.ThemeColor(value);
      }
    }

    for (const name of ["borderStyle"] as const) {
      const value = object[name];

      if (value) {
        options[name] = name;
      }
    }

    for (const name of ["borderRadius", "borderWidth"] as const) {
      const value = object[name];

      if (value) {
        options[name] = name;
      }
    }

    return options;
  }
}

export namespace Mode {
  /**
   * The configuration of a `Mode` as specified in the user preferences.
   */
  export interface Configuration {
    readonly cursorStyle?: Configuration.CursorStyle;
    readonly inheritFrom?: string | null;
    readonly lineHighlight?: string | null;
    readonly lineNumbers?: Configuration.LineNumbers;
    readonly onEnterMode?: readonly command.Any[];
    readonly onLeaveMode?: readonly command.Any[];
    readonly selectionBehavior?: Configuration.SelectionBehavior | null;
    readonly selectionStyle?: Configuration.Decoration;
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
      readonly backgroundColor?: string;
      readonly borderColor?: string;
      readonly borderStyle?: string;
      readonly borderRadius?: string;
      readonly borderWidth?: string;
    }
  }
}

/**
 * The set of all modes.
 */
export class Modes {
  /**
   * The "VS Code" mode, which represents the settings assigned to the editor
   * without taking Dance settings into account.
   */
  private readonly _vscodeMode = new Mode(this, "", {
    cursorStyle: "line",
    inheritFrom: null,
    lineHighlight: null,
    lineNumbers: "on",
    selectionBehavior: "caret",
    selectionStyle: {},
  });
  private readonly _modes = new Map<string, Mode>([]);

  private _defaultMode: Mode = new Mode(this, "default", {});
  private _expectedDefaultModeName: string = "default";

  public constructor() {
    this._modes.set("default", this._defaultMode);
  }

  public get defaultMode() {
    return this._defaultMode;
  }

  public get vscodeMode() {
    return this._vscodeMode;
  }

  public get(name: string) {
    return this._modes.get(name);
  }

  public getOrCreateDummy(name: string) {
    let mode = this._modes.get(name);

    if (mode === undefined) {
      this._modes.set(name, mode = new Mode(this, name, {}, /* isPendingDeletion= */ true));
    }

    return mode;
  }

  public observePreferences(extension: Extension) {
    extension.observePreference<Modes.Configuration>(".modes", undefined, (value, validator) => {
      let isEmpty = true;
      const removeModes = new Set(this._modes.keys()),
            expectedDefaultModeName = this._expectedDefaultModeName;

      for (const modeName in value) {
        removeModes.delete(modeName);

        let mode = this._modes.get(modeName);
        const configuration = value[modeName];

        if (mode === undefined) {
          this._modes.set(modeName, mode = new Mode(this, modeName, configuration));

          if (modeName === expectedDefaultModeName) {
            this._defaultMode.dispose();
            this._defaultMode = mode;
          }
        } else {
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

    extension.observePreference<string>(".defaultMode", undefined, (value, validator) => {
      const mode = this._modes.get(value);

      this._expectedDefaultModeName = value;

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
      undefined,
      (value) => {
        this._vscodeMode.update(
          "_cursorStyle",
          Mode.cursorStyleStringToCursorStyle(value, new SettingsValidator()),
        );
      },
      true,
    );

    extension.observePreference<Mode.Configuration.LineNumbers>(
      "editor.lineNumbers",
      undefined,
      (value) => {
        this._vscodeMode.update(
          "_lineNumbers",
          Mode.lineNumbersStringToLineNumbersStyle(value, new SettingsValidator()),
        );
      },
      true,
    );

    // Deprecated options.
    extension.observePreference<Mode.Configuration.SelectionBehavior>(
      ".selectionBehavior",
      undefined,
      (value) => {
        this._vscodeMode.update(
          "_selectionBehavior",
          value === "caret" ? SelectionBehavior.Caret : SelectionBehavior.Character,
        );
      },
      true,
    );

    for (const [modeName, defaultValue] of [
      ["normal", "editor.hoverHighlightBackground"] as const,
      ["insert", null] as const,
    ]) {
      extension.observePreference<string | null>(
        `.${modeName}.lineHighlight`,
        defaultValue,
        (value) => {
          const mode = this.get(modeName);

          if (mode !== undefined) {
            // TODO
          }
        },
        true,
      );
    }

    for (const [modeName, defaultValue] of [
      ["normal", "relative"] as const,
      ["insert", "inherit"] as const,
    ]) {
      extension.observePreference<string | null>(
        `.${modeName}.lineNumbers`,
        defaultValue,
        (value) => {
          const mode = this.get(modeName);

          if (mode !== undefined) {
            // TODO
          }
        },
        true,
      );
    }

    for (const modeName of ["normal", "insert"]) {
      extension.observePreference<string | null>(
        `.${modeName}.cursorStyle`,
        "inherit",
        (value) => {
          const mode = this.get(modeName);

          if (mode !== undefined) {
            // TODO
          }
        },
        true,
      );
    }

    extension.observePreference<Record<string, string | vscode.ThemeColor>>(
      ".insertMode.selectionStyle",
      {},
      (value) => {
        if (typeof value !== "object" || value === null) {
          return;
        }

        for (const key in value) {
          const val = value[key];

          if (typeof val !== "string") {
            return;
          }
          if (val.startsWith("$")) {
            value[key] = new vscode.ThemeColor(val.substr(1));
          }
        }

        // TODO
        // this.insertModeSelectionStyle?.dispose();
        // this.insertModeSelectionStyle = vscode.window.createTextEditorDecorationType(value);
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
