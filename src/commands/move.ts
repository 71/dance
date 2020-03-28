// Movement: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, InputKind } from '.'

import { TextBuffer } from '../utils/textBuffer'
import { Direction, Forward, Backward, getAnchorForExtending, getActiveForExtending, forExtending, isSingleCharacter, ExtendBehavior, DoNotExtend, Extend } from '../utils/selections'


// Move around (h, j, k, l, H, J, K, L, arrows, shift+arrows)
// ===============================================================================================

// There was initially a single function for all movements;
// this was however changed to make sure the logic was as
// straightforward as possible.

const preferredColumnsPerEditor = new WeakMap<vscode.TextEditor, number[]>()

function atOffset(position: vscode.Position, offset: number, document: vscode.TextDocument) {
  return document.positionAt(document.offsetAt(position) + offset)
}

function moveLeft(editor: vscode.TextEditor, extend: ExtendBehavior, offset: number, allowEmptySelections: boolean) {
  preferredColumnsPerEditor.delete(editor)

  let selections = editor.selections.slice(),
      firstActive = undefined as vscode.Position | undefined

  for (let i = 0; i < selections.length; i++) {
    const selection = selections[i]

    if (!allowEmptySelections && isSingleCharacter(selection)) {
      if (extend)
        selections[i] = new vscode.Selection(selection.end, atOffset(selection.start, -offset, editor.document))
      else
        selections[i] = new vscode.Selection(atOffset(selection.end, -offset, editor.document), atOffset(selection.start, -offset, editor.document))
    } else {
      const localOffset = !allowEmptySelections && !extend && !selection.isReversed ? offset + 1 : offset
      const active = atOffset(selection.active, -localOffset, editor.document)

      selections[i] = new vscode.Selection(extend ? selection.anchor : active, active)
    }

    if (firstActive === undefined || firstActive.isAfter(selections[i].active))
      firstActive = selections[i].active
  }

  editor.selections = selections
  editor.revealRange(new vscode.Range(firstActive!, firstActive!))
}

function moveRight(editor: vscode.TextEditor, extend: ExtendBehavior, offset: number, allowEmptySelections: boolean) {
  preferredColumnsPerEditor.delete(editor)

  let selections = editor.selections.slice(),
      lastActive = undefined as vscode.Position | undefined

  for (let i = 0; i < selections.length; i++) {
    const selection = selections[i]

    if (!allowEmptySelections && isSingleCharacter(selection)) {
      if (extend)
        selections[i] = new vscode.Selection(selection.start, atOffset(selection.end, offset, editor.document))
      else
        selections[i] = new vscode.Selection(atOffset(selection.start, offset, editor.document), atOffset(selection.end, offset, editor.document))
    } else {
      const localOffset = !allowEmptySelections && !extend && !selection.isReversed ? offset - 1 : offset
      const active = atOffset(selection.active, localOffset, editor.document)

      selections[i] = new vscode.Selection(extend ? selection.anchor : active, active)
    }

    if (lastActive === undefined || lastActive.isBefore(selections[i].active))
      lastActive = selections[i].active
  }

  editor.selections = selections
  editor.revealRange(new vscode.Range(lastActive!, lastActive!))
}

function moveUp(editor: vscode.TextEditor, expand: boolean, mult: number, allowEmptySelections: boolean) {
  let preferredColumns = preferredColumnsPerEditor.get(editor)

  if (preferredColumns === undefined)
    preferredColumnsPerEditor.set(editor, preferredColumns = [])

  let selections = editor.selections,
      firstPosition = undefined as vscode.Position | undefined

  if (preferredColumns.length !== selections.length) {
    preferredColumns.length = 0

    for (let i = 0; i < selections.length; i++)
      preferredColumns.push(selections[i].active.character)
  }

  for (let i = 0; i < selections.length; i++) {
    const selection = expand && !allowEmptySelections ? forExtending(selections[i], Backward) : selections[i]
    let { active } = selection

    if (active.line === 0)
      continue

    if (selections === editor.selections)
      selections = selections.slice()

    active = new vscode.Position(Math.max(active.line - mult, 0), preferredColumns[i])
    selections[i] = new vscode.Selection(expand ? selection.anchor : active, active)

    if (firstPosition === undefined || firstPosition.isAfter(active))
      firstPosition = active
  }

  editor.selections = selections
  editor.revealRange(new vscode.Range(firstPosition!, firstPosition!))
}

function moveDown(editor: vscode.TextEditor, expand: boolean, mult: number, allowEmptySelections: boolean) {
  let preferredColumns = preferredColumnsPerEditor.get(editor)

  if (preferredColumns === undefined)
    preferredColumnsPerEditor.set(editor, preferredColumns = [])

  const lastLine = editor.document.lineCount - 1
  let selections = editor.selections,
      lastPosition = undefined as vscode.Position | undefined

  if (preferredColumns.length !== selections.length) {
    preferredColumns.length = 0

    for (let i = 0; i < selections.length; i++)
      preferredColumns.push(selections[i].active.character)
  }

  for (let i = 0; i < selections.length; i++) {
    const selection = expand && !allowEmptySelections ? forExtending(selections[i], Forward) : selections[i]
    let { active } = selection

    if (active.line === lastLine)
      continue

    if (selections === editor.selections)
      selections = selections.slice()

    active = new vscode.Position(Math.min(active.line + mult, lastLine), preferredColumns[i])
    selections[i] = new vscode.Selection(expand ? selection.anchor : active, active)

    if (lastPosition === undefined || lastPosition.isBefore(active))
      lastPosition = active
  }

  editor.selections = selections
  editor.revealRange(new vscode.Range(lastPosition!, lastPosition!))
}

// Move/extend left/down/up/right
registerCommand(Command.left       , CommandFlags.ChangeSelections, (editor, { currentCount }, _, ctx) =>  moveLeft(editor, DoNotExtend, currentCount || 1, ctx.allowEmptySelections))
registerCommand(Command.leftExtend , CommandFlags.ChangeSelections, (editor, { currentCount }, _, ctx) =>  moveLeft(editor,      Extend, currentCount || 1, ctx.allowEmptySelections))
registerCommand(Command.right      , CommandFlags.ChangeSelections, (editor, { currentCount }, _, ctx) => moveRight(editor, DoNotExtend, currentCount || 1, ctx.allowEmptySelections))
registerCommand(Command.rightExtend, CommandFlags.ChangeSelections, (editor, { currentCount }, _, ctx) => moveRight(editor,      Extend, currentCount || 1, ctx.allowEmptySelections))
registerCommand(Command.up         , CommandFlags.ChangeSelections, (editor, { currentCount }, _, ctx) =>    moveUp(editor, false, currentCount || 1, ctx.allowEmptySelections))
registerCommand(Command.upExtend   , CommandFlags.ChangeSelections, (editor, { currentCount }, _, ctx) =>    moveUp(editor, true , currentCount || 1, ctx.allowEmptySelections))
registerCommand(Command.down       , CommandFlags.ChangeSelections, (editor, { currentCount }, _, ctx) =>  moveDown(editor, false, currentCount || 1, ctx.allowEmptySelections))
registerCommand(Command.downExtend , CommandFlags.ChangeSelections, (editor, { currentCount }, _, ctx) =>  moveDown(editor, true , currentCount || 1, ctx.allowEmptySelections))


// Move / extend to character (f, t, F, T, Alt+[ft], Alt+[FT])
// ===============================================================================================

function registerSelectTo(commandName: Command, diff: number, extend: boolean, direction: Direction) {
  registerCommand(commandName, CommandFlags.ChangeSelections, InputKind.Key, undefined, (editor, { currentCount, input: key }) => {
    editor.selections = editor.selections.map(selection => {
      const active = getActiveForExtending(selection, direction)

      let line = active.line
      let idx = direction === Backward
        ? editor.document.lineAt(line).text.lastIndexOf(key, active.character - 1 - diff)
        : editor.document.lineAt(line).text.indexOf(key, active.character + 1 - diff)

      for (let i = currentCount || 1; i > 0; i--) {
        while (idx === -1) {
          // There is no initial match, so we check the surrounding lines

          if (direction === Backward) {
            if (line-- === 0)
              return selection // No match
          } else {
            if (++line === editor.document.lineCount)
              return selection // No match
          }

          const { text } = editor.document.lineAt(line)

          idx = direction === Backward ? text.lastIndexOf(key) : text.indexOf(key)
        }
      }

      return new vscode.Selection(extend ? getAnchorForExtending(selection, direction) : active, new vscode.Position(line, idx + diff))
    })
  })
}

registerSelectTo(Command.selectToIncluded      , 1, false, Forward)
registerSelectTo(Command.selectToIncludedExtend, 1, true , Forward)
registerSelectTo(Command.selectToExcluded      , 0, false, Forward)
registerSelectTo(Command.selectToExcludedExtend, 0, true , Forward)

registerSelectTo(Command.selectToIncludedBackwards      , 0, false, Backward)
registerSelectTo(Command.selectToIncludedExtendBackwards, 0, true , Backward)
registerSelectTo(Command.selectToExcludedBackwards      , 1, false, Backward)
registerSelectTo(Command.selectToExcludedExtendBackwards, 1, true , Backward)


// Move / extend to word begin / end (w, b, e, W, B, E, alt+[wbe], alt+[WBE])
// ===============================================================================================

function isPunctuation(c: string) {
  return !isAlphaWord(c) && !isBlank(c)
}

export function isAlphaWord(c: string) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || (c === '_') || (c === '-')
}

function isNonWsWord(c: string) {
  return c !== ' ' && c !== '\t'
}

function isBlank(c: string) {
  return c === ' ' || c === '\t'
}

function skipWhile(document: vscode.TextDocument, pos: vscode.Position, direction: Direction, dontSkipLine: boolean, cond: (c: string) => boolean) {
  const diff = direction as number

  let { line } = pos

  while (line >= 0 && line < document.lineCount) {
    let { text } = document.lineAt(line)
    let character = line === pos.line
      ? (direction === Backward ? pos.character - 1 : pos.character)
      : (direction === Backward ? text.length - 1   : 0)

    while (character >= 0 && character < text.length) {
      if (!cond(text[character]) || (dontSkipLine && direction === Backward && character === 0))
        return new vscode.Position(line, character)

      character += diff

      if (dontSkipLine && direction === Forward && character === text.length)
        return new vscode.Position(line, character)
    }

    line += diff
  }

  return undefined
}

function skipEmptyLines(document: vscode.TextDocument, pos: vscode.Position, direction: Direction) {
  let { line } = pos

  if (!document.lineAt(line).isEmptyOrWhitespace)
    return pos

  let lineInfo: vscode.TextLine

  while ((lineInfo = document.lineAt(line)).isEmptyOrWhitespace) {
    if (direction === Backward) {
      if (line-- === 0)
        return undefined
    } else {
      if (++line === document.lineCount)
        return undefined
    }
  }

  return direction === Backward ? lineInfo.range.end : lineInfo.range.start
}


function registerToNextWord(commandName: Command, extend: boolean, end: boolean, isWord: (c: string) => boolean) {
  registerCommand(commandName, CommandFlags.ChangeSelections, (editor, state) => {
    editor.selections = editor.selections.map(selection => {
      const anchor = extend ? getAnchorForExtending(selection, Forward) : getActiveForExtending(selection, Forward),
            endPosition = editor.document.lineAt(editor.document.lineCount - 1).rangeIncludingLineBreak.end,
            defaultSelection = new vscode.Selection(anchor, endPosition)

      for (let i = state.currentCount || 1; i > 0; i--) {
        let pos = skipEmptyLines(editor.document, getActiveForExtending(selection, Forward), Forward)

        if (pos === undefined)
          return defaultSelection

        const wordStart = extend ? anchor : pos

        if (end) {
          pos = skipWhile(editor.document, pos, Forward, false, isBlank)

          if (pos === undefined)
            return defaultSelection
        }

        let ch = editor.document.lineAt(pos).text[pos.character]

        if (isWord(ch))
          pos = skipWhile(editor.document, pos, Forward, true, isWord)
        else if (isPunctuation(ch))
          pos = skipWhile(editor.document, pos, Forward, true, isPunctuation)

        if (pos === undefined)
          return defaultSelection

        if (!end) {
          pos = skipWhile(editor.document, pos, Forward, false, isBlank)

          if (pos === undefined)
            return defaultSelection
        }

        selection = new vscode.Selection(wordStart, pos)
      }

      return selection
    })
  })
}

function registerToPreviousWord(commandName: Command, extend: boolean, isWord: (c: string) => boolean) {
  registerCommand(commandName, CommandFlags.ChangeSelections, (editor, state) => {
    editor.selections = editor.selections.map(selection => {
      const anchor = extend ? getAnchorForExtending(selection, Backward) : getActiveForExtending(selection, Backward),
            startPosition = new vscode.Position(0, 0),
            defaultSelection = new vscode.Selection(anchor, startPosition)

      for (let i = state.currentCount || 1; i > 0; i--) {
        let pos = skipEmptyLines(editor.document, getActiveForExtending(selection, Backward), Backward)

        if (pos === undefined)
          return defaultSelection

        const wordStart = extend ? anchor : pos

        pos = skipWhile(editor.document, pos, Backward, true, isBlank)

        if (pos === undefined)
          return defaultSelection

        let ch = editor.document.lineAt(pos).text[pos.character]

        if (isWord(ch))
          pos = skipWhile(editor.document, pos, Backward, true, isWord)
        else if (isPunctuation(ch))
          pos = skipWhile(editor.document, pos, Backward, true, isPunctuation)

        if (pos === undefined)
          return defaultSelection

        selection = new vscode.Selection(wordStart, pos.character === 0 ? pos : pos.translate(0, 1))
      }

      return selection
    })
  })
}

registerToNextWord(Command.selectWord         , false, false, isAlphaWord)
registerToNextWord(Command.selectWordExtend   , true , false, isAlphaWord)
registerToNextWord(Command.selectWordAlt      , false, false, isNonWsWord)
registerToNextWord(Command.selectWordAltExtend, true , false, isNonWsWord)

registerToNextWord(Command.selectWordEnd         , false, true, isAlphaWord)
registerToNextWord(Command.selectWordEndExtend   , true , true, isAlphaWord)
registerToNextWord(Command.selectWordAltEnd      , false, true, isNonWsWord)
registerToNextWord(Command.selectWordAltEndExtend, true , true, isNonWsWord)

registerToPreviousWord(Command.selectWordPrevious         , false, isAlphaWord)
registerToPreviousWord(Command.selectWordPreviousExtend   , true , isAlphaWord)
registerToPreviousWord(Command.selectWordAltPrevious      , false, isNonWsWord)
registerToPreviousWord(Command.selectWordAltPreviousExtend, true , isNonWsWord)


// Line selecting key bindings (x, X, alt+[xX], home, end)
// ===============================================================================================

registerCommand(Command.selectLine, CommandFlags.ChangeSelections, (editor, { currentCount }) => {
  if (currentCount === 0 || currentCount === 1) {
    editor.selections = editor.selections.map(x => {
      const line = editor.document.lineAt(x.active)

      return new vscode.Selection(line.rangeIncludingLineBreak.start, line.rangeIncludingLineBreak.end)
    })
  } else {
    editor.selections = editor.selections.map(x => {
      const line = editor.document.lineAt(Math.min(x.active.line + currentCount - 1, editor.document.lineCount - 1))

      return new vscode.Selection(line.rangeIncludingLineBreak.start, line.rangeIncludingLineBreak.end)
    })
  }
})

registerCommand(Command.selectLineExtend, CommandFlags.ChangeSelections, (editor, { currentCount }) => {
  if (currentCount === 0 || currentCount === 1) {
    editor.selections = editor.selections.map(x => {
      const line = editor.document.lineAt(x.active)

      return new vscode.Selection(x.anchor.with(undefined, 0), line.rangeIncludingLineBreak.end)
    })
  } else {
    editor.selections = editor.selections.map(x => {
      const line = editor.document.lineAt(Math.min(x.active.line + currentCount - 1, editor.document.lineCount - 1))

      return new vscode.Selection(x.anchor.with(undefined, 0), line.rangeIncludingLineBreak.end)
    })
  }
})

registerCommand(Command.selectToLineBegin, CommandFlags.ChangeSelections, editor => {
  editor.selections = editor.selections.map(x => {
    const active = getActiveForExtending(x, Backward)

    return new vscode.Selection(active, new vscode.Position(active.line, 0))
  })
})

registerCommand(Command.selectToLineBeginExtend, CommandFlags.ChangeSelections, editor => {
  editor.selections = editor.selections.map(x => {
    const { anchor, active } = forExtending(x, Backward)

    return new vscode.Selection(anchor, new vscode.Position(active.line, 0))
  })
})

registerCommand(Command.selectToLineEnd, CommandFlags.ChangeSelections, editor => {
  editor.selections = editor.selections.map(x => {
    const active = getActiveForExtending(x, Forward),
          line = editor.document.lineAt(active)

    return new vscode.Selection(active, line.range.end)
  })
})

registerCommand(Command.selectToLineEndExtend, CommandFlags.ChangeSelections, editor => {
  editor.selections = editor.selections.map(x => {
    const { anchor, active } = forExtending(x, Forward),
          line = editor.document.lineAt(active)

    return new vscode.Selection(anchor, line.range.end)
  })
})

registerCommand(Command.expandLines, CommandFlags.ChangeSelections, editor => {
  editor.selections = editor.selections.map(x => {
    const anchorLine = editor.document.lineAt(x.start),
          activeLine = editor.document.lineAt(x.end),
          anchor = anchorLine.range.start,
          active = activeLine.rangeIncludingLineBreak.end

    return x.isReversed && !x.isEmpty
      ? new vscode.Selection(active, anchor)
      : new vscode.Selection(anchor, active)
  })
})

registerCommand(Command.trimLines, CommandFlags.ChangeSelections, editor => {
  editor.selections = editor.selections.map(x => {
    const start = x.start.character === 0 ? x.start : x.start.translate(1, 0)
    const end   = x.end.character === editor.document.lineAt(x.end).range.end.character ? x.end : x.end.translate(-1, 0)

    return x.isReversed ? new vscode.Selection(end, start) : new vscode.Selection(start, end)
  })
})


// Select enclosing (m, M, alt+[mM])
// ===============================================================================================

const enclosingChars = '(){}[]'

function indexOfEnclosingChar(line: string, position = 0) {
  for (let i = position; i < line.length; i++) {
    const ch = line[i]
    const idx = enclosingChars.indexOf(ch)

    if (idx !== -1)
      return i
  }

  return -1
}

function lastIndexOfEnclosingChar(line: string, position = line.length) {
  if (position === 0)
    return -1

  for (let i = position - 1; i >= 0; i--) {
    const ch = line[i]
    const idx = enclosingChars.indexOf(ch)

    if (idx !== -1)
      return i
  }

  return -1
}

function registerToEnclosing(command: Command, extend: boolean, backwards: boolean) {
  registerCommand(command, CommandFlags.ChangeSelections, (editor, state) => {
    editor.selections = editor.selections.map(selection => {
      let line = selection.active.line
      let text = editor.document.lineAt(line).text

      let idx = backwards
        ? lastIndexOfEnclosingChar(text, selection.active.character)
        : indexOfEnclosingChar(text, selection.active.character)

      for (let i = state.currentCount || 1; i > 0; i--) {
        while (idx === -1) {
          // There is no initial match, so we check the surrounding lines

          if (backwards) {
            if (--line === -1)
              return selection // No match
          } else {
            if (++line === editor.document.lineCount)
              return selection // No match
          }

          text = editor.document.lineAt(line).text
          idx = backwards ? lastIndexOfEnclosingChar(text) : indexOfEnclosingChar(text)
        }
      }

      const enclosingChar = text[idx],
            idxOfEnclosingChar = enclosingChars.indexOf(enclosingChar)

      let enclosingCharPos = new vscode.Position(line, idx),
          balance = 0,
          matchingOffset = 0,
          buffer = new TextBuffer(editor.document, enclosingCharPos)

      if (idxOfEnclosingChar & 1) {
        // Odd enclosingChar index <=> enclosingChar is closing character
        //                         <=> we go backwards looking for the opening character
        const opening = enclosingChars[idxOfEnclosingChar - 1]

        for (let i = -1;; i--) {
          const ch = buffer.char(i)

          if (ch === undefined) {
            matchingOffset = i + 1
            break
          } else if (ch === enclosingChar) {
            balance++
          } else if (ch === opening && balance !== 0) {
            balance--
          } else if (ch === opening) {
            matchingOffset = i
            break
          }
        }

        enclosingCharPos = enclosingCharPos.translate(0, 1)

        const anchor = extend
          ? (backwards
              ? (selection.anchor.isBefore(enclosingCharPos) ? enclosingCharPos : selection.anchor)
              : (selection.anchor.isAfter(enclosingCharPos) ? selection.anchor : enclosingCharPos))
          : enclosingCharPos

        return backwards
          ? new vscode.Selection(anchor, buffer.position(matchingOffset)!)
          : new vscode.Selection(buffer.position(matchingOffset)!, anchor)
      } else {
        // Even enclosingChar index <=> enclosingChar is opening character
        //                          <=> we go forwards looking for the closing character
        const closing = enclosingChars[idxOfEnclosingChar + 1]

        for (let i = 1;; i++) {
          const ch = buffer.char(i)

          if (ch === undefined) {
            matchingOffset = i
            break
          } else if (ch === enclosingChar) {
            balance--
          } else if (ch === closing && balance !== 0) {
            balance++
          } else if (ch === closing) {
            matchingOffset = i + 1
            break
          }
        }

        const anchor = extend
          ? (backwards
              ? (selection.anchor.isAfter(enclosingCharPos) ? enclosingCharPos : selection.anchor)
              : (selection.anchor.isBefore(enclosingCharPos) ? selection.anchor : enclosingCharPos))
          : enclosingCharPos

        return backwards
          ? new vscode.Selection(buffer.position(matchingOffset)!, anchor)
          : new vscode.Selection(anchor, buffer.position(matchingOffset)!)
      }
    })
  })
}

registerToEnclosing(Command.selectEnclosing               , false, false)
registerToEnclosing(Command.selectEnclosingExtend         , true , false)
registerToEnclosing(Command.selectEnclosingBackwards      , false, true )
registerToEnclosing(Command.selectEnclosingExtendBackwards, true , true )


// Move up/down (ctrl-[bfud])
// ===============================================================================================

function registerMoveLines(command: Command, direction: 'up' | 'down', extend: boolean, by: string) {
  registerCommand(command, CommandFlags.ChangeSelections, () => {
    return vscode.commands.executeCommand('editorScroll', {
      to: direction,
      by: by,
      revealCursor: true,
      select: extend,
    })
  })
}

registerMoveLines(Command.upPage          , 'up', false, 'page')
registerMoveLines(Command.upPageExtend    , 'up', true , 'page')
registerMoveLines(Command.upHalfPage      , 'up', false, 'halfPage')
registerMoveLines(Command.upHalfPageExtend, 'up', true , 'halfPage')

registerMoveLines(Command.downPage          , 'down', false, 'page')
registerMoveLines(Command.downPageExtend    , 'down', true , 'page')
registerMoveLines(Command.downHalfPage      , 'down', false, 'halfPage')
registerMoveLines(Command.downHalfPageExtend, 'down', true , 'halfPage')


// Other bindings (%)
// ===============================================================================================

registerCommand(Command.selectBuffer, CommandFlags.ChangeSelections, editor => {
  const start = new vscode.Position(0, 0)
  const end   = editor.document.lineAt(editor.document.lineCount - 1).range.end

  editor.selection = new vscode.Selection(start, end)
})
