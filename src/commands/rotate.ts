import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags } from '.'
import { Selection } from '../utils/selections'


function rotateSelections(selections: Selection[]) {
  const last = selections.length - 1,
        firstSelection = selections[0]

  for (let i = 0; i < last; i++)
    selections[i] = selections[i + 1]

  selections[last] = firstSelection
}

function rotateSelectionsBackwards(selections: Selection[]) {
  const last = selections.length - 1,
        lastSelection = selections[last]

  for (let i = last; i > 0; i--)
    selections[i] = selections[i - 1]

  selections[0] = lastSelection
}

registerCommand(Command.rotate, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.updateAll(editor, rotateSelections)
})

registerCommand(Command.rotateBackwards, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.updateAll(editor, rotateSelectionsBackwards)
})


function rotateSelectionsContent(editor: vscode.TextEditor) {
  return editor.edit(builder => {
    const { document: doc, selections } = editor

    for (let i = 0; i < selections.length - 1; i++)
      builder.replace(selections[i + 1], doc.getText(selections[i]))

    builder.replace(selections[0], doc.getText(selections[selections.length - 1]))
  })
}

function rotateSelectionsContentBackwards(editor: vscode.TextEditor) {
  return editor.edit(builder => {
    const { document, selections } = editor

    for (let i = 0; i < selections.length - 1; i++)
      builder.replace(selections[i], document.getText(selections[i + 1]))

    builder.replace(selections[selections.length - 1], document.getText(selections[0]))
  })
}

registerCommand(Command.rotateContentOnly, CommandFlags.Edit, editor => rotateSelectionsContent(editor).then(() => {}))
registerCommand(Command.rotateContentOnlyBackwards, CommandFlags.Edit, editor => rotateSelectionsContentBackwards(editor).then(() => {}))

registerCommand(Command.rotateContent, CommandFlags.ChangeSelections | CommandFlags.Edit, (editor, { selectionSet: selections }) => {
  return rotateSelectionsContent(editor).then(() => selections.updateAll(editor, rotateSelections))
})

registerCommand(Command.rotateContentBackwards, CommandFlags.ChangeSelections | CommandFlags.Edit, (editor, { selectionSet: selections }) => {
  return rotateSelectionsContentBackwards(editor).then(() => selections.updateAll(editor, rotateSelectionsBackwards))
})
