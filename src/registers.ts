import * as vscode from 'vscode'


export interface Register {
  readonly name: string

  canWrite(): this is WritableRegister
  get(editor: vscode.TextEditor): Thenable<string[] | undefined>
}

export interface WritableRegister extends Register {
  set(editor: vscode.TextEditor, values: string[]): Thenable<void>
}

export class GeneralPurposeRegister implements Register {
  values: string[] | undefined
  canWrite() { return !this.readonly }

  constructor(readonly name: string, readonly readonly = false) {}

  set(editor: vscode.TextEditor, values: string[]) {
    this.values = values
  }

  get(editor: vscode.TextEditor) {
    return Promise.resolve(this.values)
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

export class Registers {
  readonly alpha: Record<string, GeneralPurposeRegister> = {}

  readonly dquote  = new SpecialRegister('"', () => vscode.env.clipboard.readText().then(x => [x]),
                                              (_, v) => vscode.env.clipboard.writeText(v[0]))

  readonly slash   = new GeneralPurposeRegister('/')
  readonly arobase = new GeneralPurposeRegister('@')
  readonly caret   = new GeneralPurposeRegister('^')
  readonly pipe    = new GeneralPurposeRegister('|')

  readonly percent    = new SpecialRegister('%', async editor => [editor.document.fileName])
  readonly dot        = new SpecialRegister('.', async editor => editor.selections.map(editor.document.getText))
  readonly hash       = new SpecialRegister('#', async editor => editor.selections.map((_, i) => i.toString()))
  readonly underscore = new SpecialRegister('_', async ______ => [''])
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
