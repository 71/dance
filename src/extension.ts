import * as vscode from 'vscode'

import { commands, Mode }      from './commands/index'
import { HistoryManager }      from './history'
import { Register, Registers } from './registers'
import { SelectionSet }        from './utils/selectionSet'
import { assert } from './utils/assert'


/** Name of the extension, used in commands and settings. */
export const extensionName = 'dance'

type CursorStyle = 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin' | 'inherit'
type LineNumbers = 'on' | 'off' | 'relative' | 'inherit'

/** Mode-specific configuration. */
class ModeConfiguration {
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
      extension.updateDecorations(this, value)
    }, true)
  }

  observeLineNumbersPreference(extension: Extension, defaultValue: LineNumbers) {
    extension.observePreference<LineNumbers>(this.modePrefix + '.lineNumbers', defaultValue, value => {
      this.lineNumbers = this.lineNumbersStringToLineNumbersStyle(value)
    }, true)
  }

  updateLineNumbers(extension: Extension, defaultValue: LineNumbers) {
    this.lineNumbers = this.lineNumbersStringToLineNumbersStyle(
      extension.configuration.get(this.modePrefix + '.lineNumbers') ?? defaultValue,
    )
  }

  observeCursorStylePreference(extension: Extension, defaultValue: CursorStyle) {
    extension.observePreference<CursorStyle>(this.modePrefix + '.cursorStyle', defaultValue, value => {
      this.cursorStyle = this.cursorStyleStringToCursorStyle(value)
    }, true)
  }

  updateCursorStyle(extension: Extension, defaultValue: CursorStyle) {
    this.cursorStyle = this.cursorStyleStringToCursorStyle(
      extension.configuration.get(this.modePrefix + '.cursorStyle') ?? defaultValue,
    )
  }

  private lineNumbersStringToLineNumbersStyle(lineNumbers: LineNumbers) {
    switch (lineNumbers) {
      case 'on':
        return vscode.TextEditorLineNumbersStyle.On
      case 'off':
        return vscode.TextEditorLineNumbersStyle.Off
      case 'relative':
        return vscode.TextEditorLineNumbersStyle.Relative
      case 'inherit':
      default:
        const vscodeLineNumbers = vscode.workspace.getConfiguration().get<LineNumbers | 'interval'>('editor.lineNumbers', 'on')

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

  private cursorStyleStringToCursorStyle(cursorStyle: CursorStyle) {
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
        const vscodeCursorStyle = vscode.workspace.getConfiguration().get<CursorStyle>('editor.cursorStyle', 'line')

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

/**
 * Global state of the extension.
 */
export class Extension implements vscode.Disposable {
  private readonly configurationChangeHandlers = new Map<string, () => void>()
  configuration = vscode.workspace.getConfiguration(extensionName)

  enabled: boolean = false

  allowEmptySelections: boolean = true

  typeCommand: vscode.Disposable | undefined = undefined
  changeEditorCommand: vscode.Disposable | undefined = undefined

  currentCount: number = 0
  currentRegister: Register | undefined = undefined

  ignoreSelectionChanges = false

  readonly subscriptions: vscode.Disposable[] = []
  readonly statusBarItem: vscode.StatusBarItem

  readonly modeMap = new WeakMap<vscode.TextDocument, Mode>()
  readonly selectionSets = [] as SelectionSet[]

  readonly registers = new Registers()
  readonly history   = new HistoryManager()

  readonly insertMode = ModeConfiguration.insert()
  readonly normalMode = ModeConfiguration.normal()

  cancellationTokenSource?: vscode.CancellationTokenSource

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(undefined, 100)
    this.statusBarItem.tooltip = 'Current mode'

    // This needs to be before setEnabled for normalizing selections on start.
    this.observePreference<boolean>('selections.allowEmpty', true, value => {
      this.allowEmptySelections = value
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

  updateDecorations(mode: ModeConfiguration, color: string | null) {
    if (mode.decorationType !== undefined)
      mode.decorationType.dispose()

    if (color === null || color.length === 0)
      return mode.decorationType = undefined

    mode.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: color[0] === '#' ? color : new vscode.ThemeColor(color),
      isWholeLine: true,
    })

    if (this.getMode() === mode.mode && vscode.window.activeTextEditor !== undefined)
      this.setDecorations(vscode.window.activeTextEditor, mode.decorationType)

    return
  }

  setEditorMode(editor: vscode.TextEditor, mode: Mode) {
    if (this.modeMap.get(editor.document) === mode)
      return Promise.resolve()

    this.modeMap.set(editor.document, mode)

    if (mode === Mode.Insert) {
      this.clearDecorations(editor, this.normalMode.decorationType)
      this.setDecorations(editor, this.insertMode.decorationType)

      editor.options.lineNumbers = this.insertMode.lineNumbers
      editor.options.cursorStyle = this.insertMode.cursorStyle
    } else {
      if (mode === Mode.Awaiting) {
        this.typeCommand?.dispose()
        this.typeCommand = undefined
      }

      this.clearDecorations(editor, this.insertMode.decorationType)
      this.setDecorations(editor, this.normalMode.decorationType)

      editor.options.lineNumbers = this.normalMode.lineNumbers
      editor.options.cursorStyle = this.normalMode.cursorStyle
    }

    if (vscode.window.activeTextEditor === editor)
      return this.onActiveModeChanged(mode)

    return Promise.resolve()
  }

  getMode() {
    const editor = vscode.window.activeTextEditor

    return editor === undefined
      ? Mode.Disabled
      : this.modeMap.get(editor.document) || Mode.Normal
  }

  setMode(mode: Mode) {
    const editor = vscode.window.activeTextEditor

    return editor === undefined
      ? Promise.resolve()
      : this.setEditorMode(editor, mode)
  }

  private async onActiveModeChanged(mode: Mode) {
    if (mode === Mode.Insert) {
      this.statusBarItem.text = '$(pencil) INSERT'
    } else if (mode === Mode.Normal) {
      this.statusBarItem.text = '$(beaker) NORMAL'
    }

    await vscode.commands.executeCommand('setContext', extensionName + '.mode', mode)
  }

  private clearDecorations(editor: vscode.TextEditor, decorationType: vscode.TextEditorDecorationType | undefined) {
    if (decorationType !== undefined)
      editor.setDecorations(decorationType, [])
  }

  private setDecorations(editor: vscode.TextEditor, decorationType: vscode.TextEditorDecorationType | undefined) {
    if (decorationType === undefined)
      return

    const selection = editor.selection

    if (selection.end.character === 0 && selection.end.line > 0 && !this.allowEmptySelections)
      editor.setDecorations(decorationType, [new vscode.Range(selection.start, selection.end.with(selection.end.line - 1, 0))])
    else
      editor.setDecorations(decorationType, [selection])
  }

  setEnabled(enabled: boolean, changeConfiguration: boolean) {
    if (enabled === this.enabled)
      return

    this.subscriptions.splice(0).forEach(x => x.dispose())

    if (!enabled) {
      const restoreLineNumbering = (visibleEditors: vscode.TextEditor[]) => {
        for (const editor of visibleEditors) {
          if (!this.modeMap.delete(editor.document))
            continue

          const lineNumbering = vscode.workspace.getConfiguration('editor').get('lineNumbers')

          editor.options.lineNumbers = lineNumbering === 'on'       ? vscode.TextEditorLineNumbersStyle.On
                                     : lineNumbering === 'relative' ? vscode.TextEditorLineNumbersStyle.Relative
                                     : lineNumbering === 'interval' ? vscode.TextEditorLineNumbersStyle.Relative + 1
                                     :                                vscode.TextEditorLineNumbersStyle.Off

          this.clearDecorations(editor, this.normalMode.decorationType)
          this.clearDecorations(editor, this.insertMode.decorationType)
        }
      }

      this.statusBarItem.hide()

      this.setMode(Mode.Disabled)
      this.changeEditorCommand!.dispose()

      this.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors(restoreLineNumbering),
      )

      restoreLineNumbering(vscode.window.visibleTextEditors)

      if (changeConfiguration)
        vscode.workspace.getConfiguration(extensionName).update('enabled', false)

      this.selectionSets.splice(0)
    } else {
      this.statusBarItem.show()

      this.setMode(Mode.Normal)
      this.changeEditorCommand = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor === undefined)
          return

        let mode = this.modeMap.get(editor.document)

        if (mode === undefined)
          return this.setEditorMode(editor, mode = Mode.Normal)
        else
          return this.onActiveModeChanged(mode)
      })

      this.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(e => {
          this.cancellationTokenSource?.dispose()

          let hasMatchingSelectionSet = false

          for (const selectionSet of this.selectionSets) {
            if (selectionSet.forEditor(e.textEditor)) {
              hasMatchingSelectionSet = true
              selectionSet.updateAfterSelectionsChanged(e)
              break
            }
          }

          if (!hasMatchingSelectionSet) {
            this.selectionSets.push(SelectionSet.from(this, e.textEditor))
          }

          const mode = this.modeMap.get(e.textEditor.document)

          if (mode === Mode.Awaiting) {
            this.setEditorMode(e.textEditor, Mode.Normal)
          }

          if (mode === Mode.Insert)
            this.setDecorations(e.textEditor, this.insertMode.decorationType)
          else
            this.setDecorations(e.textEditor, this.normalMode.decorationType)
        }),

        vscode.workspace.onDidChangeConfiguration(e => {
          this.configuration = vscode.workspace.getConfiguration(extensionName)

          for (const [section, handler] of this.configurationChangeHandlers.entries()) {
            if (e.affectsConfiguration(section))
              handler()
          }
        }),

        vscode.window.onDidChangeVisibleTextEditors(e => {
          for (const editor of e) {
            if (!this.selectionSets.some(x => x.forEditor(editor)))
              this.selectionSets.push(SelectionSet.from(this, editor))
          }
        }),

        vscode.workspace.onDidCloseTextDocument(e => {
          for (let i = 0; i < this.selectionSets.length; i++) {
            if (this.selectionSets[i].document === e)
              this.selectionSets.splice(i--, 1)
          }
        }),

        vscode.workspace.onDidChangeTextDocument(e => {
          for (const selectionSet of this.selectionSets) {
            if (selectionSet.document === e.document)
              selectionSet.updateAfterDocumentChanged(e)
          }
        }),
      )

      for (let i = 0; i < commands.length; i++)
        this.subscriptions.push(commands[i].register(this))

      if (changeConfiguration)
        vscode.workspace.getConfiguration(extensionName).update('enabled', true)

      this.selectionSets.push(...vscode.window.visibleTextEditors.map(x => SelectionSet.from(this, x)))
    }

    return this.enabled = enabled
  }

  get activeSelections() {
    return this.getSelectionsForEditor(vscode.window.activeTextEditor!)
  }

  getSelectionsForEditor(editor: vscode.TextEditor, disableCheck = false) {
    for (const selectionSet of this.selectionSets) {
      if (selectionSet.forEditor(editor)) {
        if (!disableCheck) {
          assert(selectionSet.selections.length === editor.selections.length
              && selectionSet.selections.every((selection, i) => selection.eq(editor.selections[i])))
        }

        return selectionSet
      }
    }

    const selectionSet = SelectionSet.from(this, editor)

    this.selectionSets.push(selectionSet)

    return selectionSet
  }

  dispose() {
    this.history.dispose()
    this.statusBarItem.dispose()

    if (!this.enabled)
      return

    this.typeCommand!.dispose()
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

export let state: Extension

export function activate(context: vscode.ExtensionContext) {
  state = new Extension()

  context.subscriptions.push(
    vscode.commands.registerCommand(extensionName + '.toggle', () => state.setEnabled(!state.enabled, false)),
  )

  if (process.env.VERBOSE_LOGGING === 'true') {
    // Log all commands we need to implement
    Promise.all([vscode.commands.getCommands(true), import('../commands/index')])
      .then(([registeredCommands, { commands }]) => {
        for (const command of Object.values(commands)) {
          if (registeredCommands.indexOf(command.id) === -1)
            console.warn('Command', command.id, 'is defined but not implemented.')
        }
      })
  }
}

export function deactivate() {
  state.dispose()
}
