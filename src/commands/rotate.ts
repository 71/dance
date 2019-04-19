import * as vscode from 'vscode'

import { registerCommand, Command } from '.'


function rotateSelections(selections: vscode.Selection[]) {
  const last = selections.length - 1,
        firstSelection = selections[0]

  for (let i = 0; i < last; i++)
    selections[i] = selections[i + 1]

  selections[last] = firstSelection

  return selections
}

function rotateSelectionsBackwards(selections: vscode.Selection[]) {
  const last = selections.length - 1,
        lastSelection = selections[last]

  for (let i = last; i > 0; i--)
    selections[i] = selections[i - 1]

  selections[0] = lastSelection

  return selections
}

registerCommand(Command.rotate, editor => {
  editor.selections = rotateSelections(editor.selections)
})

registerCommand(Command.rotateBackwards, editor => {
  editor.selections = rotateSelectionsBackwards(editor.selections)
})


function rotateSelectionsContent(editor: vscode.TextEditor) {
  return editor.edit(builder => {
    const doc = editor.document

    for (let i = 0; i < editor.selections.length - 1; i++)
      builder.replace(editor.selections[i + 1], doc.getText(editor.selections[i]))

    builder.replace(editor.selections[0], doc.getText(editor.selections[editor.selections.length - 1]))
  })
}

function rotateSelectionsContentBackwards(editor: vscode.TextEditor) {
  return editor.edit(builder => {
    const doc = editor.document

    for (let i = 0; i < editor.selections.length - 1; i++)
      builder.replace(editor.selections[i], doc.getText(editor.selections[i + 1]))

    builder.replace(editor.selections[editor.selections.length - 1], doc.getText(editor.selections[0]))
  })
}

registerCommand(Command.rotateContentOnly, rotateSelectionsContent)

registerCommand(Command.rotateContentOnlyBackwards, rotateSelectionsContentBackwards)

registerCommand(Command.rotateContent, editor => {
  return rotateSelectionsContent(editor)
          .then(() => editor.selections = rotateSelections(editor.selections))
})

registerCommand(Command.rotateContentBackwards, editor => {
  return rotateSelectionsContentBackwards(editor)
          .then(() => editor.selections = rotateSelectionsBackwards(editor.selections))
})
