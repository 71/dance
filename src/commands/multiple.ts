// Multiple selections: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#multiple-selections
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, InputKind } from '.'


registerCommand(Command.select, CommandFlags.ChangeSelections, InputKind.RegExp, 'gm', (editor, { input: regex }) => {
  const newSelections = [] as vscode.Selection[]

  for (let i = 0; i < editor.selections.length; i++) {
    const selection = editor.selections[i],
          selectionText = editor.document.getText(selection),
          selectionAnchorOffset = editor.document.offsetAt(selection.start)

    let match: RegExpExecArray | null

    while (match = regex.exec(selectionText)) {
      const anchor = editor.document.positionAt(selectionAnchorOffset + match.index)
      const active = editor.document.positionAt(selectionAnchorOffset + match.index + match[0].length)

      newSelections.unshift(new vscode.Selection(anchor, active))

      if (match[0].length === 0)
        regex.lastIndex++
    }
  }

  if (newSelections.length > 0)
    editor.selections = newSelections
})

registerCommand(Command.split, CommandFlags.ChangeSelections, InputKind.RegExp, 'gm', (editor, { input: regex }) => {
  const newSelections = [] as vscode.Selection[]

  for (let i = 0; i < editor.selections.length; i++) {
    const selection = editor.selections[i],
          selectionText = editor.document.getText(selection),
          selectionAnchorOffset = editor.document.offsetAt(selection.start)

    let match: RegExpExecArray | null
    let index = 0

    while (match = regex.exec(selectionText)) {
      const anchor = editor.document.positionAt(selectionAnchorOffset + index)
      const active = editor.document.positionAt(selectionAnchorOffset + match.index)

      newSelections.push(new vscode.Selection(anchor, active))

      index = match.index + match[0].length

      if (match[0].length === 0)
        regex.lastIndex++
    }

    const lastAnchor = editor.document.positionAt(selectionAnchorOffset + index)
    const lastActive = selection.end

    newSelections.push(new vscode.Selection(lastAnchor, lastActive))
  }

  editor.selections = newSelections
})

registerCommand(Command.splitLines, CommandFlags.ChangeSelections, editor => {
  const newSelections = [] as vscode.Selection[]

  for (let i = 0; i < editor.selections.length; i++) {
    const selection = editor.selections[i]

    if (selection.isSingleLine) {
      newSelections.push(selection)

      continue
    }

    // Add start line
    const startActive = editor.document.lineAt(selection.start.line).range.end

    newSelections.push(new vscode.Selection(selection.start, startActive))

    // Add end line
    newSelections.push(new vscode.Selection(selection.end.with(undefined, 0), selection.end))

    // Add intermediate lines
    for (let i = selection.start.line + 1; i < selection.end.line; i++) {
      const selectionRange = editor.document.lineAt(i).range

      newSelections.push(new vscode.Selection(selectionRange.start, selectionRange.end))
    }
  }

  editor.selections = newSelections
})

registerCommand(Command.selectFirstLast, CommandFlags.ChangeSelections, editor => {
  const newSelections = [] as vscode.Selection[]

  for (let i = 0; i < editor.selections.length; i++) {
    const selection = editor.selections[i]

    if (selection.isEmpty) {
      newSelections.push(selection)

      continue
    }

    // Add start char
    newSelections.push(new vscode.Selection(selection.anchor, selection.anchor.translate(0, 1)))

    // Add end char
    newSelections.push(new vscode.Selection(selection.active.translate(0, -1), selection.active))
  }

  editor.selections = newSelections
})

function tryCopySelection(document: vscode.TextDocument, selection: vscode.Selection, newActiveLine: number) {
  if (selection.active.line === selection.anchor.line) {
    const newLine = document.lineAt(newActiveLine)

    return newLine.range.end.character >= selection.end.character
      ? new vscode.Selection(selection.anchor.with(newActiveLine), selection.active.with(newActiveLine))
      : undefined
  }

  const newAnchorLine = newActiveLine + selection.anchor.line - selection.active.line

  if (newAnchorLine < 0 || newAnchorLine >= document.lineCount)
    return undefined

  const newAnchorLineInfo = document.lineAt(newAnchorLine)

  if (selection.anchor.character > newAnchorLineInfo.range.end.character)
    return undefined

  const newActiveLineInfo = document.lineAt(newActiveLine)

  if (selection.active.character > newActiveLineInfo.range.end.character)
    return undefined

  const newSelection = new vscode.Selection(selection.anchor.with(newAnchorLine), selection.active.with(newActiveLine))

  if (selection.intersection(newSelection) !== undefined)
    return undefined

  return newSelection
}

function copySelection(editor: vscode.TextEditor, count: number, dir: 1 | -1) {
  count = count || 1

  const newSelections = editor.selections.slice()

  for (const selection of editor.selections) {
    let currentLine = selection.active.line + dir

    for (let i = 0; i < count && currentLine >= 0 && currentLine < editor.document.lineCount;) {
      const copiedSelection = tryCopySelection(editor.document, selection, currentLine)

      if (copiedSelection !== undefined) {
        newSelections.push(copiedSelection)
        i++
      }

      currentLine += dir
    }
  }

  editor.selections = newSelections
}

registerCommand(Command.selectCopy, CommandFlags.ChangeSelections, (editor, { currentCount }) => {
  copySelection(editor, currentCount, 1)
})

registerCommand(Command.selectCopyBackwards, CommandFlags.ChangeSelections, (editor, { currentCount }) => {
  copySelection(editor, currentCount, -1)
})
