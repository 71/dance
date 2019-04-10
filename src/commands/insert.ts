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

registerCommand(Command.newLineAbove, editor => {
  editor.edit(builder => {
    const newLine = editor.document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n'
    const processedLines = new Set<number>()

    for (const selection of editor.selections) {
      if (processedLines.has(selection.start.line))
        continue

      processedLines.add(selection.start.line)
      builder.insert(selection.start.with(undefined, 0), newLine)
    }
  })
})

registerCommand(Command.newLineBelow, editor => {
  editor.edit(builder => {
    const newLine = editor.document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n'
    const processedLines = new Set<number>()

    for (const selection of editor.selections) {
      if (processedLines.has(selection.end.line))
        continue

      processedLines.add(selection.end.line)
      builder.insert(editor.document.lineAt(selection.end).rangeIncludingLineBreak.end, newLine)
    }
  })
})

registerCommand(Command.repeatInsert, (editor, state) => {
  const file = state.getFileState(editor.document)

  if (file.insertPosition !== undefined) {
    editor.edit(builder => {
      let insertPosition = file.insertPosition!

      for (let i = state.currentCount || 1; i > 0; i--) {
        for (const change of file.changes) {
          builder.insert(insertPosition, change.text)

          insertPosition = insertPosition.translate(0, change.text.length)
        }
      }
    })
  }
})
