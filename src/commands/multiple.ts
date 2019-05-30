// Multiple selections: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#multiple-selections
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, InputKind } from '.'


registerCommand(Command.select, CommandFlags.ChangeSelections, InputKind.RegExp, 'g', async (editor, { input: regex }) => {
  const newSelections = [] as vscode.Selection[]

  for (let i = 0; i < editor.selections.length; i++) {
    const selection = editor.selections[i]
    const selectionText         = editor.document.getText(selection)
    const selectionAnchorOffset = editor.document.offsetAt(selection.start)

    let match: RegExpExecArray | null

    while (match = regex.exec(selectionText)) {
      const anchor = editor.document.positionAt(selectionAnchorOffset + match.index)
      const active = editor.document.positionAt(selectionAnchorOffset + match.index + match[0].length)

      newSelections.push(new vscode.Selection(anchor, active))
    }
  }

  editor.selections = newSelections
})

registerCommand(Command.split, CommandFlags.ChangeSelections, InputKind.RegExp, 'g', async (editor, { input: regex }) => {
  const newSelections = [] as vscode.Selection[]

  for (let i = 0; i < editor.selections.length; i++) {
    const selection = editor.selections[i]
    const selectionText         = editor.document.getText(selection)
    const selectionAnchorOffset = editor.document.offsetAt(selection.start)

    let match: RegExpExecArray | null
    let index = 0

    while (match = regex.exec(selectionText)) {
      const anchor = editor.document.positionAt(selectionAnchorOffset + index)
      const active = editor.document.positionAt(selectionAnchorOffset + match.index)

      newSelections.push(new vscode.Selection(anchor, active))

      index = match.index + match[0].length
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
    for (let i = selection.anchor.line + 1; i < selection.active.line; i++) {
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
