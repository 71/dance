import * as vscode from 'vscode'

import { commands, Mode }      from './commands/index'
import { Register, Registers } from './registers'


/** Name of the extension, used in commands and settings. */
export const extensionName = 'dance'

/**
 * File-specific state.
 */
class FileState {
  changes: vscode.TextDocumentContentChangeEvent[] = []
  insertPosition?: vscode.Position
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

  readonly modeMap = new Map<vscode.TextEditor, Mode>()
  readonly files   = new WeakMap<vscode.TextDocument, FileState>()

  readonly subscriptions: vscode.Disposable[] = []

  readonly registers = new Registers()

  readonly normalModeLineDecoration = vscode.window.createTextEditorDecorationType({
    borderColor: new vscode.ThemeColor('editor.background'),
    borderStyle: 'solid',
    borderWidth: '2px',
    isWholeLine: true,
  })

  readonly primarySelectionDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.selectionBackground'),
  })

  readonly secondarySelectionDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.inactiveSelectionBackground'),
  })

  constructor() {
    this.setEnabled(vscode.workspace.getConfiguration(extensionName).get('enabled', true))
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

  setEditorMode(editor: vscode.TextEditor, mode: Mode): Thenable<void> {
    if (this.modeMap.get(editor) === mode)
      return Promise.resolve()

    this.modeMap.set(editor, mode)

    if (mode === Mode.Insert) {
      editor.setDecorations(this.normalModeLineDecoration, [])

      const file = this.files.get(editor.document)

      if (file !== undefined) {
        file.changes.length = 0
        file.insertPosition = editor.selection.active
      }
    } else {
      editor.setDecorations(this.normalModeLineDecoration, editor.selections)
    }

    return vscode.commands.executeCommand('setContext', extensionName + '.mode', mode)
  }

  setMode(mode: Mode): Thenable<void> {
    const editor = vscode.window.activeTextEditor

    return editor === undefined
      ? Promise.resolve()
      : this.setEditorMode(editor, mode)
  }

  setEnabled(enabled: boolean) {
    if (enabled === this.enabled)
      return

    if (!enabled) {
      this.setMode(Mode.Disabled)
      this.changeEditorCommand!.dispose()
      this.subscriptions.splice(0).forEach(x => x.dispose())

      vscode.workspace.getConfiguration(extensionName).update('enabled', this.enabled = false)
    } else {
      this.setMode(Mode.Normal)
      this.changeEditorCommand = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor === undefined)
          return

        let mode = this.modeMap.get(editor)

        if (mode === undefined)
          this.modeMap.set(editor, mode = Mode.Normal)

        return this.setMode(mode)
      })

      this.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(e => {
          if (this.modeMap.get(e.textEditor) !== Mode.Insert) {
            // Change how the lines look
            e.textEditor.setDecorations(this.normalModeLineDecoration, e.selections)

            // The secondary selections are slightly less visible
            e.textEditor.setDecorations(this.primarySelectionDecoration, [e.selections[0]])
            e.textEditor.setDecorations(this.secondarySelectionDecoration, e.selections.slice(1))
          } else {
            // In insert mode, we reset all decorations we applied previously
            e.textEditor.setDecorations(this.normalModeLineDecoration    , [])
            e.textEditor.setDecorations(this.primarySelectionDecoration  , [])
            e.textEditor.setDecorations(this.secondarySelectionDecoration, [])
          }
        }),

        vscode.workspace.onDidChangeTextDocument(e => {
          const file = this.getFileState(e.document)

          file.changes.push(...e.contentChanges)
        }),
      )

      for (let i = 0; i < commands.length; i++)
        this.subscriptions.push(commands[i].register(this))

      vscode.workspace.getConfiguration(extensionName).update('enabled', this.enabled = true)
    }

    return this.enabled
  }

  dispose() {
    this.normalModeLineDecoration.dispose()
    this.primarySelectionDecoration.dispose()
    this.secondarySelectionDecoration.dispose()

    if (!this.enabled)
      return

    this.typeCommand!.dispose()
  }
}

export let state: Extension

export function activate(context: vscode.ExtensionContext) {
  state = new Extension()

  context.subscriptions.push(
    vscode.commands.registerCommand(extensionName + '.toggle', () => state.setEnabled(!state.enabled)),
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
