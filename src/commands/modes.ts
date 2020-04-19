import * as vscode from 'vscode'

import { registerCommand, setRemainingNormalCommands, Command, CommandFlags, Mode } from '.'


registerCommand(Command.setInsert, CommandFlags.SwitchToInsertBefore, () => {})
registerCommand(Command.setNormal, CommandFlags.SwitchToNormal, () => {})

registerCommand(Command.tmpInsert, CommandFlags.SwitchToInsertBefore, (_, { repetitions }, __, ctx) => {
  let subscription = vscode.commands.registerCommand('type', (...args) => {
    if (--repetitions === 0) {
      subscription.dispose()
      ctx.setMode(Mode.Normal)
    }

    return vscode.commands.executeCommand('default:type', ...args)
  })
})

registerCommand(Command.tmpNormal, CommandFlags.SwitchToNormal, (_, state) => {
  let count = state.currentCount || 1

  setRemainingNormalCommands(count)
})
