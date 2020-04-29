// Marks: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#marks
import * as vscode from 'vscode'

import { Command, registerCommand, CommandFlags, InputKind } from '.'
import { Register } from '../registers'
import { SavedSelection } from '../utils/savedSelection'


registerCommand(Command.registersSelect, CommandFlags.IgnoreInHistory, InputKind.Key, undefined, (_, { extension, input: key }) => {
  extension.currentRegister = extension.registers.get(key)
})


const marksByRegister = new Map<Register, WeakMap<vscode.TextDocument, readonly SavedSelection[]>>()

function marksForRegister(register: Register) {
  let map = marksByRegister.get(register)

  if (map === undefined)
    marksByRegister.set(register, map = new WeakMap())

  return map
}

registerCommand(Command.marksSaveSelections, CommandFlags.None, ({ editor, extension, documentState }, { currentRegister }) => {
  const map = marksForRegister(currentRegister ?? extension.registers.caret),
        existingMarks = map.get(editor.document)

  if (existingMarks !== undefined)
    documentState.forgetSelections(existingMarks)

  map.set(editor.document, editor.selections.map(selection => documentState.saveSelection(selection)))
})

registerCommand(Command.marksRestoreSelections, CommandFlags.ChangeSelections, ({ editor, extension }, { currentRegister }) => {
  const map = marksForRegister(currentRegister ?? extension.registers.caret),
        marks = map.get(editor.document)

  if (marks !== undefined)
    editor.selections = marks.map(savedSelection => savedSelection.selection(editor.document))
})


const combineOpts: [string, string][] = [
  ['a', 'Append lists'],
  ['u', 'Union'],
  ['i', 'Intersection'],
  ['<', 'Select leftmost cursor'],
  ['>', 'Select rightmost cursor'],
  ['+', 'Select longest'],
  ['-', 'Select shortest'],
]

function combineSelections(editor: vscode.TextEditor, from: vscode.Selection[], add: vscode.Selection[], type: number) {
  if (type === 0) {
    editor.selections = from.concat(add)

    return
  }

  if (from.length !== add.length) {
    vscode.window.showErrorMessage(`The current selections and marked selections do not have the same number of elements.`)

    return
  }

  const selections = [] as vscode.Selection[]

  for (let i = 0; i < from.length; i++) {
    const a = from[i],
          b = add[i]

    switch (type) {
      case 1: {
        const anchor = a.start.isBefore(b.start) ? a.start : b.start,
              active = a.end.isAfter(b.end) ? a.end : b.end

        selections.push(new vscode.Selection(anchor, active))
        break
      }

      case 2: {
        const anchor = a.start.isAfter(b.start) ? a.start : b.start,
              active = a.end.isBefore(b.end) ? a.end : b.end

        selections.push(new vscode.Selection(anchor, active))
        break
      }

      case 3:
        if (a.active.isBeforeOrEqual(b.active))
          selections.push(a)
        else
          selections.push(b)
        break

      case 4:
        if (a.active.isAfterOrEqual(b.active))
          selections.push(a)
        else
          selections.push(b)
        break

      case 5: {
        const aLength = editor.document.offsetAt(a.end) - editor.document.offsetAt(a.start),
              bLength = editor.document.offsetAt(b.end) - editor.document.offsetAt(b.start)

        if (aLength > bLength)
          selections.push(a)
        else
          selections.push(b)
        break
      }

      case 6: {
        const aLength = editor.document.offsetAt(a.end) - editor.document.offsetAt(a.start),
              bLength = editor.document.offsetAt(b.end) - editor.document.offsetAt(b.start)

        if (aLength < bLength)
          selections.push(a)
        else
          selections.push(b)
        break
      }
    }
  }

  editor.selections = selections
}

registerCommand(Command.marksCombineSelectionsFromCurrent, CommandFlags.ChangeSelections, InputKind.ListOneItem, combineOpts, ({ editor, extension }, { currentRegister, input }) => {
  const map = marksForRegister(currentRegister ?? extension.registers.caret),
        marks = map.get(editor.document)

  if (marks === undefined)
    return

  combineSelections(editor, editor.selections, marks.map(savedSelection => savedSelection.selection(editor.document)), input)
})

registerCommand(Command.marksCombineSelectionsFromRegister, CommandFlags.ChangeSelections, InputKind.ListOneItem, combineOpts, ({ editor, extension }, { currentRegister, input }) => {
  const map = marksForRegister(currentRegister ?? extension.registers.caret),
        marks = map.get(editor.document)

  if (marks === undefined)
    return

  combineSelections(editor, marks.map(savedSelection => savedSelection.selection(editor.document)), editor.selections, input)
})
