import * as vscode from 'vscode'


export interface Register {
  readonly name: string

  canWrite(): this is WritableRegister
  get(editor: vscode.TextEditor): string[] | undefined
}

export interface WritableRegister extends Register {
  set(values: string[]): void
}

export class GeneralPurposeRegister implements Register {
  values: string[] | undefined
  canWrite() { return !this.readonly }

  constructor(readonly name: string, readonly readonly = false) {}

  set(values: string[]) {
    this.values = values
  }

  get(editor: vscode.TextEditor) {
    return this.values
  }
}

export class SpecialRegister implements Register {
  canWrite() {
    return false
  }

  constructor(readonly name: string, readonly f: (editor: vscode.TextEditor) => string[]) {}

  get(editor: vscode.TextEditor) {
    return this.f(editor)
  }
}

export class Registers {
  readonly alpha: Record<string, GeneralPurposeRegister> = {}

  readonly dquote  = new GeneralPurposeRegister('"')
  readonly slash   = new GeneralPurposeRegister('/')
  readonly arobase = new GeneralPurposeRegister('@')
  readonly caret   = new GeneralPurposeRegister('^')
  readonly pipe    = new GeneralPurposeRegister('|')

  readonly percent   = new SpecialRegister('%', editor => [editor.document.fileName])
  readonly dot       = new SpecialRegister('.', editor => editor.selections.map(editor.document.getText))
  readonly hash      = new SpecialRegister('#', editor => editor.selections.map((_, i) => i.toString()))
  readonly undersoce = new SpecialRegister('_', editor => [''])
  readonly colon     = new GeneralPurposeRegister(':', true)

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
      case '_': return this.undersoce
      case ':': return this.colon

      default:
        return this.alpha[key] || (this.alpha[key] = new GeneralPurposeRegister(key))
    }
  }
}
