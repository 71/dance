import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags } from '.'


function rotateSelections(editor: vscode.TextEditor) {
  const selections = editor.selections.slice(),
        last = selections.length - 1,
        firstSelection = selections[0]

  for (let i = 0; i < last; i++)
    selections[i] = selections[i + 1]

  selections[last] = firstSelection
  editor.selections = selections
}

function rotateSelectionsBackwards(editor: vscode.TextEditor) {
  const selections = editor.selections.slice(),
        last = selections.length - 1,
        lastSelection = selections[last]

  for (let i = last; i > 0; i--)
    selections[i] = selections[i - 1]

  selections[0] = lastSelection
  editor.selections = selections
}

function rotateSelectionsContent(editor: vscode.TextEditor, undoStops: { undoStopBefore: boolean, undoStopAfter: boolean }) {
  return editor.edit(builder => {
    const { document: doc, selections } = editor

    for (let i = 0; i < selections.length - 1; i++)
      builder.replace(selections[i + 1], doc.getText(selections[i]))

    builder.replace(selections[0], doc.getText(selections[selections.length - 1]))
  }, undoStops)
}

function rotateSelectionsContentBackwards(editor: vscode.TextEditor, undoStops: { undoStopBefore: boolean, undoStopAfter: boolean }) {
  return editor.edit(builder => {
    const { document, selections } = editor

    for (let i = 0; i < selections.length - 1; i++)
      builder.replace(selections[i], document.getText(selections[i + 1]))

    builder.replace(selections[selections.length - 1], document.getText(selections[0]))
  }, undoStops)
}

registerCommand(Command.rotate, CommandFlags.ChangeSelections, (editor) =>
  rotateSelections(editor))

registerCommand(Command.rotateBackwards, CommandFlags.ChangeSelections, (editor) =>
  rotateSelectionsBackwards(editor))

registerCommand(Command.rotateContentOnly, CommandFlags.Edit, (editor, _, undoStops) =>
  rotateSelectionsContent(editor, undoStops).then(() => {}))

registerCommand(Command.rotateContentOnlyBackwards, CommandFlags.Edit, (editor, _, undoStops) =>
  rotateSelectionsContentBackwards(editor, undoStops).then(() => {}))

registerCommand(Command.rotateContent, CommandFlags.ChangeSelections | CommandFlags.Edit, (editor, _, undoStops) =>
  rotateSelectionsContent(editor, undoStops).then(() => rotateSelections(editor)))

registerCommand(Command.rotateContentBackwards, CommandFlags.ChangeSelections | CommandFlags.Edit, (editor, _, undoStops) =>
  rotateSelectionsContentBackwards(editor, undoStops).then(() => rotateSelectionsBackwards(editor)))
