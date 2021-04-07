import * as vscode from "vscode";

import { DocumentState } from "./document";
import { EditorState } from "./editor";
import { extensionName } from "../extension";
import { Register, Registers } from "../register";
import { assert, CancellationError, Menu, validateMenu } from "../api";
import { Modes } from "../mode";
import { SettingsValidator } from "../utils/settings-validator";
import { loadCommands } from "../commands/load-all";
import { Recorder } from "../api/record";
import { Commands } from "../commands";

// =============================================================================================
// ==  MODE-SPECIFIC CONFIGURATION  ============================================================
// =============================================================================================

export const enum SelectionBehavior {
  Caret = 1,
  Character = 2,
}

// ===============================================================================================
// ==  EXTENSION  ================================================================================
// ===============================================================================================

/**
 * Global state of the extension.
 */
export class Extension implements vscode.Disposable {
  // Events.
  private readonly configurationChangeHandlers = new Map<string, () => void>();
  private readonly subscriptions: vscode.Disposable[] = [];

  // Configuration.
  private readonly _gotoMenus = new Map<string, Menu>();

  public configuration = vscode.workspace.getConfiguration(extensionName);

  public get menus() {
    return this._gotoMenus as ReadonlyMap<string, Menu>;
  }

  // Commands.
  private _commands?: Commands;

  public get commands() {
    assert(this._commands !== undefined);

    return this._commands;
  }

  // General state.
  public readonly statusBarItem: vscode.StatusBarItem;

  public enabled: boolean = false;

  /**
   * The `CancellationTokenSource` for cancellable operations running in this
   * editor.
   */
  public cancellationTokenSource = new vscode.CancellationTokenSource();

  /**
   * `Registers` for this instance of the extension.
   */
  public readonly registers = new Registers();

  /**
   * `Modes` for this instance of the extension.
   */
  public readonly modes = new Modes();

  /**
   * `Recorder` for this instance of the extension.
   */
  public readonly recorder = new Recorder();

  // Ephemeral state needed by commands.
  public currentCount: number = 0;
  public currentRegister: Register | undefined = undefined;

  public constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(undefined, 100);
    this.statusBarItem.tooltip = "Current mode";

    // Configuration: modes.
    this.modes.observePreferences(this);

    // Configuration: menus.
    this.observePreference<Record<string, Menu>>(
      ".menus",
      {},
      (value) => {
        this._gotoMenus.clear();

        const validator = new SettingsValidator("menus");

        if (typeof value !== "object" || value === null) {
          validator.reportInvalidSetting("must be an object");
        }

        for (const menuName in value) {
          const menu = value[menuName],
                validationErrors = validateMenu(menu);

          if (validationErrors.length === 0) {
            this._gotoMenus.set(menuName, menu);
          } else {
            for (const error of validationErrors) {
              validator.reportInvalidSetting(`error in menu ${menuName}: ${error}`);
            }

            validator.displayErrorIfNeeded();
          }
        }
      },
      true,
    );

    // Lastly, enable the extension and set up modes.
    this.setEnabled(this.configuration.get("enabled", true), false);
  }

  /**
   * Disposes of the extension and all of its resources and subscriptions.
   */
  public dispose() {
    this.cancellationTokenSource?.cancel();
    this.setEnabled(false, false);
    this.statusBarItem.dispose();
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
    defaultValue: T | undefined,
    handler: (value: T, validator: SettingsValidator) => void,
    triggerNow = false,
  ) {
    let configuration: vscode.WorkspaceConfiguration,
        fullName: string;

    if (section[0] === ".") {
      fullName = extensionName + section;
      section = section.slice(1);
      configuration = this.configuration;
    } else {
      fullName = section;
      configuration = vscode.workspace.getConfiguration();
    }

    if (defaultValue === undefined) {
      defaultValue = configuration.inspect<T>(section)!.defaultValue!;
    }

    this.configurationChangeHandlers.set(fullName, () => {
      const validator = new SettingsValidator(fullName);

      handler(configuration.get(section, defaultValue!), validator);

      validator.displayErrorIfNeeded();
    });

    if (triggerNow) {
      const validator = new SettingsValidator(fullName);

      handler(configuration.get(section, defaultValue), validator);

      validator.displayErrorIfNeeded();
    }
  }

  public setEnabled(enabled: boolean, changeConfiguration: boolean) {
    if (enabled === this.enabled) {
      return;
    }

    this.subscriptions.splice(0).forEach((x) => x.dispose());

    if (!enabled) {
      this.statusBarItem.hide();

      for (const documentState of this.documentStates()) {
        documentState.dispose();
      }

      this._documentStates = new Map();
      this._commands = undefined;

      vscode.commands.executeCommand("setContext", extensionName + ".enabled", false);

      if (changeConfiguration) {
        vscode.workspace.getConfiguration(extensionName).update("enabled", false);
      }
    } else {
      this.statusBarItem.show();

      this.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
          this._activeEditorState?.onDidBecomeInactive();

          if (editor === undefined) {
            this._activeEditorState = undefined;
          } else {
            this._activeEditorState = this.getEditorState(editor);
            this._activeEditorState.onDidBecomeActive();
          }
        }),

        vscode.window.onDidChangeTextEditorSelection((e) => {
          this._documentStates
            .get(e.textEditor.document)
            ?.getEditorState(e.textEditor)
            ?.onDidChangeTextEditorSelection(e);
        }),

        vscode.workspace.onDidChangeTextDocument((e) => {
          this._documentStates.get(e.document)?.onDidChangeTextDocument(e);
        }),

        vscode.workspace.onDidChangeConfiguration((e) => {
          this.configuration = vscode.workspace.getConfiguration(extensionName);

          for (const [section, handler] of this.configurationChangeHandlers.entries()) {
            if (e.affectsConfiguration(section)) {
              handler();
            }
          }
        }),
      );

      loadCommands().then((commands) => {
        if (!this.enabled) {
          return;
        }

        this._commands = commands;

        for (const descriptor of Object.values(commands)) {
          this.subscriptions.push(descriptor.register(this));
        }
      });

      const activeEditor = vscode.window.activeTextEditor;

      if (activeEditor !== undefined) {
        this.getEditorState(activeEditor).onDidBecomeActive();
      }

      vscode.commands.executeCommand("setContext", extensionName + ".enabled", true);

      if (changeConfiguration) {
        vscode.workspace.getConfiguration(extensionName).update("enabled", true);
      }
    }

    return (this.enabled = enabled);
  }

  // =============================================================================================
  // ==  DOCUMENT AND EDITOR STATES  =============================================================
  // =============================================================================================

  private _documentStates = new WeakMap<vscode.TextDocument, DocumentState>();
  private _activeEditorState?: EditorState;

  /**
   * Returns the `EditorState` for the active `vscode.TextEditor`, or
   * `undefined` if `vscode.window.activeTextEditor === undefined`.
   */
  public get activeEditorState() {
    return this._activeEditorState;
  }

  /**
   * Returns the `DocumentState` for the given `vscode.TextDocument`.
   */
  public getDocumentState(document: vscode.TextDocument) {
    let state = this._documentStates.get(document);

    if (state === undefined) {
      this._documentStates.set(document, (state = new DocumentState(this, document)));
    }

    return state;
  }

  /**
   * Returns the `EditorState` for the given `vscode.TextEditor`.
   */
  public getEditorState(editor: vscode.TextEditor) {
    return this.getDocumentState(editor.document).getEditorState(editor);
  }

  /**
   * Returns an iterator over all known `DocumentState`s.
   */
  public *documentStates() {
    const documents = vscode.workspace.textDocuments,
          len = documents.length;

    for (let i = 0; i < len; i++) {
      const documentState = this._documentStates.get(documents[i]);

      if (documentState !== undefined) {
        yield documentState;
      }
    }
  }

  /**
   * Returns an iterator over all known `EditorState`s.
   */
  public *editorStates() {
    for (const documentState of this.documentStates()) {
      yield* documentState.editorStates();
    }
  }

  // =============================================================================================
  // ==  ERRORS  =================================================================================
  // =============================================================================================

  /**
   * Runs the given function, displaying an error message and returning the
   * specified value if it throws an exception during its execution.
   */
  public runSafely<T>(
    f: () => T,
    errorValue: () => T,
    errorMessage: (error: any) => T extends Thenable<any> ? never : string,
  ) {
    try {
      return f();
    } catch (e) {
      if (!(e instanceof CancellationError)) {
        vscode.window.showErrorMessage(errorMessage(e));
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
    try {
      return await f();
    } catch (e) {
      if (!(e instanceof CancellationError)) {
        vscode.window.showErrorMessage(errorMessage(e));
      }

      return errorValue();
    }
  }
}
