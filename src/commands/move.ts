// Movement: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode               from 'vscode'
import { Selection, TextEditor } from 'vscode'

import { keypress, registerCommand, Command } from '.'
import { Extension } from '../extension'


// Yes, this looks like a decorator. Yes, it's supposed to be one.
// Yes, I'm hoping that TypeScript will one day consider this a bug,
// and fix the current behavior, which causes an error.
function registerMovement(cmd: Command, modifier: (selection: Selection, editor: TextEditor, state: Extension) => Selection) {
  registerCommand(cmd, (editor, state) => {
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
  registerCommand(commandName, async (editor, state) => {
    const key = await keypress()

    editor.selections = editor.selections.map(selection => {
      let line = selection.active.line
      let idx = backwards
        ? editor.document.lineAt(line).text.lastIndexOf(key, selection.active.character - 1 - diff)
        : editor.document.lineAt(line).text.indexOf(key, selection.active.character + 1 - diff)

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
  registerCommand(commandName, (editor, state) => {
    editor.selections = editor.selections.map(selection => {
      const anchor = extend ? selection.anchor : selection.active

      for (let i = state.currentCount || 1; i > 0; i--) {
        let pos = skipEmptyLines(editor.document, selection.active, false)

        if (pos === undefined)
          return selection

        if (end) {
          pos = skipWhile(editor.document, pos, false, isBlank)

          if (pos === undefined)
            return selection
        }

        let ch = editor.document.lineAt(pos).text[pos.character]

        if (isWord(ch))
          pos = skipWhile(editor.document, pos, false, isWord)
        else if (isPunctuation(ch))
          pos = skipWhile(editor.document, pos, false, isPunctuation)

        if (pos === undefined)
          return selection

        if (!end) {
          pos = skipWhile(editor.document, pos, false, isBlank)

          if (pos === undefined)
            return selection
        }

        selection = new vscode.Selection(anchor, pos)
      }

      return selection
    })
  })
}

function registerToPreviousWord(commandName: Command, extend: boolean, isWord: (c: string) => boolean) {
  registerCommand(commandName, (editor, state) => {
    editor.selections = editor.selections.map(selection => {
      const anchor = extend ? selection.anchor : selection.active

      for (let i = state.currentCount || 1; i > 0; i--) {
        let pos = skipEmptyLines(editor.document, selection.active, true)

        if (pos === undefined)
          return selection

        pos = skipWhile(editor.document, pos, true, isBlank)

        if (pos === undefined)
          return selection

        let ch = editor.document.lineAt(pos).text[pos.character]

        if (isWord(ch))
          pos = skipWhile(editor.document, pos, true, isWord)
        else if (isPunctuation(ch))
          pos = skipWhile(editor.document, pos, true, isPunctuation)

        if (pos === undefined)
          return selection

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


// Line selecting key bindings (x, X, alt+[xX])
// ===============================================================================================

registerCommand(Command.selectLine, editor => {
  editor.selections = editor.selections.map(x => {
    const line = editor.document.lineAt(x.active)

    return new vscode.Selection(line.range.start, line.range.end)
  })
})

registerCommand(Command.selectLineExtend, editor => {
  editor.selections = editor.selections.map(x => {
    const line = editor.document.lineAt(x.active)

    return new vscode.Selection(x.anchor, line.range.end)
  })
})

registerCommand(Command.expandLines, editor => {
  editor.selections = editor.selections.map(x => {
    const anchorLine = editor.document.lineAt(x.anchor)
    const activeLine = editor.document.lineAt(x.active)

    return new vscode.Selection(anchorLine.range.start, activeLine.range.end)
  })
})

registerCommand(Command.trimLines, editor => {
  editor.selections = editor.selections.map(x => {
    const start = x.start.character == 0 ? x.start : x.start.translate(1, 0)
    const end   = x.end.character == editor.document.lineAt(x.end).range.end.character ? x.end : x.end.translate(-1, 0)

    return x.isReversed ? new vscode.Selection(end, start) : new vscode.Selection(start, end)
  })
})


// Other bindings (%)
// ===============================================================================================

registerCommand(Command.selectBuffer, editor => {
  const start = new vscode.Position(0, 0)
  const end   = editor.document.lineAt(editor.document.lineCount - 1).range.end

  editor.selection = new vscode.Selection(start, end)
})
