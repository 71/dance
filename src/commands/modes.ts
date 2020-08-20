import * as vscode from 'vscode'

import { registerCommand, setRemainingNormalCommands, Command, CommandFlags } from '.'
import { Mode } from '../state/extension'


registerCommand(Command.setInsert, CommandFlags.SwitchToInsertBefore, () => {
  // Nop.
})

registerCommand(Command.setNormal, CommandFlags.SwitchToNormal, () => {
  // Nop.
})

registerCommand(Command.tmpInsert, CommandFlags.SwitchToInsertBefore, (editorState, { repetitions }) => {
  const subscription = vscode.commands.registerCommand('type', (...args) => {
    if (--repetitions === 0) {
      subscription.dispose()
      editorState.setMode(Mode.Normal)
    }

    return vscode.commands.executeCommand('default:type', ...args)
  })
})

registerCommand(Command.tmpNormal, CommandFlags.SwitchToNormal, (_, { repetitions }) => {
  setRemainingNormalCommands(repetitions)
})
