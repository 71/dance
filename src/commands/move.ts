// Movement: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, InputKind } from '.'

import { TextBuffer } from '../utils/textBuffer'


// Move around (h, j, k, l, H, J, K, L, arrows, shift+arrows)
// ===============================================================================================

// There was initially a single function for all movements;
// this was however changed to make sure the logic was as
// straightforward as possible.

const preferredColumnsPerEditor = new WeakMap<vscode.TextEditor, number[]>()

function moveLeft(editor: vscode.TextEditor, expand: boolean, mult: number) {
  preferredColumnsPerEditor.delete(editor)

  let selections = editor.selections.slice(),
      firstActive = undefined as vscode.Position | undefined

  for (let i = 0; i < selections.length; i++) {
    const selection = selections[i],
          active = editor.document.positionAt(editor.document.offsetAt(selection.active) - mult)

    selections[i] = new vscode.Selection(expand ? selection.anchor : active, active)

    if (firstActive === undefined || firstActive.isAfter(active))
      firstActive = active
  }

  if (selections !== editor.selections) {
    editor.selections = selections
    editor.revealRange(new vscode.Range(firstActive!, firstActive!))
  }
}

function moveRight(editor: vscode.TextEditor, expand: boolean, mult: number) {
  preferredColumnsPerEditor.delete(editor)

  let selections = editor.selections.slice(),
      lastActive = undefined as vscode.Position | undefined

  for (let i = 0; i < selections.length; i++) {
    const selection = selections[i],
          active = editor.document.positionAt(editor.document.offsetAt(selection.active) + mult)

    selections[i] = new vscode.Selection(expand ? selection.anchor : active, active)

    if (lastActive === undefined || lastActive.isBefore(active))
      lastActive = active
  }

  if (selections !== editor.selections) {
    editor.selections = selections
    editor.revealRange(new vscode.Range(lastActive!, lastActive!))
  }
}

function moveUp(editor: vscode.TextEditor, expand: boolean, mult: number) {
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
    const selection = selections[i]
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

  if (selections !== editor.selections) {
    editor.selections = selections
    editor.revealRange(new vscode.Range(firstPosition!, firstPosition!))
  }
}

function moveDown(editor: vscode.TextEditor, expand: boolean, mult: number) {
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
    const selection = selections[i]
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

  if (selections !== editor.selections) {
    editor.selections = selections
    editor.revealRange(new vscode.Range(lastPosition!, lastPosition!))
  }
}

// Move/extend left/down/up/right
registerCommand(Command.left       , CommandFlags.ChangeSelections, (editor, { currentCount }) =>  moveLeft(editor, false, currentCount || 1))
registerCommand(Command.leftExtend , CommandFlags.ChangeSelections, (editor, { currentCount }) =>  moveLeft(editor, true , currentCount || 1))
registerCommand(Command.right      , CommandFlags.ChangeSelections, (editor, { currentCount }) => moveRight(editor, false, currentCount || 1))
registerCommand(Command.rightExtend, CommandFlags.ChangeSelections, (editor, { currentCount }) => moveRight(editor, true , currentCount || 1))
registerCommand(Command.up         , CommandFlags.ChangeSelections, (editor, { currentCount }) =>    moveUp(editor, false, currentCount || 1))
registerCommand(Command.upExtend   , CommandFlags.ChangeSelections, (editor, { currentCount }) =>    moveUp(editor, true , currentCount || 1))
registerCommand(Command.down       , CommandFlags.ChangeSelections, (editor, { currentCount }) =>  moveDown(editor, false, currentCount || 1))
registerCommand(Command.downExtend , CommandFlags.ChangeSelections, (editor, { currentCount }) =>  moveDown(editor, true , currentCount || 1))


// Move / extend to character (f, t, F, T, Alt+[ft], Alt+[FT])
// ===============================================================================================

function registerSelectTo(commandName: Command, diff: number, extend: boolean, backwards: boolean) {
  registerCommand(commandName, CommandFlags.ChangeSelections, InputKind.Key, undefined, async (editor, { currentCount, input: key }) => {
    editor.selections = editor.selections.map(selection => {
      let line = selection.active.line
      let idx = backwards
        ? editor.document.lineAt(line).text.lastIndexOf(key, selection.active.character - 1 - diff)
        : editor.document.lineAt(line).text.indexOf(key, selection.active.character + 1 - diff)

      for (let i = currentCount || 1; i > 0; i--) {
        while (idx === -1) {
          // There is no initial match, so we check the surrounding lines

          if (backwards) {
            if (--line === -1)
              return selection // No match
          } else {
            if (++line === editor.document.lineCount)
              return selection // No match
          }

          const { text } = editor.document.lineAt(line)

          idx = backwards ? text.lastIndexOf(key) : text.indexOf(key)
        }
      }

      return new vscode.Selection(extend ? selection.anchor : selection.active, new vscode.Position(line, idx + diff))
    })
  })
}

registerSelectTo(Command.selectToIncluded      , 1, false, false)
registerSelectTo(Command.selectToIncludedExtend, 1, true , false)
registerSelectTo(Command.selectToExcluded      , 0, false, false)
registerSelectTo(Command.selectToExcludedExtend, 0, true , false)

registerSelectTo(Command.selectToIncludedBackwards      , 0, false, true )
registerSelectTo(Command.selectToIncludedExtendBackwards, 0, true , true )
registerSelectTo(Command.selectToExcludedBackwards      , 1, false, true )
registerSelectTo(Command.selectToExcludedExtendBackwards, 1, true , true )


// Move / extend to word begin / end (w, b, e, W, B, E, alt+[wbe], alt+[WBE])
// ===============================================================================================

function isPunctuation(c: string) {
  return !isAlphaWord(c) && !isBlank(c)
}

function isAlphaWord(c: string) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || (c === '_') || (c === '-')
}

function isNonWsWord(c: string) {
  return c != ' ' && c != '\t'
}

function isBlank(c: string) {
  return c == ' ' || c == '\t'
}

function skipWhile(document: vscode.TextDocument, pos: vscode.Position, backwards: boolean, cond: (c: string) => boolean) {
  const diff = backwards ? -1 : 1

  let { line } = pos

  while (line >= 0 && line < document.lineCount) {
    let { text } = document.lineAt(line)
    let character = line === pos.line
      ? (backwards ? pos.character - 1 : pos.character)
      : (backwards ? text.length - 1   : 0)

    while (character >= 0 && character < text.length) {
      if (!cond(text[character]))
        return new vscode.Position(line, character)

      character += diff
    }

    line += diff
  }

  return undefined
}

function skipEmptyLines(document: vscode.TextDocument, pos: vscode.Position, backwards: boolean) {
  let { line } = pos

  if (!document.lineAt(line).isEmptyOrWhitespace)
    return pos

  let lineInfo: vscode.TextLine

  while ((lineInfo = document.lineAt(line)).isEmptyOrWhitespace) {
    if (backwards) {
      if (line-- === 0)
        return undefined
    } else {
      if (++line === document.lineCount)
        return undefined
    }
  }

  return backwards ? lineInfo.range.end : lineInfo.range.start
}


function registerToNextWord(commandName: Command, extend: boolean, end: boolean, isWord: (c: string) => boolean) {
  registerCommand(commandName, CommandFlags.ChangeSelections, (editor, state) => {
    editor.selections = editor.selections.map(selection => {
      const anchor = extend ? selection.anchor : selection.active,
            endPosition = editor.document.lineAt(editor.document.lineCount - 1).rangeIncludingLineBreak.end,
            defaultSelection = new vscode.Selection(anchor, endPosition)

      for (let i = state.currentCount || 1; i > 0; i--) {
        let pos = skipEmptyLines(editor.document, selection.active, false)

        if (pos === undefined)
          return defaultSelection

        if (end) {
          pos = skipWhile(editor.document, pos, false, isBlank)

          if (pos === undefined)
            return defaultSelection
        }

        let ch = editor.document.lineAt(pos).text[pos.character]

        if (isWord(ch))
          pos = skipWhile(editor.document, pos, false, isWord)
        else if (isPunctuation(ch))
          pos = skipWhile(editor.document, pos, false, isPunctuation)

        if (pos === undefined)
          return defaultSelection

        if (!end) {
          pos = skipWhile(editor.document, pos, false, isBlank)

          if (pos === undefined)
            return defaultSelection
        }

        selection = new vscode.Selection(anchor, pos)
      }

      return selection
    })
  })
}

function registerToPreviousWord(commandName: Command, extend: boolean, isWord: (c: string) => boolean) {
  registerCommand(commandName, CommandFlags.ChangeSelections, (editor, state) => {
    editor.selections = editor.selections.map(selection => {
      const anchor = extend ? selection.anchor : selection.active,
            startPosition = new vscode.Position(0, 0),
            defaultSelection = new vscode.Selection(anchor, startPosition)

      for (let i = state.currentCount || 1; i > 0; i--) {
        let pos = skipEmptyLines(editor.document, selection.active, true)

        if (pos === undefined)
          return defaultSelection

        pos = skipWhile(editor.document, pos, true, isBlank)

        if (pos === undefined)
          return defaultSelection

        let ch = editor.document.lineAt(pos).text[pos.character]

        if (isWord(ch))
          pos = skipWhile(editor.document, pos, true, isWord)
        else if (isPunctuation(ch))
          pos = skipWhile(editor.document, pos, true, isPunctuation)

        if (pos === undefined)
          return defaultSelection

        selection = new vscode.Selection(anchor, pos.translate(0, 1))
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
    return new vscode.Selection(x.active, new vscode.Position(x.active.line, 0))
  })
})

registerCommand(Command.selectToLineBeginExtend, CommandFlags.ChangeSelections, editor => {
  editor.selections = editor.selections.map(x => {
    return new vscode.Selection(x.anchor, new vscode.Position(x.active.line, 0))
  })
})

registerCommand(Command.selectToLineEnd, CommandFlags.ChangeSelections, editor => {
  editor.selections = editor.selections.map(x => {
    const line = editor.document.lineAt(x.active)

    return new vscode.Selection(x.active, line.range.end)
  })
})

registerCommand(Command.selectToLineEndExtend, CommandFlags.ChangeSelections, editor => {
  editor.selections = editor.selections.map(x => {
    const line = editor.document.lineAt(x.active)

    return new vscode.Selection(x.anchor, line.range.end)
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
    const start = x.start.character == 0 ? x.start : x.start.translate(1, 0)
    const end   = x.end.character == editor.document.lineAt(x.end).range.end.character ? x.end : x.end.translate(-1, 0)

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


// Other bindings (%)
// ===============================================================================================

registerCommand(Command.selectBuffer, CommandFlags.ChangeSelections, editor => {
  const start = new vscode.Position(0, 0)
  const end   = editor.document.lineAt(editor.document.lineCount - 1).range.end

  editor.selection = new vscode.Selection(start, end)
})
