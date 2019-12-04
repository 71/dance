import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, CommandDescriptor, Mode } from '.'


registerCommand(Command.insertBefore, CommandFlags.ChangeSelections | CommandFlags.SwitchToInsert, editor => {
  editor.selections = editor.selections.map(x => new vscode.Selection(x.start, x.start))
})

registerCommand(Command.insertAfter, CommandFlags.ChangeSelections | CommandFlags.SwitchToInsert, editor => {
  editor.selections = editor.selections.map(x => new vscode.Selection(x.end, x.end))
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

registerCommand(Command.repeatInsert, CommandFlags.Edit, async (editor, state, _, ctx) => {
  const hist = ctx.history.for(editor.document)

  let switchToInsert: undefined | typeof hist.commands[0]
  let i = hist.commands.length - 1

  for (; i >= 0; i--) {
    if (hist.commands[i][0].flags & CommandFlags.SwitchToInsert) {
      switchToInsert = hist.commands[i]
      break
    }
  }

  if (switchToInsert === undefined)
    return

  let start = i
  let switchToNormal: undefined | typeof hist.commands[0]

  for (i++; i < hist.commands.length; i++) {
    if (hist.commands[i][0].flags & CommandFlags.SwitchToNormal) {
      switchToNormal = hist.commands[i]
      break
    }
  }

  if (switchToNormal === undefined)
    return

  await CommandDescriptor.execute(ctx, editor, ...hist.commands[start])

  let end = i

  return (builder: vscode.TextEditorEdit) => {
    for (let i = state.currentCount || 1; i > 0; i--) {
      for (let j = start; j <= end; j++) {
        const state = hist.commands[j][1],
              changes = hist.changes.get(state)

        if (changes === undefined)
          continue

        for (const change of changes) {
          if (change.rangeLength === 0) {
            builder.insert(editor.selection.active, change.text)
          } else {
            builder.replace(editor.selection, change.text)
          }
        }
      }
    }
  }
})
