// Marks: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#marks
import { Command, registerCommand, CommandFlags, InputKind } from '.'


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

// registerCommand(Command.marksSaveSelections, async (editor, state) => {
//   const register = state.currentRegister || state.registers.caret
// })

// registerCommand(Command.marksRestoreSelections, async (editor, state) => {
//   const register = state.currentRegister || state.registers.caret
// })

// registerCommand(Command.marksCombineSelectionsFromCurrent, async (editor, state) => {

// })

// registerCommand(Command.marksCombineSelectionsFromRegister, async (editor, state) => {

// })
