import * as vscode from 'vscode'

import { commands, Mode }      from './commands/index'
import { HistoryManager }      from './history'
import { Register, Registers } from './registers'


/** Name of the extension, used in commands and settings. */
export const extensionName = 'dance'

/**
 * File-specific state.
 */
class FileState {
  changes: vscode.TextDocumentContentChangeEvent[] = []
  insertPosition?: vscode.Position
  mode: Mode = Mode.Normal
}

/**
 * Global state of the extension.
 */
export class Extension implements vscode.Disposable {
  enabled: boolean = false

  typeCommand: vscode.Disposable | undefined = undefined
  changeEditorCommand: vscode.Disposable | undefined = undefined

  currentCount: number = 0
  currentRegister: Register | undefined = undefined

  readonly subscriptions: vscode.Disposable[] = []

  readonly statusBarItem: vscode.StatusBarItem

  readonly modeMap = new Map<vscode.TextEditor, Mode>()
  readonly files   = new WeakMap<vscode.TextDocument, FileState>()

  readonly registers = new Registers()
  readonly history   = new HistoryManager()

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(undefined, 100)
    this.statusBarItem.tooltip = 'Current mode'

    this.setEnabled(vscode.workspace.getConfiguration(extensionName).get('enabled', true), false)
  }

  get activeFileState() {
    return this.getFileState(vscode.window.activeTextEditor!.document)
  }

  getFileState(doc: vscode.TextDocument) {
    let state = this.files.get(doc)

    if (state == undefined) {
      state = new FileState()
      this.files.set(doc, state)
    }

    return state
  }

  setEditorMode(editor: vscode.TextEditor, mode: Mode) {
    if (this.modeMap.get(editor) === mode)
      return Promise.resolve()

    this.modeMap.set(editor, mode)

    if (mode === Mode.Insert) {
      const file = this.files.get(editor.document)

      if (file !== undefined) {
        file.changes.length = 0
        file.insertPosition = editor.selection.active
      }
    }

    if (vscode.window.activeTextEditor === editor)
      return this.onActiveModeChanged(mode)

    return Promise.resolve()
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

      await vscode.workspace.getConfiguration('editor').update('lineNumbers', 'on', true)
    } else if (mode === Mode.Normal) {
      this.statusBarItem.text = '$(beaker) NORMAL'

      await vscode.workspace.getConfiguration('editor').update('lineNumbers', 'relative', true)
    }

    await vscode.commands.executeCommand('setContext', extensionName + '.mode', mode)
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
        vscode.workspace.getConfiguration(extensionName).update('enabled', this.enabled = false)
    } else {
      this.statusBarItem.show()

      this.setMode(Mode.Normal)
      this.changeEditorCommand = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor === undefined)
          return

        let mode = this.modeMap.get(editor)

        if (mode === undefined)
          return this.setEditorMode(editor, mode = Mode.Normal)
        else
          return this.setEditorMode(editor, mode)
      })

      this.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => {
          const file = this.getFileState(e.document)

          file.changes.push(...e.contentChanges)
        }),
      )

      for (let i = 0; i < commands.length; i++)
        this.subscriptions.push(commands[i].register(this))

      if (changeConfiguration)
        vscode.workspace.getConfiguration(extensionName).update('enabled', this.enabled = true)
    }

    return this.enabled
  }

  dispose() {
    this.history.dispose()
    this.statusBarItem.dispose()

    if (!this.enabled)
      return

    this.typeCommand!.dispose()
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
