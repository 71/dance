import * as vscode from 'vscode'

import { Mode }      from '../commands'
import { Extension } from '../extension'


export async function prompt(state: Extension, opts: vscode.InputBoxOptions, cancellationToken?: vscode.CancellationToken) {
  await state.setMode(Mode.Awaiting)
  const result = await vscode.window.showInputBox(opts, cancellationToken)
  await state.setMode(Mode.Normal)

  return result
}
