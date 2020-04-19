// Marks: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#marks
import { Command, registerCommand, CommandFlags, InputKind } from '.'
import { Register } from '../registers'
import { SelectionSet } from '../utils/selectionSet'


registerCommand(Command.registersSelect, CommandFlags.IgnoreInHistory, InputKind.Key, undefined, (_, { input: key }, __, ctx) => {
  ctx.currentRegister = ctx.registers.get(key)
})

registerCommand(Command.registersInsert, CommandFlags.None, (editor, state) => {
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

const marksByRegister = new Map<Register, WeakMap<SelectionSet, SelectionSet.Copy>>()

function marksForRegister(register: Register) {
  let map = marksByRegister.get(register)

  if (map === undefined)
    marksByRegister.set(register, map = new WeakMap())

  return map
}

registerCommand(Command.marksSaveSelections, CommandFlags.None, (_, { currentRegister, selectionSet: selections }, __, ctx) => {
  const marks = marksForRegister(currentRegister ?? ctx.registers.caret)

  marks.get(selections)?.forget()
  marks.set(selections, selections.copy())
})

registerCommand(Command.marksRestoreSelections, CommandFlags.ChangeSelections, (editor, { currentRegister, selectionSet: selections }, _, ctx) => {
  const marks = marksForRegister(currentRegister ?? ctx.registers.caret)

  marks.get(selections)?.commit(editor)
})

// registerCommand(Command.marksCombineSelectionsFromCurrent, async (editor, state) => {

// })

// registerCommand(Command.marksCombineSelectionsFromRegister, async (editor, state) => {

// })
