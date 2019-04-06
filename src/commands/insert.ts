import * as vscode from 'vscode'

import { Command, Mode, registerCommand } from '.'


registerCommand(Command.insertBefore, (editor, state) => {
  editor.selections = editor.selections.map(x => new vscode.Selection(x.anchor, x.anchor))

  return state.setMode(Mode.Insert)
})

registerCommand(Command.insertAfter, (editor, state) => {
  editor.selections = editor.selections.map(x => new vscode.Selection(x.active, x.active))

  return state.setMode(Mode.Insert)
})

registerCommand(Command.insertLineStart, (editor, state) => {
  editor.selections = editor.selections.map(x => {
    const anchor = editor.document.lineAt(x.active.line).range.start

    return new vscode.Selection(anchor, anchor)
  })

  return state.setMode(Mode.Insert)
})

registerCommand(Command.insertLineEnd, (editor, state) => {
  editor.selections = editor.selections.map(x => {
    const anchor = editor.document.lineAt(x.active.line).range.end

    return new vscode.Selection(anchor, anchor)
  })

  return state.setMode(Mode.Insert)
})

registerCommand(Command.insertNewLineAbove, async (_, state) => {
  await vscode.commands.executeCommand('editor.action.insertLineBefore')

  await state.setMode(Mode.Insert)
})

registerCommand(Command.insertNewLineBelow, async (_, state) => {
  await vscode.commands.executeCommand('editor.action.insertLineAfter')

  await state.setMode(Mode.Insert)
})
