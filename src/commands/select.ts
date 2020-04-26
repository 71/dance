// Select / extend: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode from 'vscode'

import { CommandState, registerCommand, Command, CommandFlags, InputKind } from '.'
import { CharSet } from '../extension'
import { Direction, Anchor, Backward, Forward, ExtendBehavior, LimitToCurrentLine, DoNotExtend, Extend, Position, Cursor } from '../utils/selectionSet'
import { MoveMode, SkipFunc, SelectFunc, SelectionHelper, Coord } from '../utils/selectionHelper'

// Move / extend to character (f, t, F, T, Alt+[ft], Alt+[FT])
// ===============================================================================================
const noSkip: SkipFunc = from => from

const selectToNextCharacter: (direction: Direction) => SelectFunc = (direction) => (from, helper) => {
  const key = helper.state.input as string
  const active = from
  const searchOffset = direction === Backward ? -2 : 1

  let line = active.line
  let character = active.character + searchOffset as number | undefined

  for (let i = helper.state.repetitions; i > 0; i--) {
    for (;;) {
      const text = helper.editor.document.lineAt(line).text
      const idx = direction === Backward ? text.lastIndexOf(key, character) : text.indexOf(key, character)

      if (idx !== -1) {
        character = idx + searchOffset

        break
      }

      // No match on this line, let's keep going.
      const isDocumentEdge = direction === Backward
        ? line-- === 0
        : ++line === helper.editor.document.lineCount

      if (isDocumentEdge)
        // ... except if we've reached the start or end of the document.
        return from

      character = direction === Backward ? undefined : 0
    }
  }
  return new Coord(line, character! - searchOffset)
}

function registerSelectTo(commandName: Command, moveMode: MoveMode, extend: ExtendBehavior, direction: Direction) {
  const selectFunc = selectToNextCharacter(direction)
  registerCommand(commandName, CommandFlags.ChangeSelections, InputKind.Key, undefined, (editor, state) => {
    SelectionHelper.for(editor, state).moveEach(moveMode, noSkip, selectFunc, extend)
  })
}

registerSelectTo(Command.selectToIncluded      ,  MoveMode.ToCoverChar, DoNotExtend, Forward)
registerSelectTo(Command.selectToIncludedExtend,  MoveMode.ToCoverChar, Extend     , Forward)
registerSelectTo(Command.selectToExcluded      ,  MoveMode.  UntilChar, DoNotExtend, Forward)
registerSelectTo(Command.selectToExcludedExtend,  MoveMode.  UntilChar, Extend     , Forward)

registerSelectTo(Command.selectToIncludedBackwards      ,  MoveMode.ToCoverChar, DoNotExtend, Backward)
registerSelectTo(Command.selectToIncludedExtendBackwards,  MoveMode.ToCoverChar, Extend     , Backward)
registerSelectTo(Command.selectToExcludedBackwards      ,  MoveMode.  UntilChar, DoNotExtend, Backward)
registerSelectTo(Command.selectToExcludedExtendBackwards,  MoveMode.  UntilChar, Extend     , Backward)


// Move / extend to word begin / end (w, b, e, W, B, E, alt+[wbe], alt+[WBE])
// ===============================================================================================

function skipEmptyLines(pos: Position, document: vscode.TextDocument, direction: Direction) {
  let { line } = pos
  let textLine: vscode.TextLine

  if (direction === Backward) {
    if (pos.isFirstCharacter() && line > 0)
      pos.toEndCharacter(--line)

    while ((textLine = document.lineAt(line)).isEmptyOrWhitespace) {
      if (line-- === 0)
        return false
    }

    if (line !== pos.line)
      pos.update(line, textLine.text.length)
  } else {
    if (pos.isLineBreak() && line + 1 < document.lineCount)
      pos.updateFast(pos.offset + 1, ++line, 0)

    while ((textLine = document.lineAt(line)).isEmptyOrWhitespace) {
      if (++line === document.lineCount)
        return false
    }

    if (line !== pos.line)
      pos.update(line, 0)
  }

  return true
}

function categorize(charCode: number, isBlank: (charCode: number) => boolean, isWord: (charCode: number) => boolean) {
  return isWord(charCode) ? 'word' : charCode === 0 || isBlank(charCode) ? 'blank' : 'punct'
}

function selectToNextWord({ selectionSet, repetitions }: CommandState, extend: ExtendBehavior, end: boolean, wordCharset: CharSet) {
  const document = selectionSet.document,
        ctx = selectionSet.extension
  const isWord        = ctx.getCharSetFunction(wordCharset, document),
        isBlank       = ctx.getCharSetFunction(CharSet.Blank, document),
        isPunctuation = ctx.getCharSetFunction(CharSet.Punctuation, document)

  selectionSet.updateEach(({ active, anchor })=> {
    for (let i = repetitions; i > 0; i--) {
      if (active.isLastDocumentCharacter())
        return

      // Possibly skip the current character.
      const column = active.column,
            text = active.textLine().text

      const shouldSkip = column >= text.length
                      || categorize(text.charCodeAt(column), isBlank, isWord) !== categorize(text.charCodeAt(column + 1), isBlank, isWord)

      if (shouldSkip)
        active.moveRightOrGoDown()

      if (!skipEmptyLines(active, document, Forward))
        return

      if (!extend) {
        anchor.inheritPosition(active)
      }

      const cursor = active.cursor()
      const beginCharCode = cursor.charCode

      if (end) {
        if (!cursor.skipWhile(Forward, isBlank, { limitToCurrentLine: LimitToCurrentLine.Accept, select: Cursor.Select.Next }))
          return
      } else {
        cursor.skip(Forward)
      }

      const charCode = end ? cursor.charCode : beginCharCode
      let moved = true

      if (isWord(charCode))
        moved = cursor.skipWhile(Forward, isWord, { limitToCurrentLine: LimitToCurrentLine.Accept, select: Cursor.Select.Next })
      else if (isPunctuation(charCode))
        moved = cursor.skipWhile(Forward, isPunctuation, { limitToCurrentLine: LimitToCurrentLine.Accept, select: Cursor.Select.Next })

      if (!moved)
        return

      if (!end) {
        if (!cursor.skipWhile(Forward, isBlank, { limitToCurrentLine: LimitToCurrentLine.Accept, select: Cursor.Select.Next }))
          return
      }

      cursor.skip(Backward)
    }
  })
}

function selectToPreviousWord({ selectionSet, repetitions }: CommandState, extend: ExtendBehavior, wordCharset: CharSet) {
  const document = selectionSet.document,
        ctx = selectionSet.extension
  const isWord        = ctx.getCharSetFunction(wordCharset, document),
        isBlank       = ctx.getCharSetFunction(CharSet.Blank, document),
        isPunctuation = ctx.getCharSetFunction(CharSet.Punctuation, document)

  selectionSet.updateEach(({ active, anchor }) => {
    for (let i = repetitions; i > 0; i--) {
      if (active.isFirstDocumentCharacter())
        return

      // Possibly skip the current character.
      const column = active.column,
            text = active.textLine().text

      const shouldSkip = column > 0
                      && categorize(text.charCodeAt(column), isBlank, isWord) !== categorize(text.charCodeAt(column - 1), isBlank, isWord)

      if (shouldSkip)
        active.moveLeftOrStop()

      if (!skipEmptyLines(active, document, Backward))
        return

      if (!extend)
        anchor.inheritPosition(active)

      const cursor = active.cursor()

      if (!cursor.skipWhile(Backward, isBlank, { limitToCurrentLine: LimitToCurrentLine.Accept, select: Cursor.Select.Next }))
        return

      if (!isBlank(cursor.charCode)) {
        const moved = isWord(cursor.charCode)
          ? cursor.skipWhile(Backward, isWord, { limitToCurrentLine: LimitToCurrentLine.Accept, select: Cursor.Select.Current })
          : cursor.skipWhile(Backward, isPunctuation, { limitToCurrentLine: LimitToCurrentLine.Accept, select: Cursor.Select.Current })

        if (!moved)
          return
      }
    }
  })
}

registerCommand(Command.selectWord                 , CommandFlags.ChangeSelections, (_, state) =>     selectToNextWord(state, DoNotExtend, false, CharSet.Word))
registerCommand(Command.selectWordExtend           , CommandFlags.ChangeSelections, (_, state) =>     selectToNextWord(state,      Extend, false, CharSet.Word))
registerCommand(Command.selectWordAlt              , CommandFlags.ChangeSelections, (_, state) =>     selectToNextWord(state, DoNotExtend, false, CharSet.NonBlank))
registerCommand(Command.selectWordAltExtend        , CommandFlags.ChangeSelections, (_, state) =>     selectToNextWord(state,      Extend, false, CharSet.NonBlank))
registerCommand(Command.selectWordEnd              , CommandFlags.ChangeSelections, (_, state) =>     selectToNextWord(state, DoNotExtend, true, CharSet.Word))
registerCommand(Command.selectWordEndExtend        , CommandFlags.ChangeSelections, (_, state) =>     selectToNextWord(state,      Extend, true, CharSet.Word))
registerCommand(Command.selectWordAltEnd           , CommandFlags.ChangeSelections, (_, state) =>     selectToNextWord(state, DoNotExtend, true, CharSet.NonBlank))
registerCommand(Command.selectWordAltEndExtend     , CommandFlags.ChangeSelections, (_, state) =>     selectToNextWord(state,      Extend, true, CharSet.NonBlank))
registerCommand(Command.selectWordPrevious         , CommandFlags.ChangeSelections, (_, state) => selectToPreviousWord(state, DoNotExtend, CharSet.Word))
registerCommand(Command.selectWordPreviousExtend   , CommandFlags.ChangeSelections, (_, state) => selectToPreviousWord(state,      Extend, CharSet.Word))
registerCommand(Command.selectWordAltPrevious      , CommandFlags.ChangeSelections, (_, state) => selectToPreviousWord(state, DoNotExtend, CharSet.NonBlank))
registerCommand(Command.selectWordAltPreviousExtend, CommandFlags.ChangeSelections, (_, state) => selectToPreviousWord(state,      Extend, CharSet.NonBlank))


// Line selecting key bindings (x, X, alt+[xX], home, end)
// ===============================================================================================

registerCommand(Command.selectLine, CommandFlags.ChangeSelections, (editor, { selectionSet, currentCount }) => {
  if (currentCount === 0 || currentCount === 1) {
    selectionSet.updateEach(({ active, anchor, start, end }) => {
      const isFullLine = start.line === end.line && start.isFirstCharacter() && end.isLineBreak()

      if (isFullLine) {
        anchor.toNextLineFirstCharacter()
        active.toLineBreak(active.line + 1)
      } else {
        anchor.toFirstCharacter()
        active.toLineBreak()
      }
    })
  } else {
    selectionSet.updateEach(({ active, anchor }) => {
      const targetLine = Math.min(active.line + currentCount - 1, editor.document.lineCount - 1)

      anchor.toFirstCharacter(targetLine)
      active.toLineBreak(targetLine)
    })
  }
})

registerCommand(Command.selectLineExtend, CommandFlags.ChangeSelections, (editor, { selectionSet: selections, currentCount }) => {
  if (currentCount === 0 || currentCount === 1) {
    selections.updateEach(({ active, anchor }) => {
      if (active.line === anchor.line) {
        anchor.toFirstCharacter()
      }

      if (active.isLineBreak())
        active.toLineBreak(active.line + 1)
      else
        active.toLineBreak()
    })
  } else {
    selections.updateEach(({ active, anchor }) => {
      const targetLine = Math.min(active.line + currentCount - 1, editor.document.lineCount - 1)

      if (active.line === anchor.line) {
        anchor.toFirstCharacter()
      }

      active.toLineBreak(targetLine)
    })
  }
})

registerCommand(Command.selectToLineBegin, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  selectionSet.updateEachPosition(Anchor.IncludeActive, active => active.toFirstCharacter())
})

registerCommand(Command.selectToLineBeginExtend, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  selectionSet.updateEachPosition(Anchor.Extend, active => active.toFirstCharacter())
})

registerCommand(Command.selectToLineEnd, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  selectionSet.updateEachPosition(Anchor.IncludeActive, active => active.toEndCharacter())
})

registerCommand(Command.selectToLineEndExtend, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  selectionSet.updateEachPosition(Anchor.Extend, active => active.toEndCharacter())
})

registerCommand(Command.expandLines, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  selectionSet.updateEach(selection => {
    selection.start.toFirstCharacter()
    selection.end.toLineBreak()
  })
})

registerCommand(Command.trimLines, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  selectionSet.updateWithBuilder((builder, selection) => {
    const { start, end, isReversed } = selection

    if (!start.isFirstCharacter()) {
      if (start.isLastLine())
        return

      start.toNextLineFirstCharacter()
    }

    if (!end.isLineBreak()) {
      if (end.isFirstLine())
        return

      end.toPreviousLineBreak()
    }

    if (start.offset <= end.offset) {
      if (isReversed)
        selection.reverse()

      builder.push(selection)
    }
  })
})

registerCommand(Command.trimSelections, CommandFlags.ChangeSelections, (editor, { selectionSet: selections }, _, ctx) => {
  selections.updateWithBuilder((builder, selection) => {
    const isBlank = ctx.getCharSetFunction(CharSet.Blank, editor.document)

    const { start, end } = selection,
          startOffset = start.offset,
          endOffset = end.offset

    start.cursor().skipWhile(Forward, (ch, offset) => isBlank(ch) && offset < endOffset, { select: Cursor.Select.Next })
    end.cursor().skipWhile(Backward, (ch, offset) => isBlank(ch) && offset > startOffset, { select: Cursor.Select.Next })

    if (start.offset < end.offset) {
      builder.push(selection)
    }
  })
})


// Select enclosing (m, M, alt+[mM])
// ===============================================================================================

const enclosingChars = new Uint8Array(Array.from('(){}[]', ch => ch.charCodeAt(0)))

function selectEnclosing({ selectionSet }: CommandState, extend: ExtendBehavior, direction: Direction) {
  selectionSet.updateEach(({ active, anchor }) => {
    const activeCursor = active.cursor()

    if (!activeCursor.skipWhile(direction, ch => enclosingChars.indexOf(ch) === -1, { select: Cursor.Select.Next, restorePositionIfNeverSatisfied: true })) {
      return
    }

    const enclosingChar = activeCursor.textLine.text.charCodeAt(activeCursor.position.column),
          idxOfEnclosingChar = enclosingChars.indexOf(enclosingChar)

    const anchorSave = anchor.save()

    anchor.inheritPosition(active)

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
      }, { select: Cursor.Select.Previous })

      // Also include the closing character.
      active.moveRightOrStop()
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
      anchor.restore(anchorSave)
    }
  })
}

registerCommand(Command.selectEnclosing               , CommandFlags.ChangeSelections, (_, state) => selectEnclosing(state, DoNotExtend, Forward))
registerCommand(Command.selectEnclosingExtend         , CommandFlags.ChangeSelections, (_, state) => selectEnclosing(state,      Extend, Forward))
registerCommand(Command.selectEnclosingBackwards      , CommandFlags.ChangeSelections, (_, state) => selectEnclosing(state, DoNotExtend, Backward))
registerCommand(Command.selectEnclosingExtendBackwards, CommandFlags.ChangeSelections, (_, state) => selectEnclosing(state,      Extend, Backward))


// Other bindings (%)
// ===============================================================================================

registerCommand(Command.selectBuffer, CommandFlags.ChangeSelections, (_, { selectionSet }) => {
  const selection = selectionSet.selections[0]

  selection.anchor.toDocumentFirstCharacter()
  selection.active.toDocumentLastCharacter()
})
