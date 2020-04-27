import * as vscode from 'vscode'

import { registerCommand, setRemainingNormalCommands, Command, CommandFlags, Mode } from '.'


registerCommand(Command.setInsert, CommandFlags.SwitchToInsertBefore, () => {
  // Nop.
})

registerCommand(Command.setNormal, CommandFlags.SwitchToNormal, () => {
  // Nop.
})

registerCommand(Command.tmpInsert, CommandFlags.SwitchToInsertBefore, (_, { repetitions }, __, ctx) => {
  let subscription = vscode.commands.registerCommand('type', (...args) => {
    if (--repetitions === 0) {
      subscription.dispose()
      ctx.setMode(Mode.Normal)
    }

    return vscode.commands.executeCommand('default:type', ...args)
  })
})

registerCommand(Command.tmpNormal, CommandFlags.SwitchToNormal, (_, { repetitions }) => {
  setRemainingNormalCommands(repetitions)
})
