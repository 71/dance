import * as vscode from 'vscode'

import { CommandDescriptor, CommandState } from './commands'


export interface Register {
  readonly name: string

  canWrite(): this is WritableRegister
  get(editor: vscode.TextEditor): Thenable<string[] | undefined>
}

export interface MacroRegister {
  getMacro(): [CommandDescriptor<any>, CommandState<any>][] | undefined
  setMacro(data: [CommandDescriptor<any>, CommandState<any>][]): void
}

export interface WritableRegister extends Register {
  set(editor: vscode.TextEditor, values: string[]): Thenable<void>
}

export class GeneralPurposeRegister implements Register, WritableRegister, MacroRegister {
  values: string[] | undefined
  macroCommands: [CommandDescriptor<any>, CommandState<any>][] | undefined

  canWrite() { return !this.readonly }

  constructor(readonly name: string, readonly readonly = false) {}

  set(_: vscode.TextEditor, values: string[]) {
    this.values = values

    return Promise.resolve()
  }

  get() {
    return Promise.resolve(this.values)
  }

  getMacro() {
    return this.macroCommands
  }

  setMacro(data: [CommandDescriptor<any>, CommandState<any>][]) {
    this.macroCommands = data
  }
}

export class SpecialRegister implements Register {
  canWrite() {
    return this.setter !== undefined
  }

  constructor(
    readonly name: string,
    readonly getter : (editor: vscode.TextEditor) => Thenable<string[]>,
    readonly setter?: (editor: vscode.TextEditor, values: string[]) => Thenable<void>,
  ) {}

  get(editor: vscode.TextEditor) {
    return this.getter(editor)
  }

  set(editor: vscode.TextEditor, values: string[]) {
    if (this.setter === undefined)
      throw new Error('Cannot set read-only register.')

    return this.setter(editor, values)
  }
}

export class ClipboardRegister implements Register {
  private lastSelections!: string[]
  private lastText!: string

  readonly name = '"'

  canWrite() {
    return true
  }

  async get() {
    const text = await vscode.env.clipboard.readText()

    return this.lastText === text
      ? this.lastSelections
      : [text]
  }

  set(editor: vscode.TextEditor, values: string[]) {
    this.lastSelections = values
    this.lastText = values.join(editor.document.eol === 1 ? '\n' : '\r\n')

    return vscode.env.clipboard.writeText(this.lastText)
  }
}

export class Registers {
  readonly alpha: Record<string, GeneralPurposeRegister> = {}

  readonly dquote  = new ClipboardRegister()
  readonly slash   = new GeneralPurposeRegister('/')
  readonly arobase = new GeneralPurposeRegister('@')
  readonly caret   = new GeneralPurposeRegister('^')
  readonly pipe    = new GeneralPurposeRegister('|')

  readonly percent    = new SpecialRegister('%', editor => Promise.resolve([editor.document.fileName]))
  readonly dot        = new SpecialRegister('.', editor => Promise.resolve(editor.selections.map(editor.document.getText)))
  readonly hash       = new SpecialRegister('#', editor => Promise.resolve(editor.selections.map((_, i) => i.toString())))
  readonly underscore = new SpecialRegister('_', ______ => Promise.resolve(['']))
  readonly colon      = new GeneralPurposeRegister(':', true)

  get(key: string) {
    switch (key) {
      case '"': return this.dquote
      case '/': return this.slash
      case '@': return this.arobase
      case '^': return this.caret
      case '|': return this.pipe

      case '%': return this.percent
      case '.': return this.dot
      case '#': return this.hash
      case '_': return this.underscore
      case ':': return this.colon

      default:
        return this.alpha[key] || (this.alpha[key] = new GeneralPurposeRegister(key))
    }
  }
}
