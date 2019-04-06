// Marks: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#marks
import * as vscode from 'vscode'

import { Command, registerCommand, keypress, promptInList } from '.'


registerCommand(Command.registersSelect, async (editor, state) => {
  const key = await keypress()
  const reg = state.registers.get(key)

  state.currentRegister = reg
})

registerCommand(Command.registersInsert, async (editor, state) => {
  throw new Error('Not implemented.')
})


function promptCombine() {
  return promptInList(false,
    ['a', 'Append lists'],
    ['u', 'Union'],
    ['i', 'Intersection'],
    ['<', 'Select leftmost cursor'],
    ['>', 'Select rightmost cursor'],
    ['+', 'Select longest'],
    ['-', 'Select shortest'],
  )
}

function saveSelections(combine: boolean) {

}

function restoreSelections(combine: boolean) {

}

registerCommand(Command.marksSaveSelections, async (editor, state) => {
  const register = state.currentRegister || state.registers.caret
})

registerCommand(Command.marksRestoreSelections, async (editor, state) => {
  const register = state.currentRegister || state.registers.caret
})
