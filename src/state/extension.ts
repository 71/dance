import * as vscode from 'vscode'

import { DocumentState } from './document'
import { EditorState }   from './editor'
import { commands }            from '../commands'
import { extensionName }       from '../extension'
import { Registers, Register } from '../registers'


// =============================================================================================
// ==  MODE-SPECIFIC CONFIGURATION  ============================================================
// =============================================================================================

export const enum Mode {
  Normal = 'normal',
  Insert = 'insert',

  Awaiting = 'awaiting',
}

export const enum SelectionBehavior {
  Caret = 1,
  Character = 2,
}

export namespace ModeConfiguration {
  export type CursorStyle = 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin' | 'inherit'
  export type LineNumbers = 'on' | 'off' | 'relative' | 'inherit'
}

export interface GotoMenu {
  readonly items: Record<string, {
    readonly text: string
    readonly command: string
    readonly args?: any[]
  }>
}

/**
 * Mode-specific configuration.
 */
export class ModeConfiguration {
  private constructor(
    readonly mode: Mode,
    readonly modePrefix: string,

    public lineNumbers: vscode.TextEditorLineNumbersStyle,
    public cursorStyle: vscode.TextEditorCursorStyle,
    public decorationType?: vscode.TextEditorDecorationType,
  ) {}

  static insert() {
    return new ModeConfiguration(
      Mode.Insert,
      'insertMode',

      vscode.TextEditorLineNumbersStyle.On,
      vscode.TextEditorCursorStyle.Line,
    )
  }

  static normal() {
    return new ModeConfiguration(
      Mode.Normal,
      'normalMode',

      vscode.TextEditorLineNumbersStyle.Relative,
      vscode.TextEditorCursorStyle.Line,
    )
  }

  observeLineHighlightPreference(extension: Extension, defaultValue: string | null) {
    extension.observePreference<string | null>(this.modePrefix + '.lineHighlight', defaultValue, value => {
      this.decorationType?.dispose()

      if (value === null || value.length === 0)
        return this.decorationType = undefined

      this.decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: value[0] === '#' ? value : new vscode.ThemeColor(value),
        isWholeLine: true,
      })

      for (const editor of extension.editorStates()) {
        if (editor.mode === this.mode && editor.isActive)
          editor.setDecorations(this.decorationType)
      }

      return
    }, true)
  }

  observeLineNumbersPreference(extension: Extension, defaultValue: ModeConfiguration.LineNumbers) {
    extension.observePreference<ModeConfiguration.LineNumbers>(this.modePrefix + '.lineNumbers', defaultValue, value => {
      this.lineNumbers = this.lineNumbersStringToLineNumbersStyle(value)
    }, true)
  }

  updateLineNumbers(extension: Extension, defaultValue: ModeConfiguration.LineNumbers) {
    this.lineNumbers = this.lineNumbersStringToLineNumbersStyle(
      extension.configuration.get(this.modePrefix + '.lineNumbers') ?? defaultValue,
    )
  }

  observeCursorStylePreference(extension: Extension, defaultValue: ModeConfiguration.CursorStyle) {
    extension.observePreference<ModeConfiguration.CursorStyle>(this.modePrefix + '.cursorStyle', defaultValue, value => {
      this.cursorStyle = this.cursorStyleStringToCursorStyle(value)
    }, true)
  }

  updateCursorStyle(extension: Extension, defaultValue: ModeConfiguration.CursorStyle) {
    this.cursorStyle = this.cursorStyleStringToCursorStyle(
      extension.configuration.get(this.modePrefix + '.cursorStyle') ?? defaultValue,
    )
  }

  private lineNumbersStringToLineNumbersStyle(lineNumbers: ModeConfiguration.LineNumbers) {
    switch (lineNumbers) {
      case 'on':
        return vscode.TextEditorLineNumbersStyle.On
      case 'off':
        return vscode.TextEditorLineNumbersStyle.Off
      case 'relative':
        return vscode.TextEditorLineNumbersStyle.Relative
      case 'inherit':
      default:
        const vscodeLineNumbers = vscode.workspace.getConfiguration().get<ModeConfiguration.LineNumbers | 'interval'>('editor.lineNumbers', 'on')

        switch (vscodeLineNumbers) {
          case 'on':
            return vscode.TextEditorLineNumbersStyle.On
          case 'off':
            return vscode.TextEditorLineNumbersStyle.Off
          case 'relative':
            return vscode.TextEditorLineNumbersStyle.Relative
          case 'interval': // This is a real option but its not in vscode.d.ts
            return 3
          default:
            return vscode.TextEditorLineNumbersStyle.On
        }
    }
  }

  private cursorStyleStringToCursorStyle(cursorStyle: ModeConfiguration.CursorStyle) {
    switch (cursorStyle) {
      case 'block':
        return vscode.TextEditorCursorStyle.Block
      case 'block-outline':
        return vscode.TextEditorCursorStyle.BlockOutline
      case 'line':
        return vscode.TextEditorCursorStyle.Line
      case 'line-thin':
        return vscode.TextEditorCursorStyle.LineThin
      case 'underline':
        return vscode.TextEditorCursorStyle.Underline
      case 'underline-thin':
        return vscode.TextEditorCursorStyle.UnderlineThin

      case 'inherit':
      default:
        const vscodeCursorStyle = vscode.workspace.getConfiguration().get<ModeConfiguration.CursorStyle>('editor.cursorStyle', 'line')

        switch (vscodeCursorStyle) {
          case 'block':
            return vscode.TextEditorCursorStyle.Block
          case 'block-outline':
            return vscode.TextEditorCursorStyle.BlockOutline
          case 'line':
            return vscode.TextEditorCursorStyle.Line
          case 'line-thin':
            return vscode.TextEditorCursorStyle.LineThin
          case 'underline':
            return vscode.TextEditorCursorStyle.Underline
          case 'underline-thin':
            return vscode.TextEditorCursorStyle.UnderlineThin
          default:
            return vscode.TextEditorCursorStyle.Line
        }
    }
  }
}

// ===============================================================================================
// ==  EXTENSION  ================================================================================
// ===============================================================================================

/**
 * Global state of the extension.
 */
export class Extension implements vscode.Disposable {
  // Events.
  private readonly configurationChangeHandlers = new Map<string, () => void>()
  private readonly subscriptions: vscode.Disposable[] = []

  // Configuration.
  private readonly _gotoMenus = new Map<string, GotoMenu>()
  private _selectionBehavior = SelectionBehavior.Caret

  configuration = vscode.workspace.getConfiguration(extensionName)

  get selectionBehavior() {
    return this._selectionBehavior
  }

  get menus() {
    return this._gotoMenus as ReadonlyMap<string, GotoMenu>
  }

  // General state.
  readonly statusBarItem: vscode.StatusBarItem

  enabled: boolean = false

  /**
   * The `CancellationTokenSource` for cancellable operations running in this editor.
   */
  cancellationTokenSource?: vscode.CancellationTokenSource

  /**
   * `Registers` for this instance of the extension.
   */
  readonly registers = new Registers()

  // Mode-specific configuration.
  readonly insertMode = ModeConfiguration.insert()
  readonly normalMode = ModeConfiguration.normal()

  // Ephemeral state needed by commands.
  currentCount: number = 0
  currentRegister: Register | undefined = undefined

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(undefined, 100)
    this.statusBarItem.tooltip = 'Current mode'

    // This needs to be before setEnabled for normalizing selections on start.
    this.observePreference<'caret' | 'character'>('selectionBehavior', 'caret', value => {
      this._selectionBehavior = value === 'caret' ? SelectionBehavior.Caret : SelectionBehavior.Character
    }, true)

    // Configuration: line highlight.
    this.insertMode.observeLineHighlightPreference(this, null)
    this.normalMode.observeLineHighlightPreference(this, 'editor.hoverHighlightBackground')

    // Configuration: line numbering.
    this.insertMode.observeLineNumbersPreference(this, 'inherit')
    this.normalMode.observeLineNumbersPreference(this, 'relative')

    this.configurationChangeHandlers.set('editor.lineNumbers', () => {
      this.insertMode.updateLineNumbers(this, 'inherit')
      this.normalMode.updateLineNumbers(this, 'relative')
    })

    // Configuration: cursor style.
    this.insertMode.observeCursorStylePreference(this, 'inherit')
    this.normalMode.observeCursorStylePreference(this, 'inherit')

    this.configurationChangeHandlers.set('editor.cursorStyle', () => {
      this.insertMode.updateCursorStyle(this, 'inherit')
      this.normalMode.updateCursorStyle(this, 'inherit')
    })

    // Configuration: menus.
    this.observePreference<Record<string, GotoMenu>>('menus', {}, value => {
      this._gotoMenus.clear()

      if (typeof value !== 'object' || value === null) {
        vscode.window.showErrorMessage(`Configuration ${extensionName}.menus must be an object.`)

        return
      }

      for (const menuName in value) {
        const menu = value[menuName],
              builtMenu: GotoMenu = { items: {} },
              menuDisplay = `${extensionName}.menus[${JSON.stringify(menuName)}]`

        if (typeof menu !== 'object' || menu === null) {
          vscode.window.showErrorMessage(`Menu ${menuDisplay} must be an object.`)
        } else if (typeof menu.items !== 'object' || menu.items === null || Object.keys(menu.items).length < 2) {
          vscode.window.showErrorMessage(`Menu ${menuDisplay} must have an subobject "items" with at least two entries.`)
        } else {
          let valid = true

          for (const key in menu.items) {
            const item = menu.items[key],
                  itemDisplay = `${JSON.stringify(key)} of ${menuDisplay}`

            if (typeof key !== 'string' || key.length !== 1) {
              vscode.window.showErrorMessage(`Item ${itemDisplay} must have a single-character key.`)
            } else if (typeof item !== 'object' || item === null) {
              vscode.window.showErrorMessage(`Item ${itemDisplay} must be an object.`)
            } else if (typeof item.text !== 'string' || item.text.length === 0) {
              vscode.window.showErrorMessage(`Item ${itemDisplay} must have a non-empty "text" property.`)
            } else if (typeof item.command !== 'string' || item.command.length === 0) {
              vscode.window.showErrorMessage(`Item ${itemDisplay} must have a non-empty "command" property.`)
            } else {
              builtMenu.items[key] = { command: item.command, text: item.text, args: item.args }
              continue
            }

            valid = false
          }

          if (valid) {
            this._gotoMenus.set(menuName, builtMenu)
          }
        }
      }
    }, true)

    // Lastly, enable the extension and set up modes.
    this.setEnabled(this.configuration.get('enabled', true), false)
  }

  /**
   * Disposes of the extension and all of its resources and subscriptions.
   */
  dispose() {
    this.cancellationTokenSource?.dispose()
    this.setEnabled(false, false)
    this.statusBarItem.dispose()
  }

  /**
   * Listen for changes to the specified preference and calls the given handler when a change occurs.
   *
   * Must be called in the constructor.
   *
   * @param triggerNow If `true`, the handler will also be triggered immediately with the current value.
   */
  observePreference<T>(section: string, defaultValue: T, handler: (value: T) => void, triggerNow = false) {
    this.configurationChangeHandlers.set('dance.' + section, () => {
      handler(this.configuration.get(section, defaultValue))
    })

    if (triggerNow) {
      handler(this.configuration.get(section, defaultValue))
    }
  }

  setEnabled(enabled: boolean, changeConfiguration: boolean) {
    if (enabled === this.enabled)
      return

    this.subscriptions.splice(0).forEach(x => x.dispose())

    if (!enabled) {
      this.statusBarItem.hide()

      for (const documentState of this.documentStates()) {
        documentState.dispose()
      }

      this._documentStates = new Map()

      if (changeConfiguration)
        vscode.workspace.getConfiguration(extensionName).update('enabled', false)
    } else {
      this.statusBarItem.show()

      this.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
          this._activeEditorState?.onDidBecomeInactive()

          if (editor === undefined) {
            this._activeEditorState = undefined
          } else {
            this._activeEditorState = this.getEditorState(editor)
            this._activeEditorState.onDidBecomeActive()
          }
        }),

        vscode.window.onDidChangeTextEditorSelection(e => {
          this._documentStates.get(e.textEditor.document)?.getEditorState(e.textEditor)?.updateEditor(e.textEditor)?.onDidChangeTextEditorSelection(e)
        }),

        vscode.workspace.onDidChangeTextDocument(e => {
          this._documentStates.get(e.document)?.onDidChangeTextDocument(e)
        }),

        vscode.workspace.onDidChangeConfiguration(e => {
          this.configuration = vscode.workspace.getConfiguration(extensionName)

          for (const [section, handler] of this.configurationChangeHandlers.entries()) {
            if (e.affectsConfiguration(section))
              handler()
          }
        }),
      )

      for (let i = 0; i < commands.length; i++)
        this.subscriptions.push(commands[i].register(this))

      const activeEditor = vscode.window.activeTextEditor

      if (activeEditor !== undefined)
        this.getEditorState(activeEditor).onDidBecomeActive()

      if (changeConfiguration)
        vscode.workspace.getConfiguration(extensionName).update('enabled', true)
    }

    return this.enabled = enabled
  }


  // =============================================================================================
  // ==  DOCUMENT AND EDITOR STATES  =============================================================
  // =============================================================================================

  private _documentStates = new WeakMap<vscode.TextDocument, DocumentState>()
  private _activeEditorState?: EditorState

  /**
   * Returns the `DocumentState` for the given `vscode.TextDocument`.
   */
  getDocumentState(document: vscode.TextDocument) {
    let state = this._documentStates.get(document)

    if (state === undefined)
      this._documentStates.set(document, state = new DocumentState(this, document))

    return state
  }

  /**
   * Returns the `EditorState` for the given `vscode.TextEditor`.
   */
  getEditorState(editor: vscode.TextEditor) {
    return this.getDocumentState(editor.document).getEditorState(editor)
  }

  /**
   * Returns an iterator over all known `DocumentState`s.
   */
  *documentStates() {
    const documents = vscode.workspace.textDocuments,
          len = documents.length

    for (let i = 0; i < len; i++) {
      const documentState = this._documentStates.get(documents[i])

      if (documentState !== undefined)
        yield documentState
    }
  }

  /**
   * Returns an iterator over all known `EditorState`s.
   */
  *editorStates() {
    for (const documentState of this.documentStates()) {
      yield* documentState.editorStates()
    }
  }
}
