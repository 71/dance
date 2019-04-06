import * as vscode from 'vscode'

import { Command, Mode, registerCommand, setRemainingNormalCommands } from '.'


registerCommand(Command.setInsert, (_, state) => {
  state.setMode(Mode.Insert)
})

registerCommand(Command.setNormal, (_, state) => {
  state.setMode(Mode.Normal)
})

registerCommand(Command.tmpInsert, (_, state) => {
  let count = state.currentCount || 1

  let subscription = vscode.commands.registerCommand('type', (...args) => {
    if (--count === 0) {
      subscription.dispose()
      state.setMode(Mode.Normal)
    }

    return vscode.commands.executeCommand('default:type', ...args)
  })

  return state.setMode(Mode.Insert)
})

registerCommand(Command.tmpNormal, (_, state) => {
  let count = state.currentCount || 1

  setRemainingNormalCommands(count)

  return state.setMode(Mode.Normal)
})
