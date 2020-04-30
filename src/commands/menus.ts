import * as vscode from 'vscode'

import { registerCommand, CommandFlags } from '.'
import { promptInList } from '../utils/prompt'
import { Command } from '../../commands'


registerCommand(Command.openMenu, CommandFlags.ChangeSelections, async (_, { argument, extension }) => {
  if (typeof argument !== 'object' || argument === null || typeof argument.menu !== 'string') {
    vscode.window.showErrorMessage(`Invalid argument passed to command ${Command.openMenu}.`)

    return
  }

  const menuName = argument.menu
  const menu = extension.menus.get(menuName)

  if (menu === undefined) {
    vscode.window.showErrorMessage(`Menu ${menuName} does not exist.`)

    return
  }

  const entries = Object.entries(menu.items)
  const items = entries.map(x => [x[0], x[1].text]) as [string, string][]
  const choice = await promptInList(false, items, extension.cancellationTokenSource?.token)

  if (choice === undefined)
    return

  const pickedItem = entries[choice][1]

  try {
    await vscode.commands.executeCommand(pickedItem.command, ...pickedItem.args ?? [])
  } catch (e) {
    const str = `${e}`.replace(/^Error: /, '')

    vscode.window.showErrorMessage(`Command did not succeed successfully: ${str}.`)
  }
})
