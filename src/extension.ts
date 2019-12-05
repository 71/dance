import * as vscode from 'vscode'

import { commands, Mode }      from './commands/index'
import { HistoryManager }      from './history'
import { Register, Registers } from './registers'


/** Name of the extension, used in commands and settings. */
export const extensionName = 'dance'

/**
 * Global state of the extension.
 */
export class Extension implements vscode.Disposable {
  private readonly configurationChangeHandlers = new Map<string, () => void>()
  private configuration = vscode.workspace.getConfiguration(extensionName)

  enabled: boolean = false

  typeCommand: vscode.Disposable | undefined = undefined
  changeEditorCommand: vscode.Disposable | undefined = undefined

  currentCount: number = 0
  currentRegister: Register | undefined = undefined

  readonly subscriptions: vscode.Disposable[] = []

  readonly statusBarItem: vscode.StatusBarItem

  readonly modeMap = new WeakMap<vscode.TextDocument, Mode>()

  readonly registers = new Registers()
  readonly history   = new HistoryManager()

  readonly selectionDecorationType = vscode.window.createTextEditorDecorationType(
    <vscode.DecorationRenderOptions> {
      color:  { id: "editor.foreground" },
      backgroundColor:  { id: "editor.selectionBackground" }
    }
  )

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(undefined, 100)
    this.statusBarItem.tooltip = 'Current mode'

    this.setEnabled(this.configuration.get('enabled', true), false)

    this.observePreference<string | null>('insertMode.lineHighlight', null, value => {
      if (this.insertModeDecorationType !== undefined)
        this.insertModeDecorationType.dispose()

      if (value === null || value.length === 0)
        return this.insertModeDecorationType = undefined

      this.insertModeDecorationType = this.createDecorationType(value)

      if (this.getMode() === Mode.Insert && vscode.window.activeTextEditor !== undefined)
        this.setDecorations(vscode.window.activeTextEditor, this.insertModeDecorationType)

      return
    }, true)

    this.observePreference<string | null>('normalMode.lineHighlight', 'editor.hoverHighlightBackground', value => {
      if (this.normalModeDecorationType !== undefined)
        this.normalModeDecorationType.dispose()

      if (value === null || value.length === 0)
        return this.normalModeDecorationType = undefined

      this.normalModeDecorationType = this.createDecorationType(value)

      if (this.getMode() === Mode.Normal && vscode.window.activeTextEditor !== undefined)
        this.setDecorations(vscode.window.activeTextEditor, this.normalModeDecorationType)

      return
    }, true)
  }

  prepareInsertion(editor: vscode.TextEditor, pos: 'before' | 'after' | 'start' | 'end' | 'above' | 'below') {
    this.history.for(editor.document).setLastSelections(editor.document, editor.selections)
    editor.setDecorations(this.selectionDecorationType, editor.selections.map( sel => new vscode.Range( sel.start, sel.end) ))
  }

  private createDecorationType(color: string) {
    return vscode.window.createTextEditorDecorationType({
      backgroundColor: color[0] === '#' ? color : new vscode.ThemeColor(color),
      isWholeLine: true,
    })
  }

  private normalModeDecorationType?: vscode.TextEditorDecorationType
  private insertModeDecorationType?: vscode.TextEditorDecorationType

  setEditorMode(editor: vscode.TextEditor, mode: Mode) {
    if (this.modeMap.get(editor.document) === mode)
      return Promise.resolve()

    this.modeMap.set(editor.document, mode)

    if (mode === Mode.Insert) {
      this.clearDecorations(editor, this.normalModeDecorationType)
      this.setDecorations(editor, this.insertModeDecorationType)

      editor.options.lineNumbers = vscode.TextEditorLineNumbersStyle.On
    } else {
      this.clearDecorations(editor, this.selectionDecorationType)
      this.clearDecorations(editor, this.insertModeDecorationType)
      this.setDecorations(editor, this.normalModeDecorationType)

      editor.options.lineNumbers = vscode.TextEditorLineNumbersStyle.Relative

      //! Restore selections
      let documentHistory = this.history.for(editor.document)
      let lastSels = documentHistory.getLastSelections(editor.document)
      if (lastSels.length > 0 ) {
        editor.selections = lastSels
      }
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

    const lines: number[] = [],
          selections = editor.selections

    let needsCopy = false

    for (let i = 0; i < selections.length; i++) {
      const selection = selections[i]

      for (let line = selection.start.line; line <= selection.end.line; line++) {
        if (lines.indexOf(line) === -1) {
          lines.push(line)
        } else {
          // There is some overlap, so we need a copy
          needsCopy = true
        }
      }
    }

    if (needsCopy) {
      const ranges: vscode.Range[] = []

      for (let i = 0; i < lines.length; i++) {
        const pos = new vscode.Position(lines[i], 0),
              range = new vscode.Range(pos, pos)

        ranges.push(range)
      }

      editor.setDecorations(decorationType, ranges)
    } else {
      editor.setDecorations(decorationType, selections)
    }
  }

  setEnabled(enabled: boolean, changeConfiguration: boolean) {
    if (enabled === this.enabled)
      return

    if (!enabled) {
      this.statusBarItem.hide()

      this.setMode(Mode.Disabled)
      this.changeEditorCommand!.dispose()
      this.subscriptions.splice(0).forEach(x => x.dispose())

      if (changeConfiguration)
        vscode.workspace.getConfiguration(extensionName).update('enabled', false)
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
          const mode = this.modeMap.get(e.textEditor.document)

          if (mode === Mode.Insert)
            this.setDecorations(e.textEditor, this.insertModeDecorationType)
          else
            this.setDecorations(e.textEditor, this.normalModeDecorationType)
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

      if (changeConfiguration)
        vscode.workspace.getConfiguration(extensionName).update('enabled', true)
    }

    return this.enabled = enabled
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
  private observePreference<T>(section: string, defaultValue: T, handler: (value: T) => void, triggerNow = false) {
    this.configurationChangeHandlers.set('dance.' + section, () => {
      handler(this.configuration.get(section, defaultValue))
    })

    if (triggerNow) {
      handler(this.configuration.get(section, defaultValue))
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
    Promise.all([ vscode.commands.getCommands(true), import('../commands/index') ])
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
