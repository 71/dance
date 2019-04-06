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

export let remainingNormalCommands = 0

export function registerCommand(command: Command, action: Action) {
  commands.push({
    register(state: Extension) {
      return vscode.commands.registerCommand(command, async () => {
        const editor = vscode.window.activeTextEditor

        if (editor !== undefined)
          await action(editor, state)

        if (!command.startsWith('dance.count.'))
          state.currentCount = 0

        if (remainingNormalCommands === 1) {
          remainingNormalCommands = 0

          await state.setMode(Mode.Insert)
        } else if (remainingNormalCommands > 1) {
          remainingNormalCommands--
        }
      })
    }
  })
}

export function setRemainingNormalCommands(remaining: number) {
  remainingNormalCommands = remaining + 1 // Gotta add 1 to account for the currently executing command
}

export function keypress(cancellationToken?: vscode.CancellationToken): Thenable<string> {
  return state
    .setMode(Mode.Awaiting)
    .then(() =>
      new Promise(resolve => {
        try {
          let done = false
          let subscription = vscode.commands.registerCommand('type', async ({ text }: { text: string}) => {
            if (!done) {
              await state.setMode(Mode.Normal)

              subscription.dispose()
              done = true

              resolve(text)
            }
          })

          if (cancellationToken !== undefined)
            cancellationToken.onCancellationRequested(() => {
              if (!done) {
                subscription.dispose()
                done = true

                return state.setMode(Mode.Normal)
              }

              return undefined
            })
        } catch {
          vscode.window.showErrorMessage('Unable to listen to keyboard events; is an extension overriding the "type" command (e.g VSCodeVim)?')
        }
      }))
}

export function promptInList(canPickMany: true , ...items: [string, string][]): Thenable<undefined | number[]>
export function promptInList(canPickMany: false, ...items: [string, string][]): Thenable<undefined | number>

export function promptInList(canPickMany: boolean, ...items: [string, string][]): Thenable<undefined | number | number[]> {
  return new Promise(resolve => {
    const quickPick = vscode.window.createQuickPick()

    quickPick.title = 'Object'
    quickPick.items = items.map(x => ({ label: x[0], description: x[1] }))
    quickPick.placeholder = 'Press one of the below keys.'
    quickPick.onDidChangeValue(key => {
      const index = items.findIndex(x => x[0].split(', ').includes(key))

      if (index === -1) {
        quickPick.value = ''

        return
      }

      quickPick.dispose()

      if (canPickMany)
        resolve(index === -1 ? undefined : [ index ])
      else
        resolve(index === -1 ? undefined : index)
    })

    quickPick.onDidHide(() => {
      const picked = quickPick.selectedItems

      quickPick.dispose()

      if (picked === undefined)
        resolve(undefined)

      if (canPickMany)
        resolve(picked.map(x => items.findIndex(item => item[1] === x.description)))
      else
        resolve(items.findIndex(x => x[1] === picked[0].description))
    })

    quickPick.show()
  })
}

import './changes'
import './count'
import './insert'
import './modes'
import './move'
import './multiple'
import './pipe'
import './search'
import './select'
import './selectObject'
