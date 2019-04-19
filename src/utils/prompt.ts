import * as vscode from 'vscode'

import { Mode }      from '../commands'
import { Extension } from '../extension'


export function prompt(state: Extension, opts: vscode.InputBoxOptions, cancellationToken?: vscode.CancellationToken) {
  return state.setMode(Mode.Awaiting)
              .then(() => vscode.window.showInputBox(opts, cancellationToken))
              .then(result => state.setMode(Mode.Normal).then(() => result))
}

export function promptRegex(flags?: string) {
  return vscode.window.showInputBox({
    prompt: 'Selection RegExp',
    validateInput(input) {
      try {
        new RegExp(input)

        return undefined
      } catch {
        return 'Invalid ECMA RegExp.'
      }
    }
  }).then(x => x === undefined ? undefined : new RegExp(x, flags))
}
