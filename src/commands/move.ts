// Movement: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, InputKind, CommandState } from '.'

import { CharSet } from '../extension'
import { Selection, Position, LimitToCurrentLine, ExtendBehavior, Backward, Forward, DoNotExtend, Extend, Direction, CollapseFlags } from '../utils/selections'


// Move around (h, j, k, l, H, J, K, L, arrows, shift+arrows)
// ===============================================================================================

const preferredColumnsPerEditor = new WeakMap<vscode.TextEditor, number[]>()

function moveLeft(state: CommandState, editor: vscode.TextEditor, extend: ExtendBehavior) {
  const selections = state.selectionSet.selections
  const offset = state.repetitions

  preferredColumnsPerEditor.delete(editor)

  let firstActive = undefined as vscode.Position | undefined

  for (let i = 0; i < selections.length; i++) {
    const selection = selections[i]

    selection.active.moveLeftOrGoUp(offset)

    if (selection.active.offset === selection.anchor.offset) {
      selection.active.moveLeftOrGoUp()

      if (extend)
        selection.anchor.moveRightOrGoDown()
    } else if (!extend) {
      selection.collapseToActive(CollapseFlags.DoNotMoveActive)
    }

    const activePosition = selections[i].active.asPosition()

    if (firstActive === undefined || firstActive.isAfter(activePosition))
      firstActive = activePosition
  }

  state.selectionSet.commit(editor)
  editor.revealRange(new vscode.Range(firstActive!, firstActive!))
}

function moveRight(state: CommandState, editor: vscode.TextEditor, extend: ExtendBehavior) {
  const selections = state.selectionSet.selections
  const offset = state.repetitions

  preferredColumnsPerEditor.delete(editor)

  let lastActive = undefined as vscode.Position | undefined

  for (let i = 0; i < selections.length; i++) {
    const selection = selections[i]

    selection.active.moveRightOrGoDown(offset)

    if (selection.active.offset === selection.anchor.offset) {
      selection.active.moveRightOrGoDown()

      if (extend)
        selection.anchor.moveLeftOrGoUp()
    } else if (!extend) {
      selection.collapseToActive(CollapseFlags.DoNotMoveActive)
    }

    const activePosition = selections[i].active.asPosition()

    if (lastActive === undefined || lastActive.isBefore(activePosition))
      lastActive = activePosition
  }

  state.selectionSet.commit(editor)
  editor.revealRange(new vscode.Range(lastActive!, lastActive!))
}

function moveVertical(state: CommandState, editor: vscode.TextEditor, direction: Direction, extend: ExtendBehavior) {
  const selections = state.selectionSet.selections
  const diff = state.repetitions * direction
  const lastLine = editor.document.lineCount - 1

  let preferredColumns = preferredColumnsPerEditor.get(editor)

  if (preferredColumns === undefined)
    preferredColumnsPerEditor.set(editor, preferredColumns = [])

  let revealPosition = undefined as vscode.Position | undefined
  let revealPositionOffset = 0

  if (preferredColumns.length !== selections.length) {
    preferredColumns.length = 0

    for (let i = 0; i < selections.length; i++)
      preferredColumns.push(selections[i].active.character)
  }

  for (let i = 0; i < selections.length; i++) {
    const selection = selections[i]
    const { active } = selection
    const targetLine = selection.activeLine + diff

    if (targetLine < 0) {
      active.toDocumentStart()
    } else if (targetLine > lastLine) {
      active.toDocumentEnd()
    } else {
      active.updateForNewPosition(new vscode.Position(targetLine, preferredColumns[i]))
    }

    if (!extend)
      selection.collapseToActive(CollapseFlags.DoNotMoveActive)

    // Forward (going down): equivalent to active.isBefore(revealPosition)
    // Backward (going up) : equivalent to active.isAfter(revealPosition)
    if (revealPosition === undefined || active.offset * direction < revealPositionOffset * direction) {
      revealPosition = active.asPosition()
      revealPositionOffset = active.offset
    }
  }

  state.selectionSet.commit(editor)
  editor.revealRange(new vscode.Range(revealPosition!, revealPosition!))
}

// Move/extend left/down/up/right
registerCommand(Command.left       , CommandFlags.ChangeSelections, (editor, state) =>     moveLeft(state, editor,           DoNotExtend))
registerCommand(Command.leftExtend , CommandFlags.ChangeSelections, (editor, state) =>     moveLeft(state, editor,                Extend))
registerCommand(Command.right      , CommandFlags.ChangeSelections, (editor, state) =>    moveRight(state, editor,           DoNotExtend))
registerCommand(Command.rightExtend, CommandFlags.ChangeSelections, (editor, state) =>    moveRight(state, editor,                Extend))
registerCommand(Command.up         , CommandFlags.ChangeSelections, (editor, state) => moveVertical(state, editor, Backward, DoNotExtend))
registerCommand(Command.upExtend   , CommandFlags.ChangeSelections, (editor, state) => moveVertical(state, editor, Backward,      Extend))
registerCommand(Command.down       , CommandFlags.ChangeSelections, (editor, state) => moveVertical(state, editor,  Forward, DoNotExtend))
registerCommand(Command.downExtend , CommandFlags.ChangeSelections, (editor, state) => moveVertical(state, editor,  Forward,      Extend))


// Move / extend to character (f, t, F, T, Alt+[ft], Alt+[FT])
// ===============================================================================================

function registerSelectTo(commandName: Command, diff: number, extend: ExtendBehavior, direction: Direction) {
  registerCommand(commandName, CommandFlags.ChangeSelections, InputKind.Key, undefined, (editor, { selectionSet: selections, repetitions, input: key }) => {
    selections.updateEach(editor, selection => {
      const active = selection.active
      const searchOffset = direction === Backward ? -2 : 1

      let line = active.line
      let character = active.character + searchOffset as number | undefined

      if (selection.isNonDirectional && !selection.isReversed)
        character!--

      for (let i = repetitions; i > 0; i--) {
        for (;;) {
          const text = editor.document.lineAt(line).text
          const idx = direction === Backward ? text.lastIndexOf(key, character) : text.indexOf(key, character)

          if (idx !== -1) {
            character = idx + searchOffset

            break
          }

          // No match on this line, let's keep going.
          const isDocumentEdge = direction === Backward
            ? line-- === 0
            : ++line === editor.document.lineCount

          if (isDocumentEdge)
            // ... except if we've reached the start or end of the document.
            return

          character = direction === Backward ? undefined : 0
        }
      }

      if (!extend) {
        selection.collapseToActive(CollapseFlags.DoNotMoveActive)

        if (direction === Backward && diff === 1)
          selection.anchor.moveRightOrGoDown(1)
      }

      active.updateForNewPosition(new vscode.Position(line, character! - searchOffset + diff))
    })
  })
}

registerSelectTo(Command.selectToIncluded      , 1, DoNotExtend, Forward)
registerSelectTo(Command.selectToIncludedExtend, 1, Extend     , Forward)
registerSelectTo(Command.selectToExcluded      , 0, DoNotExtend, Forward)
registerSelectTo(Command.selectToExcludedExtend, 0, Extend     , Forward)

registerSelectTo(Command.selectToIncludedBackwards      , 0, DoNotExtend, Backward)
registerSelectTo(Command.selectToIncludedExtendBackwards, 0, Extend     , Backward)
registerSelectTo(Command.selectToExcludedBackwards      , 1, DoNotExtend, Backward)
registerSelectTo(Command.selectToExcludedExtendBackwards, 1, Extend     , Backward)


// Move / extend to word begin / end (w, b, e, W, B, E, alt+[wbe], alt+[WBE])
// ===============================================================================================

function skipEmptyLines(pos: Position, document: vscode.TextDocument, direction: Direction) {
  let { line } = pos

  if (!document.lineAt(line).isEmptyOrWhitespace)
    return true

  let textLine: vscode.TextLine

  if (direction === Backward) {
    while ((textLine = document.lineAt(line)).isEmptyOrWhitespace) {
      if (line-- === 0)
        return false
    }

    pos.updateForNewPosition(textLine.range.end)
  } else {
    while ((textLine = document.lineAt(line)).isEmptyOrWhitespace) {
      if (++line === document.lineCount)
        return false
    }

    pos.updateForNewPosition(textLine.range.start)
  }

  return true
}

/**
 * Returns the position that should be used to start searching for a pattern
 * starting at the given position in the given direction.
 *
 * For single-character selections, this will return `selection.end` for `Forward`
 * and `selection.start` for `Backward`.
 * For other selections, this will return `selection.active`.
 */
function toSearchStart(position: Position, selection: Selection, direction: Direction) {
  if (direction === Forward) {
    if (selection.isNonDirectional)
      position.inheritPosition(selection.end)
    else
      position.inheritPosition(selection.active)
  } else {
    position.moveLeftOrStop()
  }
}

function categorize(charCode: number, isBlank: (charCode: number) => boolean, isWord: (charCode: number) => boolean) {
  return isWord(charCode) ? 'word' : charCode === 0 || isBlank(charCode) ? 'blank' : 'punct'
}

function toInclusiveSelectionStart(cursor: Position.Cursor, selection: Selection, direction: Direction) {
  if (selection.isNonDirectional) {
    if (direction === Forward)
      cursor.position.inheritPosition(selection.start)
    else
      cursor.position.inheritPosition(selection.end)
  } else {
    if (direction === Forward)
      selection.active.moveLeftOrStop()
    else
      selection.active.moveRightOrStop()
  }

  cursor.notifyPositionUpdated()

  return cursor
}

function skipFirstCharacter(cursor: Position.Cursor, direction: Direction, isBlank: (charCode: number) => boolean, isWord: (charCode: number) => boolean) {
  const character = cursor.position.character,
        text = cursor.textLine.text

  const shouldSkip = direction === Forward
    ? character + 1 < text.length && categorize(text.charCodeAt(character), isBlank, isWord) !== categorize(text.charCodeAt(character + 1), isBlank, isWord)
    : character > 0 && categorize(text.charCodeAt(character), isBlank, isWord) !== categorize(text.charCodeAt(character - 1), isBlank, isWord)

  if (shouldSkip)
    cursor.skip(direction)
}

function registerToNextWord(commandName: Command, extend: ExtendBehavior, end: boolean, wordCharset: CharSet) {
  registerCommand(commandName, CommandFlags.ChangeSelections, (editor, state, _, ctx) => {
    const { document } = editor
    const isWord        = ctx.getCharSetFunction(wordCharset, document),
          isBlank       = ctx.getCharSetFunction(CharSet.Blank, document),
          isPunctuation = ctx.getCharSetFunction(CharSet.Punctuation, document)

    state.selectionSet.updateEach(editor, selection => {
      if (extend)
        selection.prepareExtensionTowards(Forward)
      else
        selection.prepareSelectionTowards(Forward)

      const { anchor, active } = selection
      const defaultSelection = {
              active: { offset: state.selectionSet.endOffset, position: state.selectionSet.end },
              anchor: anchor.save(),
            }

      for (let i = state.currentCount || 1; i > 0; i--) {
        toSearchStart(active, selection, Forward)

        const startOffset = active.offset

        if (!skipEmptyLines(active, document, Forward))
          return selection.restore(defaultSelection)

        const cursor = active.cursor()
        const firstCharacterCursor = extend ? anchor.cursor() : active.offset === startOffset ? toInclusiveSelectionStart(cursor, selection, Forward) : cursor

        if (!extend) {
          skipFirstCharacter(firstCharacterCursor, Forward, isBlank, isWord)

          anchor.inheritPosition(active)
        }

        if (end) {
          if (!cursor.skipWhile(Forward, isBlank))
            return selection.restore(defaultSelection)
        }

        const moved = isWord(cursor.character)
          ? cursor.skipWhile(Forward, isWord, true)
          : cursor.skipWhile(Forward, isPunctuation, true)

        if (!moved)
          return selection.restore(defaultSelection)

        if (!end) {
          if (!cursor.skipWhile(Forward, isBlank))
            return selection.restore(defaultSelection)
        }
      }
    })
  })
}

function registerToPreviousWord(commandName: Command, extend: ExtendBehavior, wordCharset: CharSet) {
  registerCommand(commandName, CommandFlags.ChangeSelections, (editor, state, _, ctx) => {
    const { document } = editor
    const isWord        = ctx.getCharSetFunction(wordCharset, document),
          isBlank       = ctx.getCharSetFunction(CharSet.Blank, document),
          isPunctuation = ctx.getCharSetFunction(CharSet.Punctuation, document)

    state.selectionSet.updateEach(editor, selection => {
      if (extend)
        selection.prepareExtensionTowards(Backward)
      else
        selection.prepareSelectionTowards(Backward)

      const { anchor, active } = selection
      const defaultSelection = {
              active: { offset: 0, position: new vscode.Position(0, 0) },
              anchor: anchor.save(),
            }

      for (let i = state.currentCount || 1; i > 0; i--) {
        toSearchStart(active, selection, Backward)

        const startOffset = active.offset

        if (!skipEmptyLines(active, document, Backward))
          return selection.restore(defaultSelection)

        const cursor = active.cursor()
        const firstCharacterCursor = extend ? anchor.cursor() : active.offset === startOffset ? toInclusiveSelectionStart(cursor, selection, Backward) : cursor

        if (!extend) {
          skipFirstCharacter(firstCharacterCursor, Backward, isBlank, isWord)

          anchor.inheritPosition(active)
        }

        if (!cursor.skipWhile(Backward, isBlank, true))
          return selection.restore(defaultSelection)

        const moved = isWord(cursor.character)
          ? cursor.skipWhile(Backward, isWord, true, LimitToCurrentLine.Accept)
          : cursor.skipWhile(Backward, isPunctuation, true, LimitToCurrentLine.Accept)

        if (!moved)
          return selection.restore(defaultSelection)

        if (!extend)
          anchor.moveRightOrStop()

        if (active.character > 0)
          active.moveRightOrStop()
      }
    })
  })
}

registerToNextWord(Command.selectWord         , DoNotExtend, false, CharSet.Word)
registerToNextWord(Command.selectWordExtend   ,      Extend, false, CharSet.Word)
registerToNextWord(Command.selectWordAlt      , DoNotExtend, false, CharSet.NonBlank)
registerToNextWord(Command.selectWordAltExtend,      Extend, false, CharSet.NonBlank)

registerToNextWord(Command.selectWordEnd         , DoNotExtend, true, CharSet.Word)
registerToNextWord(Command.selectWordEndExtend   ,      Extend, true, CharSet.Word)
registerToNextWord(Command.selectWordAltEnd      , DoNotExtend, true, CharSet.NonBlank)
registerToNextWord(Command.selectWordAltEndExtend,      Extend, true, CharSet.NonBlank)

registerToPreviousWord(Command.selectWordPrevious         , DoNotExtend, CharSet.Word)
registerToPreviousWord(Command.selectWordPreviousExtend   ,      Extend, CharSet.Word)
registerToPreviousWord(Command.selectWordAltPrevious      , DoNotExtend, CharSet.NonBlank)
registerToPreviousWord(Command.selectWordAltPreviousExtend,      Extend, CharSet.NonBlank)


// Line selecting key bindings (x, X, alt+[xX], home, end)
// ===============================================================================================

registerCommand(Command.selectLine, CommandFlags.ChangeSelections, (editor, { selectionSet: selections, currentCount }) => {
  if (currentCount === 0 || currentCount === 1) {
    selections.updateEach(editor, selection => {
      const newAnchor = new vscode.Position(selection.activeLine, 0),
            moveAnchor = !newAnchor.isEqual(selection.anchor.asPosition())

      if (moveAnchor)
        selection.anchor.updateForNewPosition(newAnchor)

      if (!selection.active.isLineBreak(selection.anchor)) {
        selection.active.toLineEndIncludingLineBreak()
      } else if (!moveAnchor) {
        selection.anchor.toNextLineStart()
        selection.active.toNextLineStart()
      }
    })
  } else {
    selections.updateEach(editor, selection => {
      const lineRange = editor.document.lineAt(Math.min(selection.activeLine + currentCount - 1, editor.document.lineCount - 1)).rangeIncludingLineBreak

      selection.anchor.updateForNewPositionFast(selection.anchor.lineOffset, lineRange.start)
      selection.active.updateForNewPosition(lineRange.end)
    })
  }
})

registerCommand(Command.selectLineExtend, CommandFlags.ChangeSelections, (editor, { selectionSet: selections, currentCount }) => {
  if (currentCount === 0 || currentCount === 1) {
    selections.updateEach(editor, selection => {
      if (selection.isSingleLine)
        selection.anchor.toLineStart()

      selection.active.toLineEndIncludingLineBreak()
    })
  } else {
    selections.updateEach(editor, selection => {
      const lineRange = editor.document.lineAt(Math.min(selection.active.line + currentCount - 1, editor.document.lineCount - 1)).rangeIncludingLineBreak

      if (selection.isSingleLine)
        selection.anchor.toLineStart()

      selection.active.updateForNewPosition(lineRange.end)
    })
  }
})

registerCommand(Command.selectToLineBegin, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.updateEach(editor, selection => {
    selection.prepareSelectionTowards(Backward)
    selection.active.toLineStart()
  })
})

registerCommand(Command.selectToLineBeginExtend, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.updateEach(editor, selection => {
    selection.prepareExtensionTowards(Backward)
    selection.active.toLineStart()
  })
})

registerCommand(Command.selectToLineEnd, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.updateEach(editor, selection => {
    selection.prepareSelectionTowards(Forward)
    selection.active.toLineEnd()
  })
})

registerCommand(Command.selectToLineEndExtend, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.updateEach(editor, selection => {
    selection.prepareExtensionTowards(Forward)
    selection.active.toLineEnd()
  })
})

registerCommand(Command.expandLines, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.updateEach(editor, selection => {
    selection.start.toLineStart()

    if (!selection.end.isLineBreak(selection.start))
      selection.end.toLineEnd()
  })
})

registerCommand(Command.trimLines, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }) => {
  selections.modify(editor, (selection, _, builder) => {
    const { start, end, isReversed } = selection

    if (!start.isLineStart()) {
      if (start.isLastLine())
        return

      start.updateForNewPosition(new vscode.Position(start.line + 1, 0))
    }

    if (!end.isLineEnd()) {
      if (end.isFirstLine())
        return

      end.updateForNewPosition(start.lineOffset - 1)
    }

    if (start.offset <= end.offset) {
      if (isReversed)
        selection.reverse()

      builder.push(selection)
    }
  })
})

registerCommand(Command.trimSelections, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }, _, ctx) => {
  selections.modify(editor, (selection, _, builder) => {
    const isBlank = ctx.getCharSetFunction(CharSet.Blank, editor.document)

    const startOffset = selection.start.offset + (ctx.allowEmptySelections ? 1 : 0),
          endOffset = selection.end.offset - (ctx.allowEmptySelections ? 1 : 0)

    selection.start.cursor().skipWhile(Forward, (ch, offset) => isBlank(ch) && offset < endOffset)
    selection.end.cursor().skipWhile(Backward, (ch, offset) => isBlank(ch) && offset > startOffset)

    if (selection.start.offset < selection.end.offset) {
      builder.push(selection)
    }
  })
})


// Select enclosing (m, M, alt+[mM])
// ===============================================================================================

const enclosingChars = new Uint8Array(Array.from('(){}[]', ch => ch.charCodeAt(0)))

function registerToEnclosing(command: Command, extend: ExtendBehavior, direction: Direction) {
  registerCommand(command, CommandFlags.ChangeSelections, (editor, state) => {
    state.selectionSet.updateEach(editor, selection => {
      const activeCursor = selection.active.cursor()

      if (!activeCursor.skipUntil(direction, ch => enclosingChars.indexOf(ch) !== -1)) {
        return
      }

      const enclosingChar = activeCursor.textLine.text.charCodeAt(activeCursor.position.character),
            idxOfEnclosingChar = enclosingChars.indexOf(enclosingChar)

      const anchor = selection.anchor,
            prevAnchorOffset = selection.anchor.offset,
            prevAnchorPosition = selection.anchor.asPosition()

      selection.anchor.inheritPosition(selection.active)

      const anchorCursor = anchor.cursor()

      let balance = 0

      if (idxOfEnclosingChar & 1) {
        // Odd enclosingChar index <=> enclosingChar is closing character
        //                         <=> we go backward looking for the opening character
        const openingChar = enclosingChars[idxOfEnclosingChar - 1]

        anchorCursor.skipWhile(Backward, charCode => {
          if (charCode === openingChar && balance-- === 0) {
            return false
          } else if (charCode === enclosingChar) {
            balance++
          }

          return true
        }, false)

        // Also include the closing character.
        selection.active.moveRightOrStop()
      } else {
        // Even enclosingChar index <=> enclosingChar is opening character
        //                          <=> we go forward looking for the closing character
        const closingChar = enclosingChars[idxOfEnclosingChar + 1]

        anchorCursor.skip(Forward)
        const found = anchorCursor.skipWhile(Forward, charCode => {
          if (charCode === closingChar && balance-- === 0) {
            return false
          } else if (charCode === enclosingChar) {
            balance++
          }

          return true
        })

        if (found) {
          anchorCursor.skip(Forward)
        }
      }

      if (extend) {
        anchor.updateForNewPositionFast(prevAnchorOffset, prevAnchorPosition)
      }

      selection.direction = direction
    })
  })
}

registerToEnclosing(Command.selectEnclosing               , DoNotExtend, Forward)
registerToEnclosing(Command.selectEnclosingExtend         ,      Extend, Forward)
registerToEnclosing(Command.selectEnclosingBackwards      , DoNotExtend, Backward)
registerToEnclosing(Command.selectEnclosingExtendBackwards,      Extend, Backward)


// Move up/down (ctrl-[bfud])
// ===============================================================================================

function registerMoveLines(command: Command, direction: 'up' | 'down', extend: ExtendBehavior, computeTranslation: (editor: vscode.TextEditor) => number) {
  registerCommand(command, CommandFlags.ChangeSelections, (editor, { currentCount }) => {
    const translation = computeTranslation(editor)

    return vscode.commands.executeCommand('editorScroll', {
      to: direction,
      by: 'line',
      value: (currentCount || 1) * translation,
      revealCursor: true,
      select: extend,
    })
  })
}

function getHeight(editor: vscode.TextEditor) {
  const visibleRange = editor.visibleRanges[0]

  return visibleRange.end.line - visibleRange.start.line
}

registerMoveLines(Command.upPage          , 'up', DoNotExtend, editor => getHeight(editor))
registerMoveLines(Command.upPageExtend    , 'up',      Extend, editor => getHeight(editor))
registerMoveLines(Command.upHalfPage      , 'up', DoNotExtend, editor => getHeight(editor) / 2 | 0)
registerMoveLines(Command.upHalfPageExtend, 'up',      Extend, editor => getHeight(editor) / 2 | 0)

registerMoveLines(Command.downPage          , 'down', DoNotExtend, editor => getHeight(editor))
registerMoveLines(Command.downPageExtend    , 'down',      Extend, editor => getHeight(editor))
registerMoveLines(Command.downHalfPage      , 'down', DoNotExtend, editor => getHeight(editor) / 2 | 0)
registerMoveLines(Command.downHalfPageExtend, 'down',      Extend, editor => getHeight(editor) / 2 | 0)


// Other bindings (%)
// ===============================================================================================

registerCommand(Command.selectBuffer, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  const selection = selectionSet.selections[0]

  selection.anchor.toDocumentStart()
  selection.active.toDocumentEnd()
})
