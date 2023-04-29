import * as vscode from "vscode";

import { Editors } from "./editors";
import { Modes } from "./modes";
import { Recorder } from "./recorder";
import { Register, Registers } from "./registers";
import { RegistersView } from "./registers-view";
import { StatusBar } from "./status-bar";
import { Menu, validateMenu } from "../api";
import type { Commands } from "../commands";
import { extensionName } from "../utils/constants";
import { AutoDisposable } from "../utils/disposables";
import { assert, CancellationError } from "../utils/errors";
import { SettingsValidator } from "../utils/settings-validator";
import { onDidLoadTreeSitter, type TreeSitter } from "../utils/tree-sitter";

// ===============================================================================================
// ==  EXTENSION  ================================================================================
// ===============================================================================================

/**
 * Global state of the extension.
 */
export class Extension implements vscode.Disposable {
  // Misc.
  private readonly _configurationChangeHandlers = new Map<string, () => void>();
  private readonly _subscriptions: vscode.Disposable[] = [];

  // Configuration.
  // ==========================================================================

  private readonly _gotoMenus = new Map<string, Menu>();

  public get menus() {
    return this._gotoMenus as ReadonlyMap<string, Menu>;
  }

  // State.
  // ==========================================================================

  private _treeSitter?: TreeSitter;

  /**
   * `StatusBar` for this instance of the extension.
   */
  public readonly statusBar = new StatusBar();

  /**
   * `Registers` for this instance of the extension.
   */
  public readonly registers = new Registers(this);

  /**
   * `Modes` for this instance of the extension.
   */
  public readonly modes = new Modes(this);

  /**
   * `Recorder` for this instance of the extension.
   */
  public readonly recorder: Recorder;  // Needs to be initialized later.

  /**
   * `Editors` for this instance of the extension.
   */
  public readonly editors = new Editors(this);

  // Ephemeral state needed by commands.
  // ==========================================================================

  private _currentCount = 0;
  private _currentRegister?: Register;

  /**
   * The counter for the next command.
   */
  public get currentCount() {
    return this._currentCount;
  }

  public set currentCount(count: number) {
    this._currentCount = count;

    if (count !== 0) {
      this.statusBar.countSegment.setContent(count.toString());
    } else {
      this.statusBar.countSegment.setContent();
    }
  }

  /**
   * The register to use in the next command.
   */
  public get currentRegister() {
    return this._currentRegister;
  }

  public set currentRegister(register: Register | undefined) {
    this._currentRegister = register;

    if (register !== undefined) {
      this.statusBar.registerSegment.setContent(register.name);
    } else {
      this.statusBar.registerSegment.setContent();
    }
  }

  public treeSitterOrThrow(): TreeSitter {
    if (this._treeSitter === undefined) {
      throw new Error("TreeSitter is not available");
    }

    return this._treeSitter;
  }

  public constructor(public readonly commands: Commands) {
    this.recorder = new Recorder(this);

    // Configuration: menus.
    this.observePreference<Record<string, Menu>>(
      ".menus",
      (value, validator, inspect) => {
        this._gotoMenus.clear();

        if (typeof value !== "object" || value === null) {
          validator.reportInvalidSetting("must be an object");
          return;
        }

        for (const menuName in value) {
          const menu = value[menuName],
                validationErrors = validateMenu(menu);

          if (validationErrors.length === 0) {
            if (!vscode.workspace.isTrusted) {
              const globalConfig = inspect.globalValue?.[menuName],
                    defaultConfig = inspect.defaultValue?.[menuName];

              if (globalConfig !== undefined || defaultConfig !== undefined) {
                // Menu is a global menu; make sure that the local workspace does
                // not override its items.
                for (const key in menu.items) {
                  if (globalConfig !== undefined && key in globalConfig.items) {
                    menu.items[key] = globalConfig.items[key];
                  } else if (defaultConfig !== undefined && key in defaultConfig.items) {
                    menu.items[key] = defaultConfig.items[key];
                  }
                }
              }
            }

            this._gotoMenus.set(menuName, menu);
          } else {
            validator.enter(menuName);

            for (const error of validationErrors) {
              validator.reportInvalidSetting(error);
            }

            validator.leave();
          }
        }
      },
      true,
    );

    this._subscriptions.push(
      // Update configuration automatically.
      vscode.workspace.onDidChangeConfiguration((e) => {
        for (const [section, handler] of this._configurationChangeHandlers.entries()) {
          if (e.affectsConfiguration(section)) {
            handler();
          }
        }
      }),
    );

    // Register all commands.
    for (const descriptor of Object.values(commands)) {
      this._subscriptions.push(descriptor.register(this));
    }

    // Render views.
    this._subscriptions.push(new RegistersView(this.registers).register());

    // Tree Sitter support.
    this._subscriptions.push(onDidLoadTreeSitter((treeSitter) => this._treeSitter = treeSitter));
  }

  /**
   * Disposes of the extension and all of its resources and subscriptions.
   */
  public dispose() {
    this._cancellationTokenSource.cancel();
    this._cancellationTokenSource.dispose();

    this._autoDisposables.forEach((disposable) => disposable.dispose());

    assert(this._autoDisposables.size === 0);

    this.statusBar.dispose();
  }

  /**
   * Listen for changes to the specified preference and calls the given handler
   * when a change occurs.
   *
   * Must be called in the constructor.
   *
   * @param triggerNow If `true`, the handler will also be triggered immediately
   *   with the current value.
   */
  public observePreference<T>(
    section: string,
    handler: (value: T, validator: SettingsValidator, inspect: InspectType<T>) => void,
    triggerNow = false,
  ) {
    let configuration: vscode.WorkspaceConfiguration,
        fullName: string;

    if (section[0] === ".") {
      fullName = extensionName + section;
      section = section.slice(1);
      configuration = vscode.workspace.getConfiguration(extensionName);
    } else {
      fullName = section;
      configuration = vscode.workspace.getConfiguration();
    }

    const defaultValue = configuration.inspect<T>(section)!.defaultValue!;

    this._configurationChangeHandlers.set(fullName, () => {
      const validator = new SettingsValidator(fullName),
            topSection = fullName === section ? undefined : extensionName,
            configuration = vscode.workspace.getConfiguration(topSection);

      handler(
        configuration.get<T>(section, defaultValue),
        validator,
        handler.length > 2 ? configuration.inspect<T>(section)! : undefined!,
      );

      validator.displayErrorIfNeeded();
    });

    if (triggerNow) {
      const validator = new SettingsValidator(fullName);

      handler(
        configuration.get(section, defaultValue),
        validator,
        handler.length > 2 ? configuration.inspect<T>(section)! : undefined!,
      );

      validator.displayErrorIfNeeded();
    }
  }

  // =============================================================================================
  // ==  CANCELLATION  ===========================================================================
  // =============================================================================================

  private _cancellationTokenSource = new vscode.CancellationTokenSource();
  private readonly _cancellationReasons =
    new WeakMap<vscode.CancellationToken, CancellationError.Reason>();

  /**
   * The token for the next command.
   */
  public get cancellationToken() {
    return this._cancellationTokenSource.token;
  }

  /**
   * The reason why the `cancellationToken` was cancelled.
   */
  public cancellationReasonFor(token: vscode.CancellationToken) {
    return this._cancellationReasons.get(token);
  }

  /**
   * Requests the cancellation of the last operation.
   */
  public cancelLastOperation(reason: CancellationError.Reason) {
    this._cancellationReasons.set(this._cancellationTokenSource.token, reason);

    this._cancellationTokenSource.cancel();
    this._cancellationTokenSource.dispose();

    this._cancellationTokenSource = new vscode.CancellationTokenSource();
  }

  // =============================================================================================
  // ==  DISPOSABLES  ============================================================================
  // =============================================================================================

  private readonly _autoDisposables = new Set<AutoDisposable>();

  /**
   * Returns an `AutoDisposable` bound to this extension. It is ensured that any
   * disposable added to it will be disposed of when the extension is unloaded.
   */
  public createAutoDisposable() {
    const disposable = new AutoDisposable();

    disposable.addDisposable({
      dispose: () => this._autoDisposables.delete(disposable),
    });

    this._autoDisposables.add(disposable);

    return disposable;
  }

  // =============================================================================================
  // ==  ERRORS  =================================================================================
  // =============================================================================================

  private _dismissErrorMessage?: () => void;
  private _lastErrorMessage?: string;

  /**
   * The last error message reported via `showDismissibleErrorMessage`.
   */
  public get lastErrorMessage() {
    return this._lastErrorMessage;
  }

  /**
   * Dismisses a currently shown error message, if any.
   */
  public dismissErrorMessage() {
    if (this._dismissErrorMessage !== undefined) {
      this._dismissErrorMessage();
      this._dismissErrorMessage = undefined;
    }
  }

  /**
   * Displays a dismissible error message in the status bar.
   */
  public showDismissibleErrorMessage(message: string) {
    // Log the error so that long error messages and stacktraces can still be
    // accessed by the user.
    this._lastErrorMessage = message;

    console.error(message);

    message = message.replace(/^error executing command "(.+?)": /, "");

    if (this.statusBar.errorSegment.content !== undefined) {
      return this.statusBar.errorSegment.setContent(message);
    }

    this.statusBar.errorSegment.setContent(message);

    const dispose = () => {
      this.statusBar.errorSegment.setContent();
      this._dismissErrorMessage = undefined;
      subscriptions.splice(0).forEach((d) => d.dispose());
    };

    const subscriptions = [
      vscode.window.onDidChangeActiveTextEditor(dispose),
      vscode.window.onDidChangeTextEditorSelection(dispose),
    ];

    this._dismissErrorMessage = dispose;
  }

  /**
   * Runs the given function, displaying an error message and returning the
   * specified value if it throws an exception during its execution.
   */
  public runSafely<T>(
    f: () => T,
    errorValue: () => T,
    errorMessage: (error: any) => T extends Thenable<any> ? never : string,
  ) {
    this.dismissErrorMessage();

    try {
      return f();
    } catch (e) {
      if (!(e instanceof CancellationError)) {
        this.showDismissibleErrorMessage(errorMessage(e));
      }

      return errorValue();
    }
  }

  /**
   * Runs the given async function, displaying an error message and returning
   * the specified value if it throws an exception during its execution.
   */
  public async runPromiseSafely<T>(
    f: () => Thenable<T>,
    errorValue: () => T,
    errorMessage: (error: any) => string,
  ) {
    this.dismissErrorMessage();

    try {
      return await f();
    } catch (e) {
      if (!(e instanceof CancellationError)) {
        this.showDismissibleErrorMessage(errorMessage(e));
      }

      return errorValue();
    }
  }
}

type InspectUnknown = Exclude<ReturnType<vscode.WorkspaceConfiguration["inspect"]>, undefined>;
type InspectType<T> = {
  // Replace all properties that are `unknown` by `T | undefined`.
  readonly [K in keyof InspectUnknown]: (InspectUnknown[K] & null) extends never
    ? InspectUnknown[K]
    : T | undefined;
}
