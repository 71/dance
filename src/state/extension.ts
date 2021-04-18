import * as vscode from "vscode";

import { DocumentState } from "./document-state";
import { EditorState } from "./editor-state";
import { extensionName } from "../extension";
import { Register, Registers } from "./registers";
import { assert, CancellationError, Menu, validateMenu } from "../api";
import { Modes } from "./modes";
import { SettingsValidator } from "../utils/settings-validator";
import { Recorder } from "./recorder";
import { Commands } from "../commands";
import { AutoDisposable } from "../utils/disposables";
import { StatusBar } from "./status-bar";

// ===============================================================================================
// ==  EXTENSION  ================================================================================
// ===============================================================================================

/**
 * Global state of the extension.
 */
export class Extension implements vscode.Disposable {
  // Events.
  // ==========================================================================

  private readonly _onModeDidChange = new vscode.EventEmitter<EditorState>();

  /**
   * An event which fires on editor mode change.
   */
  public readonly onModeDidChange = this._onModeDidChange.event;

  // Misc.
  private readonly configurationChangeHandlers = new Map<string, () => void>();
  private readonly subscriptions: vscode.Disposable[] = [];

  // Configuration.
  // ==========================================================================

  private readonly _gotoMenus = new Map<string, Menu>();

  public get menus() {
    return this._gotoMenus as ReadonlyMap<string, Menu>;
  }

  // State.
  // ==========================================================================

  /**
   * `StatusBar` for this instance of the extension.
   */
  public readonly statusBar = new StatusBar();

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
  public readonly recorder = new Recorder(this.statusBar);

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

  public constructor(public readonly commands: Commands) {
    // Configuration: modes.
    this.modes.observePreferences(this);

    // Configuration: menus.
    this.observePreference<Record<string, Menu>>(
      ".menus",
      (value, validator) => {
        this._gotoMenus.clear();

        if (typeof value !== "object" || value === null) {
          validator.reportInvalidSetting("must be an object");
          return;
        }

        for (const menuName in value) {
          const menu = value[menuName],
                validationErrors = validateMenu(menu);

          if (validationErrors.length === 0) {
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

    this.subscriptions.push(
      // Track visible editors.
      vscode.window.onDidChangeVisibleTextEditors((visibleEditors) => {
        // As soon as editors go out of view, their related vscode.TextEditor
        // instances are made obsolete. However, we'd still like to keep state
        // like active mode and selections in case the user reopens that editor
        // shortly.

        // First, group all editors per document.
        const editorsPerDocument = groupEditorsPerDocument(visibleEditors);

        // Then, for each group, try to match visible editors to previously
        // visible editors.,
        const remainingDocuments = new Set(this.documentStates());

        for (const editorGroup of editorsPerDocument.values()) {
          const documentState = this.getDocumentState(editorGroup[0].document);

          remainingDocuments.delete(documentState);
          documentState.updateEditorStates(editorGroup);
        }

        // And finally notify remaining documents that they have no editors
        // associated with them anymore.
        for (const remainingDocument of remainingDocuments) {
          remainingDocument.updateEditorStates([]);
        }
      }),

      // Track active editor.
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this._activeEditorState?.notifyDidBecomeInactive(editor !== undefined);

        if (editor === undefined) {
          this._activeEditorState = undefined;
        } else {
          // Note that the call to `getEditorState` below requires that visible
          // editors are updated via `onDidChangeVisibleTextEditors`. Thankfully
          // `onDidChangeActiveTextEditor` is indeed triggered *after* that
          // event.
          this._activeEditorState = this.getEditorState(editor);
          this._activeEditorState!.notifyDidBecomeActive();
        }
      }),

      // Notify editors when selections change.
      vscode.window.onDidChangeTextEditorSelection((e) => {
        this._documentStates
          .get(e.textEditor.document)
          ?.getEditorState(e.textEditor)
          ?.notifyDidChangeTextEditorSelection();
      }),

      // Dispose of documents when relevant.
      vscode.workspace.onDidCloseTextDocument((document) => {
        const documentState = this._documentStates.get(document);

        if (documentState !== undefined) {
          this._documentStates.delete(document);
          documentState.dispose();
        }
      }),

      // Update configuration automatically.
      vscode.workspace.onDidChangeConfiguration((e) => {
        for (const [section, handler] of this.configurationChangeHandlers.entries()) {
          if (e.affectsConfiguration(section)) {
            handler();
          }
        }
      }),
    );

    // Register all commands.
    for (const descriptor of Object.values(commands)) {
      this.subscriptions.push(descriptor.register(this));
    }

    // Set up current visible editors.
    groupEditorsPerDocument(vscode.window.visibleTextEditors).forEach((editors, document) => {
      this.getDocumentState(document).updateEditorStates(editors);
    });

    // Set up current active text editor, if any.
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor !== undefined) {
      const activeEditorState = this.getEditorState(activeEditor);

      this._activeEditorState = activeEditorState;
      activeEditorState!.notifyDidBecomeActive();
    }
  }

  /**
   * Disposes of the extension and all of its resources and subscriptions.
   */
  public dispose() {
    this._cancellationTokenSource.cancel();
    this._cancellationTokenSource.dispose();

    for (const documentState of this.documentStates()) {
      documentState.dispose();
    }

    this._documentStates = new Map();
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
    handler: (value: T, validator: SettingsValidator) => void,
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

    this.configurationChangeHandlers.set(fullName, () => {
      const validator = new SettingsValidator(fullName);

      handler(vscode.workspace.getConfiguration("dance").get(section, defaultValue), validator);

      validator.displayErrorIfNeeded();
    });

    if (triggerNow) {
      const validator = new SettingsValidator(fullName);

      handler(configuration.get(section, defaultValue), validator);

      validator.displayErrorIfNeeded();
    }
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
    const editorState = this.getDocumentState(editor.document).getEditorState(editor);

    if (editorState === undefined) {
      throw new Error(
        "given editor does not have an equivalent EditorState; has it gone out of view?",
      );
    }

    return editorState;
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
  // ==  CANCELLATION  ===========================================================================
  // =============================================================================================

  private _cancellationTokenSource = new vscode.CancellationTokenSource();

  /**
   * The token for the next command.
   */
  public get cancellationToken() {
    return this._cancellationTokenSource.token;
  }

  /**
   * Requests the cancellation of the last operation.
   */
  public cancelLastOperation() {
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

function groupEditorsPerDocument(editors: readonly vscode.TextEditor[]) {
  const editorsPerDocument = new Map<vscode.TextDocument, vscode.TextEditor[]>();

  for (let i = 0; i < editors.length; i++) {
    const editor = editors[i],
          editorsForDocument = editorsPerDocument.get(editor.document);

    if (editorsForDocument === undefined) {
      editorsPerDocument.set(editor.document, [editor]);
    } else {
      editorsForDocument.push(editor);
    }
  }

  return editorsPerDocument;
}
