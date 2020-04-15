// Select / extend: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, InputKind, CommandState } from '.'
import { Selection, Position, Direction, Forward, Backward } from '../utils/selections'


registerCommand(Command.selectionsReduce, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.updateEach(editor, selection => selection.anchor.inheritPosition(selection.active))
})

registerCommand(Command.selectionsFlip, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.updateEach(editor, selection => selection.anchor.swap(selection.active))
})

registerCommand(Command.selectionsForward, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.updateEach(editor, selection => selection.isReversed ? selection.anchor.swap(selection.active) : undefined)
})

registerCommand(Command.selectionsBackward, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.updateEach(editor, selection => selection.isReversed ? undefined : selection.anchor.swap(selection.active))
})

registerCommand(Command.selectionsMerge, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.updateAll(editor, selections => {
    // VS Code automatically merges overlapping selections, so here
    // all we have to do is to merge non-overlapping contiguous selections
    for (let i = 0, len = selections.length; i < len; i++) {
      const refSel = selections[i]
      const refLine = refSel.start.textLine()

      if (refSel.end.character !== refLine.range.end.character)
        // Not at the end of the line? We don't care.
        continue

      for (let j = 0; j < len; j++) {
        if (i === j)
          continue

        const cmpSel = selections[j]

        if (cmpSel.start.character !== 0)
          // Not at the beginning of the line? We don't care.
          continue

        selections.splice(j, 1)
        selections[i--].end.inheritPosition(cmpSel.end)
        len--

        break
      }
    }
  })
})

registerCommand(Command.selectionsAlign, CommandFlags.Edit, editor => {
  const startChar = editor.selections.reduce((max, sel) => sel.start.character > max ? sel.start.character : max, 0)

  return editor.edit(builder => {
    for (const selection of editor.selections)
      builder.insert(selection.start, ' '.repeat(startChar - selection.start.character))
  }).then(() => undefined)
})

registerCommand(Command.selectionsAlignCopy, CommandFlags.Edit, (editor, state) => {
  const sourceSelection = editor.selections[state.currentCount - 1] ?? editor.selection
  const sourceIndent = editor.document.lineAt(sourceSelection.start).firstNonWhitespaceCharacterIndex

  return editor.edit(builder => {
    for (let i = 0; i < editor.selections.length; i++) {
      if (i === sourceSelection.start.line)
        continue

      const line = editor.document.lineAt(editor.selections[i].start)
      const indent = line.firstNonWhitespaceCharacterIndex

      if (indent > sourceIndent)
        builder.delete(line.range.with(undefined, line.range.start.translate(undefined, indent - sourceIndent)))
      else if (indent < sourceIndent)
        builder.insert(line.range.start, ' '.repeat(indent - sourceIndent))
    }
  }).then(() => undefined)
})

registerCommand(Command.selectionsClear, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.modify(editor, (selection, i, builder) => {
    if (i === 0)
      builder.push(selection)
  })
})

registerCommand(Command.selectionsClearMain, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  if (editor.selections.length > 1) {
    selections.modify(editor, (selection, i, builder) => {
      if (i !== 0)
        builder.push(selection)
    })
  }
})

registerCommand(Command.selectionsKeepMatching, CommandFlags.ChangeSelections, InputKind.RegExp, '', (editor, { input: regex, selectionSet: selections }) => {
  selections.updateAll(editor, selections => {
    const newSelections = selections.filter(selection => regex.test(selection.getText()))

    if (newSelections.length === 0)
      selections.splice(1)
    else
      selections.splice(0, selections.length, ...newSelections)
  })
})

registerCommand(Command.selectionsClearMatching, CommandFlags.ChangeSelections, InputKind.RegExp, '', (editor, { input: regex, selectionSet: selections }) => {
  selections.updateAll(editor, selections => {
    const newSelections = selections.filter(selection => !regex.test(selection.getText()))

    if (newSelections.length === 0)
      selections.splice(1)
    else
      selections.splice(0, selections.length, ...newSelections)
  })
})

registerCommand(Command.select, CommandFlags.ChangeSelections, InputKind.RegExp, 'gm', (editor, { input: regex, selectionSet: selections }) => {
  selections.modify(editor, (selection, _, builder) => {
    const selectionText = selection.getText(),
          selectionStartOffset = selection.start.offset

    let match: RegExpExecArray | null

    while (match = regex.exec(selectionText)) {
      const anchor = Position.from(selection.set, selectionStartOffset + match.index)
      const active = Position.from(selection.set, selectionStartOffset + match.index + match[0].length)

      builder.push(Selection.fromFast(anchor, active))

      if (match[0].length === 0)
        regex.lastIndex++
    }
  })
})

registerCommand(Command.split, CommandFlags.ChangeSelections, InputKind.RegExp, 'gm', (editor, { input: regex, selectionSet: selections }) => {
  selections.modify(editor, (selection, _, builder) => {
    const selectionText = selection.getText(),
          selectionStartOffset = selection.start.offset

    let match: RegExpExecArray | null
    let index = 0

    while (match = regex.exec(selectionText)) {
      const anchor = Position.from(selection.set, selectionStartOffset + index)
      const active = Position.from(selection.set, selectionStartOffset + match.index)

      builder.push(Selection.fromFast(anchor, active))

      index = match.index + match[0].length

      if (match[0].length === 0)
        regex.lastIndex++
    }

    selection.active.inheritPosition(selection.end)
    selection.anchor.updateForNewPosition(selectionStartOffset + index)

    builder.push(selection)
  })
})

registerCommand(Command.splitLines, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.modify(editor, (selection, _, builder) => {
    if (selection.isSingleLine) {
      builder.unshift(selection)

      return
    }

    const document = editor.document,
          startLine = selection.start.line

    // Compute end line.
    const endAnchor = selection.end.copy(selection.set),
          endActive = selection.end.copy(selection.set)

    endAnchor.toLineStart()

    const endSelection = Selection.fromFast(endAnchor, endActive)

    // Add start line.
    selection.end.updateForNewPosition(document.lineAt(startLine).range.end)

    builder.push(selection)

    // Add intermediate lines.
    for (let i = selection.start.line + 1; i < selection.end.line; i++) {
      const selectionRange = editor.document.lineAt(i).range

      builder.unshift(Selection.from(selection.set, new vscode.Selection(selectionRange.start, selectionRange.end)))
    }

    // Add end line.
    builder.unshift(endSelection)
  })
})

registerCommand(Command.selectFirstLast, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.modify(editor, (selection, _, builder) => {
    if (selection.isEmptyOrSingleCharacter) {
      builder.push(selection)
    } else {
      const startSelection = selection,
            endSelection = selection.copy(selections)

      // Select start character.
      {
        const { start, end } = startSelection

        if (start.isLineEnd()) {
          end.inheritPosition(start)
        } else {
          end.updateForNewPositionFast(start.offset + 1, start.asPosition().translate(0, 1))
        }
      }

      // Select end character.
      {
        const { start, end } = endSelection

        if (end.isLineStart()) {
          start.inheritPosition(end)
        } else {
          start.updateForNewPositionFast(end.offset - 1, end.asPosition().translate(0, -1))
        }
      }

      builder.push(startSelection, endSelection)
    }
  })
})

function tryCopySelection(selection: Selection, newActiveLine: number) {
  const document = selection.document

  const active = selection.active.asPosition(),
        anchor = selection.anchor.asPosition()

  if (active.line === anchor.line) {
    const newLine = document.lineAt(newActiveLine)

    return newLine.range.end.character >= selection.end.character
      ? new vscode.Selection(anchor.with(newActiveLine), active.with(newActiveLine))
      : undefined
  }

  const newAnchorLine = newActiveLine + anchor.line - active.line

  if (newAnchorLine < 0 || newAnchorLine >= document.lineCount)
    return undefined

  const newAnchorLineInfo = document.lineAt(newAnchorLine)

  if (anchor.character > newAnchorLineInfo.range.end.character)
    return undefined

  const newActiveLineInfo = document.lineAt(newActiveLine)

  if (active.character > newActiveLineInfo.range.end.character)
    return undefined

  const newSelection = new vscode.Selection(anchor.with(newAnchorLine), active.with(newActiveLine))
  const hasOverlap =
       !(selection.start.line < newSelection.start.line || (selection.end.line === newSelection.start.line && selection.end.character < newSelection.start.character))
    && !(newSelection.start.line < selection.start.line || (newSelection.end.line === selection.start.line && newSelection.end.character < selection.start.character))

  if (hasOverlap)
    return undefined

  return newSelection
}

function copySelections(editor: vscode.TextEditor, { repetitions, selectionSet: selections }: CommandState, direction: Direction) {
  selections.modify(editor, (selection, _, builder) => {
    const lastLine = editor.document.lineCount

    for (let i = 0, currentLine = selection.active.line + direction; i < repetitions && currentLine >= 0 && currentLine < lastLine;) {
      const copiedSelection = tryCopySelection(selection, currentLine)

      if (copiedSelection !== undefined) {
        builder.push(Selection.from(selection.set, copiedSelection))
        i++
      }

      currentLine += direction
    }
  })
}

registerCommand(Command.selectCopy         , CommandFlags.ChangeSelections, (editor, state) => copySelections(editor, state, Forward))
registerCommand(Command.selectCopyBackwards, CommandFlags.ChangeSelections, (editor, state) => copySelections(editor, state, Backward))
