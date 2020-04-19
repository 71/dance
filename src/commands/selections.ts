// Manipulate existing selections.
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, InputKind, CommandState } from '.'
import { Selection, Position, Direction, Forward, Backward } from '../utils/selectionSet'


// Swap cursors (;, a-;, a-:)
// ===============================================================================================

registerCommand(Command.selectionsReduce, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  selectionSet.updateEach(selection => selection.anchor.inheritPosition(selection.active))
})

registerCommand(Command.selectionsFlip, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  selectionSet.updateEach(selection => selection.anchor.swap(selection.active))
})

registerCommand(Command.selectionsForward, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  selectionSet.updateEach(selection => selection.isReversed ? selection.anchor.swap(selection.active) : undefined)
})

registerCommand(Command.selectionsBackward, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  selectionSet.updateEach(selection => selection.isReversed ? undefined : selection.anchor.swap(selection.active))
})


// Align (&, a-&)
// ===============================================================================================

registerCommand(Command.selectionsAlign, CommandFlags.Edit, (editor, _, undoStops) => {
  const startChar = editor.selections.reduce((max, sel) => sel.start.character > max ? sel.start.character : max, 0)

  return editor.edit(builder => {
    for (const selection of editor.selections)
      builder.insert(selection.start, ' '.repeat(startChar - selection.start.character))
  }, undoStops).then(() => undefined)
})

registerCommand(Command.selectionsAlignCopy, CommandFlags.Edit, (editor, state, undoStops) => {
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
  }, undoStops).then(() => undefined)
})


// Clear, filter (spc, a-spc, a-k, a-K)
// ===============================================================================================

registerCommand(Command.selectionsClear, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  selectionSet.updateWithBuilder((builder, selection, i) => {
    if (i === 0)
      builder.push(selection)
  })
})

registerCommand(Command.selectionsClearMain, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  if (selectionSet.selections.length > 1) {
    selectionSet.updateWithBuilder((builder, selection, i) => {
      if (i !== 0)
        builder.push(selection)
    })
  }
})

registerCommand(Command.selectionsKeepMatching, CommandFlags.ChangeSelections, InputKind.RegExp, '', (_, { input: regex, selectionSet }) => {
  selectionSet.updateAll(selections => {
    const newSelections = selections.filter(selection => regex.test(selection.getText()))

    if (newSelections.length === 0)
      selections.splice(1)
    else
      selections.splice(0, selections.length, ...newSelections)
  })
})

registerCommand(Command.selectionsClearMatching, CommandFlags.ChangeSelections, InputKind.RegExp, '', (_, { input: regex, selectionSet }) => {
  selectionSet.updateAll(selections => {
    const newSelections = selections.filter(selection => !regex.test(selection.getText()))

    if (newSelections.length === 0)
      selections.splice(1)
    else
      selections.splice(0, selections.length, ...newSelections)
  })
})


// Select within, split (s, S)
// ===============================================================================================

registerCommand(Command.select, CommandFlags.ChangeSelections, InputKind.RegExp, 'gm', (_, { input: regex, selectionSet }) => {
  selectionSet.updateWithBuilder((builder, selection, _) => {
    const selectionText = selection.getText(),
          selectionStartOffset = selection.start.offset

    let match: RegExpExecArray | null

    while (match = regex.exec(selectionText)) {
      const anchor = Position.fromOffset(selection.set, selectionStartOffset + match.index)
      const active = Position.fromOffset(selection.set, selectionStartOffset + match.index + match[0].length)

      builder.push(Selection.fromFast(anchor, active))

      if (match[0].length === 0)
        regex.lastIndex++
    }
  })
})

registerCommand(Command.split, CommandFlags.ChangeSelections, InputKind.RegExp, 'gm', (editor, { input: regex, selectionSet }) => {
  selectionSet.updateWithBuilder((builder, selection, _) => {
    const selectionText = selection.getText(),
          selectionStartOffset = selection.start.offset

    let match: RegExpExecArray | null
    let index = 0

    while (match = regex.exec(selectionText)) {
      const anchor = Position.fromOffset(selection.set, selectionStartOffset + index)
      const active = Position.fromOffset(selection.set, selectionStartOffset + match.index)

      builder.push(Selection.fromFast(anchor, active))

      index = match.index + match[0].length

      if (match[0].length === 0)
        regex.lastIndex++
    }

    selection.active.inheritPosition(selection.end)
    selection.anchor.updateOffset(selectionStartOffset + index)

    builder.push(selection)
  })
})


// Split lines, select first & last, merge (a-s, a-S, a-_)
// ===============================================================================================

registerCommand(Command.splitLines, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  selectionSet.updateWithBuilder((builder, selection) => {
    if (selection.isSingleLine) {
      builder.unshift(selection)

      return
    }

    const startLine = selection.start.line,
          startIndex = builder.length,
          direction = selection.direction

    // Compute end line.
    const endAnchor = selection.end.copy(),
          endActive = selection.end.copy()

    endAnchor.toFirstCharacter()

    const endSelection = Selection.fromFast(endAnchor, endActive)

    // Add start line.
    selection.end.toLineBreak(startLine)

    builder.push(selection)

    // Add intermediate lines.
    for (let line = startLine + 1; line < selection.end.line; line++) {
      const anchor = selection.end.copy(),
            active = selection.end.copy()

      anchor.toFirstCharacter(line)
      active.toLineBreak(line)

      builder.unshift(Selection.fromFast(anchor, active))
    }

    // Add end line.
    builder.unshift(endSelection)

    // Restore direction of each line.
    for (let i = startIndex; i < builder.length; i++) {
      builder[i].direction = direction
    }
  })
})

registerCommand(Command.selectFirstLast, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  selectionSet.updateWithBuilder((builder, selection) => {
    if (selection.length < 2) {
      builder.push(selection)
    } else {
      const startSelection = selection,
            endSelection = selection.copy()

      // Select start character.
      {
        const { start, end } = startSelection

        if (start.isLastCharacter()) {
          end.inheritPosition(start)
        } else {
          end.updateOffset(start.offset + 1)
        }
      }

      // Select end character.
      {
        const { start, end } = endSelection

        if (end.isFirstCharacter()) {
          start.inheritPosition(end)
        } else {
          start.updateFast(end.offset - 1, end.line, end.column - 1)
        }
      }

      builder.push(startSelection, endSelection)
    }
  })
})

registerCommand(Command.selectionsMerge, CommandFlags.ChangeSelections, (_, { selectionSet: selections }) => {
  selections.updateAll(selections => {
    // VS Code automatically merges overlapping selections, so here
    // all we have to do is to merge non-overlapping contiguous selections
    for (let i = 0, len = selections.length; i < len; i++) {
      const refSel = selections[i]
      const refLine = refSel.start.textLine()

      if (refSel.end.column !== refLine.range.end.character)
        // Not at the end of the line? We don't care.
        continue

      for (let j = 0; j < len; j++) {
        if (i === j)
          continue

        const cmpSel = selections[j]

        if (cmpSel.start.column !== 0)
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


// Copy selections (C, a-C)
// ===============================================================================================

function tryCopySelection(selection: Selection, newActiveLine: number) {
  const document = selection.document

  const active = selection.active.beforePosition(),
        anchor = selection.anchor.beforePosition()

  if (active.line === anchor.line) {
    const newLine = document.lineAt(newActiveLine)

    return newLine.range.end.character >= selection.end.column
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
       !(selection.start.line < newSelection.start.line || (selection.end.line === newSelection.start.line && selection.end.column < newSelection.start.character))
    && !(newSelection.start.line < selection.start.line || (newSelection.end.line === selection.start.line && newSelection.end.character < selection.start.column))

  if (hasOverlap)
    return undefined

  return newSelection
}

function copySelections(editor: vscode.TextEditor, { repetitions, selectionSet: selections }: CommandState, direction: Direction) {
  selections.updateWithBuilder((builder, selection, _) => {
    const lastLine = editor.document.lineCount

    for (let i = 0, currentLine = selection.active.line + direction; i < repetitions && currentLine >= 0 && currentLine < lastLine;) {
      const copiedSelection = tryCopySelection(selection, currentLine)

      if (copiedSelection !== undefined) {
        builder.push(Selection.fromSelection(selection.set, copiedSelection))
        i++
      }

      currentLine += direction
    }
  })
}

registerCommand(Command.selectCopy         , CommandFlags.ChangeSelections, (editor, state) => copySelections(editor, state, Forward))
registerCommand(Command.selectCopyBackwards, CommandFlags.ChangeSelections, (editor, state) => copySelections(editor, state, Backward))
