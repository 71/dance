// Select / extend: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode from 'vscode'

import { CommandState, registerCommand, Command, CommandFlags, InputKind } from '.'
import { EditorState } from '../state/editor'
import { SelectionBehavior } from '../state/extension'
import { getCharSetFunction, CharSet } from '../utils/charset'
import { Direction, Backward, Forward, ExtendBehavior, DoNotExtend, Extend, SelectionHelper, Coord, MoveFunc, OldActive, SelectionMapper, moveActiveCoord, CoordMapper } from '../utils/selectionHelper'


// Move / extend to character (f, t, F, T, Alt+[ft], Alt+[FT])
// ===============================================================================================

function toNextCharacter(direction: Direction, include: boolean): CoordMapper {
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
          return null

        character = direction === Backward ? undefined : 0
      }
    }
    if (!include) {
      character += (direction === Backward ? 1 : -1)
    }
    return new Coord(line, character)
  }
}

function registerSelectTo(commandName: Command, include: boolean, extend: ExtendBehavior, direction: Direction) {
  const mapper = moveActiveCoord(toNextCharacter(direction, include), extend)
  registerCommand(commandName, CommandFlags.ChangeSelections, InputKind.Key, undefined, (editorState, state) => {
    SelectionHelper.for(editorState, state).mapEach(mapper)
    // TODO: Reveal
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

function skipEmptyLines(coord: Coord, document: vscode.TextDocument, direction: Direction): Coord | undefined {
  let { line } = coord

  line += direction
  while (line >= 0 && line < document.lineCount) {
    const textLine = document.lineAt(line)
    if (textLine.text.length > 0) {
      const edge = (direction === Backward) ? textLine.text.length - 1 : 0
      return new Coord(line, edge)
    }
    line += direction
  }
  return undefined
}

function categorize(charCode: number, isBlank: (charCode: number) => boolean, isWord: (charCode: number) => boolean) {
  return isWord(charCode) ? 'word' : charCode === 0 || isBlank(charCode) ? 'blank' : 'punct'
}

function selectByWord(editorState: EditorState, state: CommandState, extend: ExtendBehavior, direction: Direction, end: boolean, wordCharset: CharSet) {
  const helper = SelectionHelper.for(editorState, state)
  const { extension, repetitions } = state
  const document = editorState.editor.document
  const isWord        = getCharSetFunction(wordCharset, document),
        isBlank       = getCharSetFunction(CharSet.Blank, document),
        isPunctuation = getCharSetFunction(CharSet.Punctuation, document)

  helper.moveEach((from) => {
    let maybeAnchor = undefined,
        active  = from
    for (let i = repetitions; i > 0; i--) {
      const text = document.lineAt(active.line).text
      // 1. Starting from active, try to figure out where scanning should start.
      if (direction === Forward ? active.character + 1 >= text.length : active.character === 0) {
        let afterEmptyLines = skipEmptyLines(active, document, direction)
        if (afterEmptyLines === undefined) {
          if (direction === Backward && active.line > 0) {
            // This is a special case in Kakoune and we try to mimic it here.
            // Instead of overflowing, put maybeAnchor at document start and
            // active always on the first character on the second line.
            maybeAnchor = new Coord(0, 0)
            active = new Coord(1, 0)
            continue
          } else {
            // Otherwise the selection overflows.
            return { overflow: true, maybeAnchor, active }
          }
        }
        maybeAnchor = afterEmptyLines
      } else if (direction === Backward && active.character >= text.length) {
        maybeAnchor = new Coord(active.line, text.length - 1)
      } else {
        // Skip current character if it is at boundary. (e.g. "ab[c]  ")
        const column = active.character
        const shouldSkip = categorize(text.charCodeAt(column), isBlank, isWord) !== categorize(text.charCodeAt(column + direction), isBlank, isWord)
        maybeAnchor = shouldSkip ? new Coord(active.line, active.character + direction) : active
      }

      active = maybeAnchor

      // 2. Then scan within the current line until the word ends.

      const curLineText = document.lineAt(active).text
      let nextCol = active.character // The next character to be tested.
      if (end) {
        // Select the whitespace before word, if any.
        while (nextCol >= 0 && nextCol < curLineText.length && isBlank(curLineText.charCodeAt(nextCol)))
          nextCol += direction
      }
      if (nextCol >= 0 && nextCol < curLineText.length) {
        const startCharCode = curLineText.charCodeAt(nextCol)
        const isSameCategory = isWord(startCharCode) ? isWord : isPunctuation
        while (nextCol >= 0 && nextCol < curLineText.length && isSameCategory(curLineText.charCodeAt(nextCol)))
          nextCol += direction
      }
      if (!end) {
        // Select the whitespace after word, if any.
        while (nextCol >= 0 && nextCol < curLineText.length && isBlank(curLineText.charCodeAt(nextCol)))
          nextCol += direction
      }
      // If we reach here, nextCol must be the first character we encounter that
      // does not belong to the current word (or -1 / line break). Exclude it.
      active = new Coord(active.line, nextCol - direction)
    }
    return { maybeAnchor: maybeAnchor!, active }
  }, extend)
}


registerCommand(Command.selectWord                 , CommandFlags.ChangeSelections, (editorState, state) => selectByWord(editorState, state, DoNotExtend,  Forward, false, CharSet.Word))
registerCommand(Command.selectWordExtend           , CommandFlags.ChangeSelections, (editorState, state) => selectByWord(editorState, state,      Extend,  Forward, false, CharSet.Word))
registerCommand(Command.selectWordAlt              , CommandFlags.ChangeSelections, (editorState, state) => selectByWord(editorState, state, DoNotExtend,  Forward, false, CharSet.NonBlank))
registerCommand(Command.selectWordAltExtend        , CommandFlags.ChangeSelections, (editorState, state) => selectByWord(editorState, state,      Extend,  Forward, false, CharSet.NonBlank))
registerCommand(Command.selectWordEnd              , CommandFlags.ChangeSelections, (editorState, state) => selectByWord(editorState, state, DoNotExtend,  Forward,  true, CharSet.Word))
registerCommand(Command.selectWordEndExtend        , CommandFlags.ChangeSelections, (editorState, state) => selectByWord(editorState, state,      Extend,  Forward,  true, CharSet.Word))
registerCommand(Command.selectWordAltEnd           , CommandFlags.ChangeSelections, (editorState, state) => selectByWord(editorState, state, DoNotExtend,  Forward,  true, CharSet.NonBlank))
registerCommand(Command.selectWordAltEndExtend     , CommandFlags.ChangeSelections, (editorState, state) => selectByWord(editorState, state,      Extend,  Forward,  true, CharSet.NonBlank))
registerCommand(Command.selectWordPrevious         , CommandFlags.ChangeSelections, (editorState, state) => selectByWord(editorState, state, DoNotExtend, Backward,  true, CharSet.Word))
registerCommand(Command.selectWordPreviousExtend   , CommandFlags.ChangeSelections, (editorState, state) => selectByWord(editorState, state,      Extend, Backward,  true, CharSet.Word))
registerCommand(Command.selectWordAltPrevious      , CommandFlags.ChangeSelections, (editorState, state) => selectByWord(editorState, state, DoNotExtend, Backward,  true, CharSet.NonBlank))
registerCommand(Command.selectWordAltPreviousExtend, CommandFlags.ChangeSelections, (editorState, state) => selectByWord(editorState, state,      Extend, Backward,  true, CharSet.NonBlank))


// Line selecting key bindings (x, X, alt+[xX], home, end)
// ===============================================================================================

registerCommand(Command.selectLine, CommandFlags.ChangeSelections, ({ editor }, { currentCount }) => {
  const selections = editor.selections,
        len = selections.length

  if (currentCount === 0 || currentCount === 1) {
    for (let i = 0; i < len; i++) {
      const selection = selections[i]

      selections[i] = new vscode.Selection(selection.active.line, 0, selection.active.line + 1, 0)
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

registerCommand(Command.selectLineExtend, CommandFlags.ChangeSelections, ({ editor }, { currentCount, selectionBehavior }) => {
  const selections = editor.selections,
        len = selections.length

  if (currentCount === 0 || currentCount === 1) {
    for (let i = 0; i < len; i++) {
      const selection = selections[i],
            isSameLine = selection.isSingleLine || (selection.active.character === 0 && selection.active.line === selection.anchor.line + 1)

      const anchor = isSameLine
        ? selection.anchor.with(undefined, 0)
        : selection.anchor
      const active = selection.active.character === 0 && !selection.isReversed && selectionBehavior === SelectionBehavior.Character
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

const toLineBegin: CoordMapper = (from) => from.with(undefined, 0)

const selectToLineBegin = moveActiveCoord(toLineBegin, DoNotExtend)
registerCommand(Command.selectToLineBegin, CommandFlags.ChangeSelections, (editorState, state) => {
  SelectionHelper.for(editorState, state).mapEach(selectToLineBegin)
})

const selectToLineBeginExtend = moveActiveCoord(toLineBegin, Extend)
registerCommand(Command.selectToLineBeginExtend, CommandFlags.ChangeSelections, (editorState, state) => {
  SelectionHelper.for(editorState, state).mapEach(selectToLineBeginExtend)
})

const toLineEnd: CoordMapper = (from, helper) => {
  let newCol = helper.editor.document.lineAt(from.line).text.length
  if (newCol > 0 && helper.selectionBehavior === SelectionBehavior.Character) newCol--
  return from.with(undefined, newCol)
}

const selectToLineEnd = moveActiveCoord(toLineEnd, DoNotExtend)
registerCommand(Command.selectToLineEnd, CommandFlags.ChangeSelections, (editorState, state) => {
  SelectionHelper.for(editorState, state).mapEach(selectToLineEnd)
})

const selectToLineEndExtend = moveActiveCoord(toLineEnd, Extend)
registerCommand(Command.selectToLineEndExtend, CommandFlags.ChangeSelections, (editorState, state) => {
  SelectionHelper.for(editorState, state).mapEach(selectToLineEndExtend)
})

const expandLine: SelectionMapper = (selection, helper) => {
  // This command is idempotent. state.currentCount is intentionally ignored.
  const { start, end } = selection,
        document = helper.editor.document
  // Move start to line start and end to include line break.
  const newStart = start.with(undefined, 0)
  let newEnd
  if (end.character === 0) {
    // End is next line start, which means the selection already includes
    // the line break of last line.
    newEnd = end
  } else if (end.line + 1 < document.lineCount) {
    // Move end to the next line start to include the line break.
    newEnd = new vscode.Position(end.line + 1, 0)
  } else {
    // End is at the last line, so try to include all text.
    const textLen = document.lineAt(end.line).text.length
    newEnd = end.with(undefined, textLen)
  }
  // After expanding, the selection should be in the same direction as before.
  if (selection.isReversed)
    return new vscode.Selection(newEnd, newStart)
  else
    return new vscode.Selection(newStart, newEnd)
}

registerCommand(Command.expandLines, CommandFlags.ChangeSelections, (editorState, state) => {
  SelectionHelper.for(editorState, state).mapEach(expandLine)
})

const trimToFullLines: SelectionMapper = (selection, helper) => {
  // This command is idempotent. state.currentCount is intentionally ignored.
  const { start, end } = selection
  // If start is not at line start, move it to the next line start.
  const newStart = (start.character === 0) ? start : new vscode.Position(start.line + 1, 0)
  // Move end to the line start, so that the selection ends with a line break.
  let newEnd = end.with(undefined, 0)

  if (newStart.isAfterOrEqual(newEnd)) {
    // The selection is deleted if there is no full line contained.
    return null
  }

  // After trimming, the selection should be in the same direction as before.
  // Except when selecting only one empty line in non-directional mode, prefer
  // to keep the selection facing forward.
  if (selection.isReversed &&
      !(helper.selectionBehavior === SelectionBehavior.Character && newStart.line + 1 === newEnd.line))
    return new vscode.Selection(newEnd, newStart)
  else
    return new vscode.Selection(newStart, newEnd)
}

registerCommand(Command.trimLines, CommandFlags.ChangeSelections, (editorState, state) => {
  SelectionHelper.for(editorState, state).mapEach(trimToFullLines)
})

const trimSelections: SelectionMapper = (selection, helper) => {
  // This command is idempotent. state.currentCount is intentionally ignored.
  const document = helper.editor.document
  const isBlank = getCharSetFunction(CharSet.Blank, document)

  let startLine = selection.start.line,
      startCol = selection.start.character,
      startLineText = document.lineAt(startLine).text,
      endLine = selection.end.line,
      endCol = selection.end.character,
      endLineText = document.lineAt(endLine).text

  while (startCol >= startLineText.length || isBlank(startLineText.charCodeAt(startCol))) {
    startCol++
    if (startCol >= startLineText.length) {
      startLine++
      if (startLine > endLine) return null
      startLineText = document.lineAt(startLine).text
      startCol = 0
    }
  }

  while (endCol <= 0 || isBlank(endLineText.charCodeAt(endCol - 1))) {
    endCol--
    if (endCol <= 0) {
      endLine--
      if (endLine < startLine) return null
      endLineText = document.lineAt(endLine).text
      endCol = endLineText.length
    }
  }

  let reverseSelection = selection.isReversed
  if (startLine === endLine) {
    if (startCol >= endCol) {
      // The selection is deleted if the selection contains entirely whitespace.
      return null
    }
    if (helper.selectionBehavior === SelectionBehavior.Character && startCol + 1 === endCol) {
      // When selecting only one character in non-directional mode, prefer
      // to keep the selection facing forward.
      reverseSelection = false
    }
  }

  if (reverseSelection) {
    return new vscode.Selection(startLine, startCol, endLine, endCol)
  } else {
    return new vscode.Selection(endLine, endCol, startLine, startCol)
  }
}

registerCommand(Command.trimSelections, CommandFlags.ChangeSelections, (editorState, state) => {
  SelectionHelper.for(editorState, state).mapEach(trimSelections)
})


// Select enclosing (m, M, alt+[mM])
// ===============================================================================================

const Cursor = class {} // TODO: Remove

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

registerCommand(Command.selectBuffer, CommandFlags.ChangeSelections, ({ editor }) => {
  const lastLine = editor.document.lineAt(editor.document.lineCount - 1)

  editor.selections = [new vscode.Selection(0, 0, lastLine.lineNumber, lastLine.text.length)]
})
