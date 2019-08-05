// Movement: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode               from 'vscode'
import { Selection, TextEditor } from 'vscode'

import { registerCommand, Command, CommandFlags, CommandState, InputKind } from '.'
import { TextBuffer } from '../utils/textBuffer'


function registerMovement(cmd: Command, modifier: (selection: Selection, editor: TextEditor, state: CommandState<InputKind.None>) => Selection) {
  registerCommand(cmd, CommandFlags.ChangeSelections, (editor, state) => {
    editor.selections = editor.selections.map(s => modifier(s, editor, state))
  })
}


// Move around (h, j, k, l, H, J, K, L, arrows, shift+arrows)
// ===============================================================================================

function translate(lineDelta: number, charDelta: number, position: vscode.Position, editor: vscode.TextEditor) {
  if (lineDelta ===  1 && position.line === editor.document.lineCount) lineDelta = 0
  else if (lineDelta === -1 && position.line === 0) lineDelta = 0

  const line = editor.document.lineAt(position.line)

  if (charDelta ===  1 && position.character === line.text.length) charDelta = 0
  else if (charDelta === -1 && position.character === 0) charDelta = 0

  return position.translate(lineDelta, charDelta)
}

const simpleMovements: [Command, number, number][] = [
  [Command.left ,  0, -1],
  [Command.down ,  1,  0],
  [Command.up   , -1,  0],
  [Command.right,  0,  1],
]

for (const [command, lineDelta, charDelta] of simpleMovements) {
  // Move left / down / up / right
  registerMovement(command, (selection, editor, state) => {
    const mult = state.currentCount || 1

    const anchor = translate(lineDelta * mult, charDelta * mult, selection.anchor, editor)
    const active = translate(lineDelta * mult, charDelta * mult, selection.active, editor)

    return new Selection(anchor, active)
  })

  // Extend left / down / up / right
  registerMovement(command + '.extend' as Command, (selection, editor, state) => {
    const mult = state.currentCount || 1

    return new Selection(selection.anchor, translate(lineDelta * mult, charDelta * mult, selection.active, editor))
  })
}


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

      return new Selection(extend ? selection.anchor : selection.active, new vscode.Position(line, idx + diff))
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

registerCommand(Command.selectLine, CommandFlags.ChangeSelections, editor => {
  editor.selections = editor.selections.map(x => {
    const line = editor.document.lineAt(x.active)

    return new vscode.Selection(line.rangeIncludingLineBreak.start, line.rangeIncludingLineBreak.end)
  })
})

registerCommand(Command.selectLineExtend, CommandFlags.ChangeSelections, editor => {
  editor.selections = editor.selections.map(x => {
    const line = editor.document.lineAt(x.active)

    return new vscode.Selection(x.anchor, line.rangeIncludingLineBreak.end)
  })
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
    const anchorLine = editor.document.lineAt(x.anchor)
    const activeLine = editor.document.lineAt(x.active)

    return new vscode.Selection(anchorLine.range.start, activeLine.rangeIncludingLineBreak.end)
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
