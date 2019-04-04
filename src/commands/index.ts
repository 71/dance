import * as vscode from 'vscode'

import { Command } from '../../commands'
import { state, Extension } from '../extension'

export import Command = Command

export const enum Mode {
  Disabled = 'disabled',

  Normal = 'normal',
  Insert = 'insert',

  Awaiting = 'awaiting',
}

export type Action = (editor: vscode.TextEditor, state: Extension) => void | Thenable<any>

export const commands: { register(state: Extension): vscode.Disposable }[] = []

export function registerCommand(command: Command, action: Action) {
  commands.push({
    register(state: Extension) {
      return vscode.commands.registerCommand(command, () => {
        const editor = vscode.window.activeTextEditor

        if (editor !== undefined)
          action(editor, state)

        if (!command.startsWith('count.'))
          state.currentCount = 0
      })
    }
  })
}

export function keypress(): Thenable<string> {
  return state
    .setMode(Mode.Awaiting)
    .then(() =>
      new Promise(resolve => {
        try {
          let subscription = vscode.commands.registerCommand('type', async ({ text }: { text: string}) => {
            await state.setMode(Mode.Normal)

            subscription.dispose()
            resolve(text)
          })
        } catch {
          vscode.window.showErrorMessage('Unable to listen to keyboard events; is an extension overriding the "type" command (e.g VSCodeVim)?')
        }
      }))
}

import './changes'
import './count'
import './insert'
import './move'
import './multiple'
import './pipe'
import './search'
import './select'
