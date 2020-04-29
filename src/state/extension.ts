import * as vscode from 'vscode'

import { DocumentState } from './document'
import { EditorState }   from './editor'
import { extensionName }       from '../extension'
import { Registers, Register } from '../registers'
import { commands } from '../commands'


// =============================================================================================
// ==  MODE-SPECIFIC CONFIGURATION  ============================================================
// =============================================================================================

export const enum Mode {
  Normal = 'normal',
  Insert = 'insert',

  Awaiting = 'awaiting',
}

export namespace ModeConfiguration {
  export type CursorStyle = 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin' | 'inherit'
  export type LineNumbers = 'on' | 'off' | 'relative' | 'inherit'
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
      for (const editor of extension.editorStates())
        editor.updateDecorations(this, value)
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
// ==  CHARACTER SETS  ===========================================================================
// ===============================================================================================

const blankCharacters =
  '\r\n\t ' + String.fromCharCode(0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000)

/**
 * A character set.
 */
export const enum CharSet {
  /** Whether the set should be inverted when checking for existence. */
  Invert      = 0b001,
  /** Blank characters (whitespace), such as ' \t\n'. */
  Blank       = 0b010,
  /** Punctuation characters, such as '.,;'. */
  Punctuation = 0b100,

  /** Word character (neither blank nor punctuation). */
  Word = Invert | Blank | Punctuation,
  /** Non-blank character (either word or punctuation). */
  NonBlank = Invert | Blank,
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
  private _allowEmptySelections = true

  configuration = vscode.workspace.getConfiguration(extensionName)

  get allowEmptySelections() {
    return this._allowEmptySelections
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
    this.observePreference<boolean>('selections.allowEmpty', true, value => {
      this._allowEmptySelections = value
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
          this._documentStates.get(e.textEditor.document)?.getEditorState(e.textEditor)?.onDidChangeTextEditorSelection(e)
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


  // =============================================================================================
  // ==  CHARACTER SETS  =========================================================================
  // =============================================================================================

  /**
   * Returns a string containing all the characters belonging to the given charset.
   */
  getCharacters(charSet: CharSet, document: vscode.TextDocument) {
    let characters = ''

    if (charSet & CharSet.Blank) {
      characters += blankCharacters
    }

    if (charSet & CharSet.Punctuation) {
      const wordSeparators = vscode.workspace.getConfiguration('editor', { languageId: document.languageId }).get('wordSeparators')

      if (typeof wordSeparators === 'string')
        characters += wordSeparators
    }

    return characters
  }

  /**
   * Returns an array containing all the characters belonging to the given charset.
   */
  getCharCodes(charSet: CharSet, document: vscode.TextDocument) {
    const characters = this.getCharacters(charSet, document),
          charCodes = new Uint32Array(characters.length)

    for (let i = 0; i < characters.length; i++) {
      charCodes[i] = characters.charCodeAt(i)
    }

    return charCodes
  }

  /**
   * Returns a function that tests whether a character belongs to the given charset.
   */
  getCharSetFunction(charSet: CharSet, document: vscode.TextDocument) {
    const charCodes = this.getCharCodes(charSet, document)

    if (charSet & CharSet.Invert) {
      return function(this: Uint32Array, charCode: number) {
        return this.indexOf(charCode) === -1
      }.bind(charCodes)
    } else {
      return function(this: Uint32Array, charCode: number) {
        return this.indexOf(charCode) !== -1
      }.bind(charCodes)
    }
  }
}
