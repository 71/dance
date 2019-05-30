import * as vscode from 'vscode'

import { Command, registerCommand, CommandFlags } from '.'


registerCommand(Command.insertBefore, CommandFlags.ChangeSelections | CommandFlags.SwitchToInsert, editor => {
  editor.selections = editor.selections.map(x => new vscode.Selection(x.anchor, x.anchor))
})

registerCommand(Command.insertAfter, CommandFlags.ChangeSelections | CommandFlags.SwitchToInsert, editor => {
  editor.selections = editor.selections.map(x => new vscode.Selection(x.active, x.active))
})

registerCommand(Command.insertLineStart, CommandFlags.ChangeSelections | CommandFlags.SwitchToInsert, editor => {
  editor.selections = editor.selections.map(x => {
    const anchor = editor.document.lineAt(x.active.line).range.start

    return new vscode.Selection(anchor, anchor)
  })
})

registerCommand(Command.insertLineEnd, CommandFlags.ChangeSelections | CommandFlags.SwitchToInsert, editor => {
  editor.selections = editor.selections.map(x => {
    const anchor = editor.document.lineAt(x.active.line).range.end

    return new vscode.Selection(anchor, anchor)
  })
})

registerCommand(Command.insertNewLineAbove, CommandFlags.Edit | CommandFlags.SwitchToInsert, () => {
  return vscode.commands.executeCommand('editor.action.insertLineBefore')
})

registerCommand(Command.insertNewLineBelow, CommandFlags.Edit | CommandFlags.SwitchToInsert, () => {
  return vscode.commands.executeCommand('editor.action.insertLineAfter')
})

registerCommand(Command.newLineAbove, CommandFlags.Edit, editor => builder => {
  const newLine = editor.document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n'
  const processedLines = new Set<number>()

  for (const selection of editor.selections) {
    if (processedLines.has(selection.start.line))
      continue

    processedLines.add(selection.start.line)
    builder.insert(selection.start.with(undefined, 0), newLine)
  }
})

registerCommand(Command.newLineBelow, CommandFlags.Edit, editor => builder => {
  const newLine = editor.document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n'
  const processedLines = new Set<number>()

  for (const selection of editor.selections) {
    if (processedLines.has(selection.end.line))
      continue

    processedLines.add(selection.end.line)
    builder.insert(editor.document.lineAt(selection.end).rangeIncludingLineBreak.end, newLine)
  }
})

registerCommand(Command.repeatInsert, CommandFlags.Edit, (editor, state, _, ctx) => {
  const file = ctx.getFileState(editor.document)

  if (file.insertPosition !== undefined) {
    return builder => {
      let insertPosition = file.insertPosition!

      for (let i = state.currentCount || 1; i > 0; i--) {
        for (const change of file.changes) {
          builder.insert(insertPosition, change.text)

          insertPosition = insertPosition.translate(0, change.text.length)
        }
      }
    }
  } else {
    return undefined
  }
})
