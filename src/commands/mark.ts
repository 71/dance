// Marks: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#marks
import * as vscode from 'vscode'

import { Extension } from '../extension'
import { keypress, promptInList } from '../utils/prompt'

import { Command, registerCommand, CommandFlags, InputKind } from '.'


registerCommand(Command.registersSelect, CommandFlags.IgnoreInHistory, InputKind.Key, undefined, async (_, { input: key }, __, ctx) => {
  ctx.currentRegister = ctx.registers.get(key)
})

registerCommand(Command.registersInsert, CommandFlags.None, async (editor, state) => {
  throw new Error('Not implemented.')
})


const combineOpts = [
  ['a', 'Append lists'],
  ['u', 'Union'],
  ['i', 'Intersection'],
  ['<', 'Select leftmost cursor'],
  ['>', 'Select rightmost cursor'],
  ['+', 'Select longest'],
  ['-', 'Select shortest'],
]

// function saveSelections(combine: boolean) {

// }

// function restoreSelections(combine: boolean) {

// }

registerCommand(Command.marksSaveSelections, CommandFlags.IgnoreInHistory, async (editor, state, _, ctx) => {
  const register = ctx.currentRegister || ctx.registers.caret
  ctx.history.for(editor.document).setSelectionsForMark(editor.document, register, editor.selections)
})

registerCommand(Command.marksRestoreSelections, CommandFlags.IgnoreInHistory, async (editor, state, _, ctx) => {
  const register = ctx.currentRegister || ctx.registers.caret
  editor.selections = ctx.history.for(editor.document).getSelectionsForMark(editor.document,register)
})

// registerCommand(Command.marksCombineSelectionsFromCurrent, async (editor, state) => {

// })

// registerCommand(Command.marksCombineSelectionsFromRegister, async (editor, state) => {

// })
