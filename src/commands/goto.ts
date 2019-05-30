import * as vscode from 'vscode'

import { registerCommand, Command, CommandDescriptor, CommandFlags, InputKind } from '.'


const jumps: [string, string][] = [
  ['h', 'go to line start'],
  ['l', 'go to line end'],
  ['i', 'go to non-blank line start'],
  ['g', 'go to first line'],
  ['k', 'go to first line'],
  ['j', 'go to last line'],
  ['e', 'go to last char of last line'],
  ['t', 'go to the first displayed line'],
  ['c', 'go to the middle displayed line'],
  ['b', 'go to the last displayed line'],
  ['a', 'go to previous buffer'],
  ['f', 'go to file whose name is selected'],
  ['.', 'go to last buffer modification position'],
]

function executeGoto(selection: number, count: number, extend: boolean) {

}

registerCommand(Command.goto, CommandFlags.ChangeSelections, InputKind.ListOneItem, jumps, (editor, state, _, ctx) => {
  return executeGoto(state.input, state.currentCount, false)
})

registerCommand(Command.gotoExtend, CommandFlags.ChangeSelections, InputKind.ListOneItem, jumps, (editor, state, _, ctx) => {
  return executeGoto(state.input, state.currentCount, true)
})
