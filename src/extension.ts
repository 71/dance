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

  readonly modeMap = new WeakMap<vscode.TextDocument, Mode>()
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

  readonly normalModeDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.hoverHighlightBackground'),
    isWholeLine: true,
  })

  setEditorMode(editor: vscode.TextEditor, mode: Mode) {
    if (this.modeMap.get(editor.document) === mode)
      return Promise.resolve()

    this.modeMap.set(editor.document, mode)

    if (mode === Mode.Insert) {
      const file = this.files.get(editor.document)

      if (file !== undefined) {
        file.changes.length = 0
        file.insertPosition = editor.selection.active
      }

      this.clearDecorations(editor)

      const lineNumberConfig = vscode.workspace.getConfiguration(extensionName).get('insertMode.lineNumbers', 'inherit');
      this.setLineNumberStyle(editor, lineNumberConfig);
    } else {
      this.setDecorations(editor)

      const lineNumberConfig = vscode.workspace.getConfiguration(extensionName).get('normalMode.lineNumbers', 'relative');
      this.setLineNumberStyle(editor, lineNumberConfig);
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
  
  setLineNumberStyle(editor: vscode.TextEditor, style:string) {
    if(style === 'inherit') {
      style = vscode.workspace.getConfiguration().get('editor.lineNumbers', 'on'); 
    }
    switch(style) {
      case 'on':
        editor.options.lineNumbers = vscode.TextEditorLineNumbersStyle.On;
        break;
      case 'off':
        editor.options.lineNumbers = vscode.TextEditorLineNumbersStyle.Off;
        break;
      case 'relative':
        editor.options.lineNumbers = vscode.TextEditorLineNumbersStyle.Relative;
        break;
      case 'interval': // This is a real option but its not in vscode.d.ts
        editor.options.lineNumbers = 3;
        break;
    }
  }

  private async onActiveModeChanged(mode: Mode) {
    if (mode === Mode.Insert) {
      this.statusBarItem.text = '$(pencil) INSERT'
    } else if (mode === Mode.Normal) {
      this.statusBarItem.text = '$(beaker) NORMAL'
    }

    await vscode.commands.executeCommand('setContext', extensionName + '.mode', mode)
  }

  private clearDecorations(editor: vscode.TextEditor) {
    editor.setDecorations(this.normalModeDecoration, [])
  }

  private setDecorations(editor: vscode.TextEditor) {
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

      editor.setDecorations(this.normalModeDecoration, ranges)
    } else {
      editor.setDecorations(this.normalModeDecoration, selections)
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
          if (this.modeMap.get(e.textEditor.document) !== Mode.Insert)
            this.setDecorations(e.textEditor)
        }),

        vscode.workspace.onDidChangeTextDocument(e => {
          const file = this.getFileState(e.document)

          file.changes.push(...e.contentChanges)
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
