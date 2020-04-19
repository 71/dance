import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, CommandDescriptor } from '.'
import { SelectionSet } from '../utils/selectionSet'


registerCommand(Command.insertBefore, CommandFlags.ChangeSelections | CommandFlags.SwitchToInsertBefore, (_, { selectionSet }) => {
  selectionSet.updateEach(selection => selection.end.inheritPosition(selection.start))
})

registerCommand(Command.insertAfter, CommandFlags.ChangeSelections | CommandFlags.SwitchToInsertAfter, (_, { selectionSet }) => {
  selectionSet.updateEach(selection => selection.start.inheritPosition(selection.end))
})

registerCommand(Command.insertLineStart, CommandFlags.ChangeSelections | CommandFlags.SwitchToInsertBefore, (_, { selectionSet }) => {
  selectionSet.updateEach(selection => {
    selection.active.toFirstNonWhitespaceCharacter()
    selection.collapseToActive()
  })
})

registerCommand(Command.insertLineEnd, CommandFlags.ChangeSelections | CommandFlags.SwitchToInsertAfter, (_, { selectionSet }) => {
  selectionSet.updateEach(selection => {
    selection.active.toEndCharacter()
    selection.collapseToActive()
  })
})

function normalizeSelectionsForLineInsertion(editor: vscode.TextEditor, selectionSet: SelectionSet) {
  if (!selectionSet.enforceNonEmptySelections)
    return

  editor.selections = selectionSet.selections.map(selection => {
    const position = selection.active.beforePosition()

    return new vscode.Selection(position, position)
  })
}

registerCommand(Command.insertNewLineAbove, CommandFlags.Edit | CommandFlags.SwitchToInsertBefore, (editor, { selectionSet }) => {
  normalizeSelectionsForLineInsertion(editor, selectionSet)

  return vscode.commands.executeCommand('editor.action.insertLineBefore')
})

registerCommand(Command.insertNewLineBelow, CommandFlags.Edit | CommandFlags.SwitchToInsertBefore, (editor, { selectionSet }) => {
  normalizeSelectionsForLineInsertion(editor, selectionSet)

  return vscode.commands.executeCommand('editor.action.insertLineAfter')
})

registerCommand(Command.newLineAbove, CommandFlags.Edit, (editor, { selectionSet }) => editor.edit(builder => {
  const newLine = editor.document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n'
  const processedLines = new Set<number>()

  const selections = selectionSet.selections,
        len = selections.length

  for (let i = 0; i < len; i++) {
    const activeLine = selections[i].activeLine

    if (processedLines.size !== processedLines.add(activeLine).size)
      builder.insert(new vscode.Position(activeLine, 0), newLine)
  }
}).then(() => undefined))

registerCommand(Command.newLineBelow, CommandFlags.Edit, (editor, { selectionSet }) => editor.edit(builder => {
  const newLine = editor.document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n'
  const processedLines = new Set<number>()

  const selections = selectionSet.selections,
        len = selections.length

  for (let i = 0; i < len; i++) {
    const activeLine = selections[i].activeLine

    if (processedLines.size !== processedLines.add(activeLine).size)
      builder.insert(editor.document.lineAt(activeLine).rangeIncludingLineBreak.end, newLine)
  }
}).then(() => undefined))

registerCommand(Command.repeatInsert, CommandFlags.Edit, async (editor, state, _, ctx) => {
  const hist = ctx.history.for(editor.document)

  let switchToInsert: undefined | typeof hist.commands[0]
  let i = hist.commands.length - 1

  for (; i >= 0; i--) {
    if (hist.commands[i][0].flags & CommandFlags.SwitchToInsertBefore) {
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

  await editor.edit(builder => {
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
  })
})
