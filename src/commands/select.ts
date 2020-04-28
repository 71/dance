// Select / extend: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode from 'vscode'

import { CommandState, registerCommand, Command, CommandFlags, InputKind } from '.'
import { CharSet, Extension } from '../extension'
import { Direction, Anchor, Backward, Forward, ExtendBehavior, LimitToCurrentLine, DoNotExtend, Extend, Position, Cursor } from '../utils/selectionSet'
import { MoveMode, SkipFunc, SelectFunc, SelectionHelper, Coord } from '../utils/selectionHelper'

// Move / extend to character (f, t, F, T, Alt+[ft], Alt+[FT])
// ===============================================================================================
const noSkip: SkipFunc = from => from

function selectToNextCharacter(direction: Direction, include: boolean): SelectFunc {
  return (from, helper) => {
    const key = helper.state.input as string
    const active = from

    let line = active.line
    let character: number | undefined = active.character

    for (let i = helper.state.repetitions; i > 0; i--) {
      for (;;) {
        const text = helper.editor.document.lineAt(line).text
        if (character === undefined) character = text.length
        const idx: number = direction === Backward ? text.lastIndexOf(key, character - 1) : text.indexOf(key, character + 1)

        if (idx !== -1) {
          character = idx

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
    if (include) {
      return new Coord(line, character!)
    } else {
      return new Coord(line, character! + (direction === Backward ? 1 : -1))
    }
  }
}

function registerSelectTo(commandName: Command, include: boolean, extend: ExtendBehavior, direction: Direction) {
  const selectFunc = selectToNextCharacter(direction, include)
  registerCommand(commandName, CommandFlags.ChangeSelections, InputKind.Key, undefined, (editor, state) => {
    SelectionHelper.for(editor, state).moveEach(MoveMode.ToCoverChar, noSkip, selectFunc, extend)
  })
}

registerSelectTo(Command.selectToIncluded      ,  true, DoNotExtend, Forward)
registerSelectTo(Command.selectToIncludedExtend,  true, Extend     , Forward)
registerSelectTo(Command.selectToExcluded      , false, DoNotExtend, Forward)
registerSelectTo(Command.selectToExcludedExtend, false, Extend     , Forward)

registerSelectTo(Command.selectToIncludedBackwards      ,  true, DoNotExtend, Backward)
registerSelectTo(Command.selectToIncludedExtendBackwards,  true, Extend     , Backward)
registerSelectTo(Command.selectToExcludedBackwards      , false, DoNotExtend, Backward)
registerSelectTo(Command.selectToExcludedExtendBackwards, false, Extend     , Backward)


// Move / extend to word begin / end (w, b, e, W, B, E, alt+[wbe], alt+[WBE])
// ===============================================================================================

function skipEmptyLines(coord: Coord, document: vscode.TextDocument, direction: Direction): Coord | null {
  let { line, character } = coord
  let textLine: vscode.TextLine

  if (direction === Backward) {
    if (character === 0 && line > 0) {
      line--
    }
  } else {
    if (character === document.lineAt(line).text.length - 1 && line + 1 < document.lineCount) {
      line++
    }
  }

  do {
    textLine = document.lineAt(line)
    if (!textLine.isEmptyOrWhitespace) {
      if (line === coord.line) return coord
      const edge = (direction === Backward) ? textLine.text.length - 1 : 0
      return new Coord(line, edge)
    }
    line += direction
  } while (line >= 0 && line < document.lineCount)
  return null
}

function categorize(charCode: number, isBlank: (charCode: number) => boolean, isWord: (charCode: number) => boolean) {
  return isWord(charCode) ? 'word' : charCode === 0 || isBlank(charCode) ? 'blank' : 'punct'
}

function skipWhile(document: vscode.TextDocument, pos: Coord, direction: Direction, dontSkipLine: boolean, cond: (c: number) => boolean): Coord | undefined {
  const diff = direction as number

  let { line } = pos

  const posLineText = document.lineAt(line).text
  if (pos.character < posLineText.length && !cond(posLineText.charCodeAt(pos.character))) return pos

  while (line >= 0 && line < document.lineCount) {
    let { text } = document.lineAt(line)
    let character = line === pos.line
      ? (direction === Backward ? pos.character - 1 : pos.character)
      : (direction === Backward ? text.length - 1   : 0)

    while (character >= 0 && character < text.length) {
      if (!cond(text.charCodeAt(character)) || (dontSkipLine && direction === Backward && character === 0))
        return new vscode.Position(line, character)

      character += diff

      if (dontSkipLine && direction === Forward && character === text.length)
        return new vscode.Position(line, character)
    }

    line += diff
  }

  return undefined
}

function selectToNextWord(editor: vscode.TextEditor, state: CommandState, extend: ExtendBehavior, end: boolean, wordCharset: CharSet, ctx: Extension) {
  const helper = SelectionHelper.for(editor, state)
  const { repetitions } = state
  const document = editor.document
  const isWord        = ctx.getCharSetFunction(wordCharset, document),
        isBlank       = ctx.getCharSetFunction(CharSet.Blank, document),
        isPunctuation = ctx.getCharSetFunction(CharSet.Punctuation, document)

  helper.moveEachX(MoveMode.ToCoverChar, (from) => {
    let skipAt = from,
        endAt  = from
    for (let i = repetitions; i > 0; i--) {
      const text = document.lineAt(endAt.line).text
      if (endAt.line === document.lineCount - 1 && endAt.character === text.length - 1)
        return null

      // Possibly skip the current character.
      const column = endAt.character

      const shouldSkip = column >= text.length
                      || categorize(text.charCodeAt(column), isBlank, isWord) !== categorize(text.charCodeAt(column + 1), isBlank, isWord)

      skipAt = shouldSkip ? helper.coordAt(helper.offsetAt(endAt) + 1) : endAt

      let afterEmptyLines = skipEmptyLines(skipAt, document, Forward)
      if (afterEmptyLines === null) {
        return null // TODO: Is this really correct?
      } else {
        skipAt = afterEmptyLines
      }

      let cur = skipAt
      const beginCharCode = document.lineAt(endAt).text.charCodeAt(cur.character)

      if (end) {
        const skipResult = skipWhile(document, cur, Forward, false, isBlank)
        if (!skipResult) return null
        cur = skipResult
      }

      const charCode = end ? document.lineAt(cur.line).text.charCodeAt(cur.character) : beginCharCode

      let skipResult: Coord | undefined = cur
      if (isWord(charCode))
        skipResult = skipWhile(document, cur, Forward, false, isWord)
      else if (isPunctuation(charCode))
        skipResult = skipWhile(document, cur, Forward, false, isPunctuation)

      if (skipResult)
        cur = skipResult
      else
        cur = new Coord(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)

      if (!end) {
        skipResult = skipWhile(editor.document, cur, Forward, false, isBlank)
        if (skipResult)
          cur = skipResult
        else
          cur = new Coord(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)
      }

      endAt = helper.coordAt(helper.offsetAt(cur) - 1)
    }
    return [skipAt, endAt]
  }, extend)
}

function selectToPreviousWord(editor: vscode.TextEditor, state: CommandState, extend: ExtendBehavior, wordCharset: CharSet, ctx: Extension) {
  const helper = SelectionHelper.for(editor, state)
  const { repetitions } = state
  const document = editor.document
  const isWord        = ctx.getCharSetFunction(wordCharset, document),
        isBlank       = ctx.getCharSetFunction(CharSet.Blank, document),
        isPunctuation = ctx.getCharSetFunction(CharSet.Punctuation, document)

  helper.moveEachX(MoveMode.ToCoverChar, (from) => {
    let skipAt = from,
        endAt  = from
    for (let i = repetitions; i > 0; i--) {
      if (endAt.character === 0 && endAt.line === 0) return null

      const text = document.lineAt(endAt.line).text
      // Possibly skip the current character.
      const column = endAt.character

      const shouldSkip = column > 0
                      && categorize(text.charCodeAt(column), isBlank, isWord) !== categorize(text.charCodeAt(column - 1), isBlank, isWord)

      skipAt = shouldSkip ? new Coord(endAt.line, column - 1) : endAt

      let beforeEmptyLines = skipEmptyLines(skipAt, document, Backward)
      if (beforeEmptyLines === null) {
        return null // TODO: Is this really correct?
      } else {
        skipAt = beforeEmptyLines
      }

      let cur = skipAt

      const skipResult = skipWhile(document, cur, Backward, false, isBlank)
      if (!skipResult) return null
      cur = skipResult

      const charCode = document.lineAt(cur.line).text.charCodeAt(cur.character)
      if (!isBlank(charCode)) {
        let skipResult
        if (isWord(charCode))
          skipResult = skipWhile(document, cur, Backward, false, isWord)
        else
          skipResult = skipWhile(document, cur, Backward, false, isPunctuation)

        if (skipResult)
          cur = helper.coordAt(helper.offsetAt(skipResult) + 1)
        else
          cur = new Coord(0, 0)
      }
      endAt = cur
    }
    return [skipAt, endAt]
  }, extend)
}

registerCommand(Command.selectWord                 , CommandFlags.ChangeSelections, (editor, state, __, ctx) =>     selectToNextWord(editor, state, DoNotExtend, false, CharSet.Word, ctx))
registerCommand(Command.selectWordExtend           , CommandFlags.ChangeSelections, (editor, state, __, ctx) =>     selectToNextWord(editor, state,      Extend, false, CharSet.Word, ctx))
registerCommand(Command.selectWordAlt              , CommandFlags.ChangeSelections, (editor, state, __, ctx) =>     selectToNextWord(editor, state, DoNotExtend, false, CharSet.NonBlank, ctx))
registerCommand(Command.selectWordAltExtend        , CommandFlags.ChangeSelections, (editor, state, __, ctx) =>     selectToNextWord(editor, state,      Extend, false, CharSet.NonBlank, ctx))
registerCommand(Command.selectWordEnd              , CommandFlags.ChangeSelections, (editor, state, __, ctx) =>     selectToNextWord(editor, state, DoNotExtend, true, CharSet.Word, ctx))
registerCommand(Command.selectWordEndExtend        , CommandFlags.ChangeSelections, (editor, state, __, ctx) =>     selectToNextWord(editor, state,      Extend, true, CharSet.Word, ctx))
registerCommand(Command.selectWordAltEnd           , CommandFlags.ChangeSelections, (editor, state, __, ctx) =>     selectToNextWord(editor, state, DoNotExtend, true, CharSet.NonBlank, ctx))
registerCommand(Command.selectWordAltEndExtend     , CommandFlags.ChangeSelections, (editor, state, __, ctx) =>     selectToNextWord(editor, state,      Extend, true, CharSet.NonBlank, ctx))
registerCommand(Command.selectWordPrevious         , CommandFlags.ChangeSelections, (editor, state, __, ctx) => selectToPreviousWord(editor, state, DoNotExtend, CharSet.Word, ctx))
registerCommand(Command.selectWordPreviousExtend   , CommandFlags.ChangeSelections, (editor, state, __, ctx) => selectToPreviousWord(editor, state,      Extend, CharSet.Word, ctx))
registerCommand(Command.selectWordAltPrevious      , CommandFlags.ChangeSelections, (editor, state, __, ctx) => selectToPreviousWord(editor, state, DoNotExtend, CharSet.NonBlank, ctx))
registerCommand(Command.selectWordAltPreviousExtend, CommandFlags.ChangeSelections, (editor, state, __, ctx) => selectToPreviousWord(editor, state,      Extend, CharSet.NonBlank, ctx))


// Line selecting key bindings (x, X, alt+[xX], home, end)
// ===============================================================================================

registerCommand(Command.selectLine, CommandFlags.ChangeSelections, (editor, { currentCount }) => {
  const selections = editor.selections,
        len = selections.length

  if (currentCount === 0 || currentCount === 1) {
    for (let i = 0; i < len; i++) {
      const selection = selections[i],
            isFullLine = selection.start.line === selection.end.line - 1 && selection.start.character === 0 && selection.end.character === 0

      selections[i] = isFullLine
        ? new vscode.Selection(selection.active.line, 0, selection.active.line + 1, 0)
        : new vscode.Selection(selection.anchor.line, 0, selection.active.line + 1, 0)
    }
  } else {
    for (let i = 0; i < len; i++) {
      const selection = selections[i],
            targetLine = Math.min(selection.active.line + currentCount - 1, editor.document.lineCount - 1)

      selections[i] = new vscode.Selection(targetLine, 0, targetLine + 1, 0)
    }
  }

  editor.selections = selections
})

registerCommand(Command.selectLineExtend, CommandFlags.ChangeSelections, (editor, { currentCount, allowEmptySelections }) => {
  const selections = editor.selections,
        len = selections.length

  if (currentCount === 0 || currentCount === 1) {
    for (let i = 0; i < len; i++) {
      const selection = selections[i],
            isSameLine = selection.isSingleLine || (selection.active.character === 0 && selection.active.line === selection.anchor.line + 1)

      const anchor = isSameLine
        ? selection.anchor.with(undefined, 0)
        : selection.anchor
      const active = selection.active.character === 0 && !allowEmptySelections && !selection.isReversed
        ? selection.active.translate(1)
        : new vscode.Position(selection.active.line + 1, 0)

      selections[i] = new vscode.Selection(anchor, active)
    }
  } else {
    for (let i = 0; i < len; i++) {
      const selection = selections[i],
            targetLine = Math.min(selection.active.line + currentCount - 1, editor.document.lineCount - 1),
            isSameLine = selection.isSingleLine || (selection.active.character === 0 && selection.active.line === selection.anchor.line + 1)

      const anchor = isSameLine
        ? selection.anchor.with(undefined, 0)
        : selection.anchor
      const active = new vscode.Position(targetLine + 1, 0)

      selections[i] = new vscode.Selection(anchor, active)
    }
  }

  editor.selections = selections
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

registerCommand(Command.selectBuffer, CommandFlags.ChangeSelections, (editor) => {
  const lastLine = editor.document.lineAt(editor.document.lineCount - 1)

  editor.selections = [new vscode.Selection(0, 0, lastLine.lineNumber, lastLine.text.length)]
})
