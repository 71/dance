import * as vscode from 'vscode'

import { registerCommand, Command } from '.'


registerCommand(Command.historyUndo, () => {
  return vscode.commands.executeCommand('undo')
})

registerCommand(Command.historyRedo, () => {
  return vscode.commands.executeCommand('redo')
})

// registerCommand(Command.historyBackward, (editor, state) => {

// })

// registerCommand(Command.historyForward, (editor, state) => {

// })
