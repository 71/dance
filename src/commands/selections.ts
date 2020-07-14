// Manipulate existing selections.
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, InputKind, CommandState } from '.'
import { Forward, Direction, Backward, SelectionHelper, DoNotExtend, SelectionMapper, jumpTo } from '../utils/selectionHelper'
import { EditorState } from '../state/editor'


// Swap cursors (;, a-;, a-:)
// ===============================================================================================

const reduceToActive: SelectionMapper = jumpTo(active => active, DoNotExtend)
registerCommand(Command.selectionsReduce, CommandFlags.ChangeSelections, (editorState, state) => {
  SelectionHelper.for(editorState, state).mapEach(reduceToActive)
})

registerCommand(Command.selectionsFlip, CommandFlags.ChangeSelections, ({ editor }) => {
  const selections = editor.selections,
        len = selections.length

  for (let i = 0; i < len; i++) {
    const selection = selections[i]

    selections[i] = new vscode.Selection(selection.active, selection.anchor)
  }

  editor.selections = selections
})

registerCommand(Command.selectionsForward, CommandFlags.ChangeSelections, ({ editor }) => {
  const selections = editor.selections,
        len = selections.length

  for (let i = 0; i < len; i++) {
    const selection = selections[i]

    if (selection.isReversed)
      selections[i] = new vscode.Selection(selection.active, selection.anchor)
  }

  editor.selections = selections
})

registerCommand(Command.selectionsBackward, CommandFlags.ChangeSelections, ({ editor }) => {
  const selections = editor.selections,
        len = selections.length

  for (let i = 0; i < len; i++) {
    const selection = selections[i]

    if (!selection.isReversed)
      selections[i] = new vscode.Selection(selection.active, selection.anchor)
  }

  editor.selections = selections
})


// Align (&, a-&)
// ===============================================================================================

registerCommand(Command.selectionsAlign, CommandFlags.Edit, ({ editor }, _, undoStops) => {
  const startChar = editor.selections.reduce((max, sel) => sel.start.character > max ? sel.start.character : max, 0)

  return editor.edit(builder => {
    const selections = editor.selections,
          len = selections.length

    for (let i = 0; i < len; i++) {
      const selection = selections[i]

      builder.insert(selection.start, ' '.repeat(startChar - selection.start.character))
    }
  }, undoStops).then(() => undefined)
})

registerCommand(Command.selectionsAlignCopy, CommandFlags.Edit, ({ editor }, state, undoStops) => {
  const sourceSelection = editor.selections[state.currentCount - 1] ?? editor.selection
  const sourceIndent = editor.document.lineAt(sourceSelection.start).firstNonWhitespaceCharacterIndex

  return editor.edit(builder => {
    const selections = editor.selections,
          len = selections.length

    for (let i = 0; i < len; i++) {
      if (i === sourceSelection.start.line)
        continue

      const line = editor.document.lineAt(selections[i].start)
      const indent = line.firstNonWhitespaceCharacterIndex

      if (indent > sourceIndent)
        builder.delete(line.range.with(undefined, line.range.start.translate(undefined, indent - sourceIndent)))
      else if (indent < sourceIndent)
        builder.insert(line.range.start, ' '.repeat(indent - sourceIndent))
    }
  }, undoStops).then(() => void 0)
})


// Clear, filter (spc, a-spc, a-k, a-K)
// ===============================================================================================

registerCommand(Command.selectionsClear, CommandFlags.ChangeSelections, ({ editor }) => {
  editor.selections = [editor.selection]
})

registerCommand(Command.selectionsClearMain, CommandFlags.ChangeSelections, ({ editor }) => {
  const selections = editor.selections

  if (selections.length > 1) {
    selections.shift()
    editor.selections = selections
  }
})

registerCommand(Command.selectionsKeepMatching, CommandFlags.ChangeSelections, InputKind.RegExp, () => '', ({ editor }, { input: regex }) => {
  const document = editor.document,
        newSelections = editor.selections.filter(selection => regex.test(document.getText(selection)))

  if (newSelections.length > 0)
    editor.selections = newSelections
})

registerCommand(Command.selectionsClearMatching, CommandFlags.ChangeSelections, InputKind.RegExp, () => '', ({ editor }, { input: regex }) => {
  const document = editor.document,
        newSelections = editor.selections.filter(selection => !regex.test(document.getText(selection)))

  if (newSelections.length > 0)
    editor.selections = newSelections
})


// Select within, split (s, S)
// ===============================================================================================

registerCommand(Command.select, CommandFlags.ChangeSelections, InputKind.RegExp, () => 'gm', ({ editor }, { input: regex }) => {
  const { document, selections } = editor,
        len = selections.length,
        newSelections = [] as vscode.Selection[]

  for (let i = 0; i < len; i++) {
    const selection = selections[i],
          selectionText = document.getText(selection),
          selectionStartOffset = document.offsetAt(selection.start)

    let match: RegExpExecArray | null

    while (match = regex.exec(selectionText)) {
      const anchor = document.positionAt(selectionStartOffset + match.index)
      const active = document.positionAt(selectionStartOffset + match.index + match[0].length)

      newSelections.unshift(new vscode.Selection(anchor, active))

      if (match[0].length === 0)
        regex.lastIndex++
    }
  }

  if (newSelections.length > 0)
    editor.selections = newSelections
})

registerCommand(Command.split, CommandFlags.ChangeSelections, InputKind.RegExp, () => 'gm', ({ editor }, { input: regex }) => {
  const { document, selections } = editor,
        len = selections.length,
        newSelections = [] as vscode.Selection[]

  for (let i = 0; i < len; i++) {
    const selection = selections[i],
          selectionText = document.getText(selection),
          selectionStartOffset = document.offsetAt(selection.start)

    let match: RegExpExecArray | null
    let index = 0

    while (match = regex.exec(selectionText)) {
      const anchor = document.positionAt(selectionStartOffset + index)
      const active = document.positionAt(selectionStartOffset + match.index)

      newSelections.push(new vscode.Selection(anchor, active))

      index = match.index + match[0].length

      if (match[0].length === 0)
        regex.lastIndex++
    }

    newSelections.push(new vscode.Selection(document.positionAt(selectionStartOffset + index), selection.end))
  }

  editor.selections = newSelections
})


// Split lines, select first & last, merge (a-s, a-S, a-_)
// ===============================================================================================

registerCommand(Command.splitLines, CommandFlags.ChangeSelections, ({ editor }) => {
  const selections = editor.selections,
        len = selections.length,
        newSelections = [] as vscode.Selection[]

  for (let i = 0; i < len; i++) {
    const selection = selections[i]

    if (selection.isSingleLine) {
      newSelections.unshift(selection)

      return
    }

    const startLine = selection.start.line,
          startIndex = newSelections.length,
          isReversed = selection.isReversed

    // Compute end line.
    const endAnchor = selection.end.with(undefined, 0),
          endActive = selection.end

    const endSelection = new vscode.Selection(endAnchor, endActive)

    // Add start line.
    newSelections.push(new vscode.Selection(selection.start, selection.start.with(undefined, Number.MAX_SAFE_INTEGER)))

    // Add intermediate lines.
    for (let line = startLine + 1; line < selection.end.line; line++) {
      const anchor = new vscode.Position(line, 0),
            active = new vscode.Position(line, Number.MAX_SAFE_INTEGER)

      newSelections.unshift(new vscode.Selection(anchor, active))
    }

    // Add end line.
    newSelections.unshift(endSelection)

    // Restore direction of each line.
    if (isReversed) {
      for (let i = startIndex; i < newSelections.length; i++) {
        newSelections[i] = new vscode.Selection(newSelections[i].active, newSelections[i].anchor)
      }
    }
  }

  editor.selections = newSelections
})

registerCommand(Command.selectFirstLast, CommandFlags.ChangeSelections, ({ editor }) => {
  const { document, selections } = editor,
        len = selections.length,
        newSelections = [] as vscode.Selection[]

  for (let i = 0; i < len; i++) {
    const selection = selections[i],
          selectionStartOffset = document.offsetAt(selection.start),
          selectionEndOffset = document.offsetAt(selection.end)

    if (selectionEndOffset - selectionStartOffset < 2) {
      newSelections.push(selection)
    } else {
      // Select start character.
      {
        const start = selection.start,
              end = document.positionAt(document.offsetAt(start) + 1)

        newSelections.push(new vscode.Selection(start, end))
      }

      // Select end character.
      {
        const end = selection.end,
              start = document.positionAt(document.offsetAt(end) - 1)

        newSelections.push(new vscode.Selection(start, end))
      }
    }
  }

  editor.selections = newSelections
})


// Copy selections (C, a-C)
// ===============================================================================================

function tryCopySelection(selectionHelper: SelectionHelper<EditorState>, document: vscode.TextDocument, selection: vscode.Selection, newActiveLine: number) {
  const active = selection.active,
        anchor = selection.anchor,
        activeLine = selectionHelper.activeLine(selection)

  if (activeLine === anchor.line) {
    const newLine = document.lineAt(newActiveLine)

    // TODO: Generalize below for all cases
    return newLine.text.length >= selection.end.character
      ? new vscode.Selection(anchor.with(newActiveLine), active.with(newActiveLine, selectionHelper.activeCharacter(selection)))
      : undefined
  }

  const newAnchorLine = newActiveLine + anchor.line - activeLine

  if (newAnchorLine < 0 || newAnchorLine >= document.lineCount)
    return undefined

  const newAnchorTextLine = document.lineAt(newAnchorLine)

  if (anchor.character > newAnchorTextLine.text.length)
    return undefined

  const newActiveTextLine = document.lineAt(newActiveLine)

  if (active.character > newActiveTextLine.text.length)
    return undefined

  const newSelection = new vscode.Selection(anchor.with(newAnchorLine), active.with(newActiveLine))
  const hasOverlap =
       !(selection.start.line < newSelection.start.line || (selection.end.line === newSelection.start.line && selection.end.character < newSelection.start.character))
    && !(newSelection.start.line < selection.start.line || (newSelection.end.line === selection.start.line && newSelection.end.character < selection.start.character))

  if (hasOverlap)
    return undefined

  return newSelection
}

function copySelections(editorState: EditorState, { repetitions }: CommandState, direction: Direction) {
  const editor = editorState.editor,
        selections = editor.selections,
        len = selections.length,
        document = editor.document,
        lineCount = document.lineCount,
        selectionHelper = SelectionHelper.for(editorState)

  for (let i = 0; i < len; i++) {
    const selection = selections[i],
          selectionActiveLine = selectionHelper.activeLine(selection)

    for (let i = 0, currentLine = selectionActiveLine + direction; i < repetitions && currentLine >= 0 && currentLine < lineCount;) {
      const copiedSelection = tryCopySelection(selectionHelper, document, selection, currentLine)

      if (copiedSelection !== undefined) {
        if (!selections.some(s => s.contains(copiedSelection)))
          selections.push(copiedSelection)

        i++

        if (direction === Backward)
          currentLine = copiedSelection.end.line - 1
        else
          currentLine = copiedSelection.start.line + 1
      } else {
        currentLine += direction
      }
    }
  }

  editor.selections = selections
}

registerCommand(Command.selectCopy         , CommandFlags.ChangeSelections, (editorState, state) => copySelections(editorState, state, Forward))
registerCommand(Command.selectCopyBackwards, CommandFlags.ChangeSelections, (editorState, state) => copySelections(editorState, state, Backward))
