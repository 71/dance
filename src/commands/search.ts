// Search: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#searching
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, InputKind } from '.'

import { Extension }        from '../extension'
import { WritableRegister } from '../registers'


function isMultilineRegExp(regex: string) {
  const len = regex.length
  let negate = false

  for (let i = 0; i < len; i++) {
    const ch = regex[i]

    if (negate) {
      if (ch === ']') {
        negate = false
      } else if (ch === '\\') {
        if (regex[i + 1] === 'S')
          return true

        i++ // Ignore next character
      } else {
        continue
      }
    } else if (ch === '[' && regex[i + 1] === '^') {
      negate = true
      i++
    } else if (ch === '\\') {
      if (regex[i + 1] === 's' || regex[i + 1] === 'n')
        return true

      i++ // Ignore next character
    } else if (ch === '$' && i < len - 1) {
      return true
    }
  }

  return false
}

function findPosition(text: string, position: vscode.Position, offset: number, add = 0) {
  let { line, character } = position

  for (let i = 0; i < offset; i++) {
    const ch = text[i + add]

    if (ch === '\n') {
      line++
      character = 0
    } else if (ch === '\r') {
      line++
      character = 0
      i++
    } else {
      character++
    }
  }

  return new vscode.Position(line, character)
}

function findPositionBackward(text: string, position: vscode.Position, offset: number) {
  let { line, character } = position

  for (let i = text.length - 1; i >= offset; i--) {
    const ch = text[i]

    if (ch === '\n') {
      line--
      character = 0
    } else if (ch === '\r') {
      line--
      character = 0
      i--
    } else {
      character--
    }
  }

  if (line !== position.line) {
    // The 'character' is actually the number of characters until the end of the line,
    // so we have to find the start of the current line and do a diff
    let startOfLine = text.lastIndexOf('\n', offset)

    if (startOfLine === -1)
      startOfLine = 0

    character = offset - startOfLine
  }

  return new vscode.Position(line, character - 1)
}

// TODO: Should search strings be limited to the range between the current selection
// and the previous/next selection, or only to the bounds of the document?

function search(document: vscode.TextDocument, start: vscode.Position, regex: RegExp, allowWrap: boolean): vscode.Selection | undefined {
  if (regex.multiline) {
    const text = document.getText(document.lineAt(document.lineCount - 1).range.with(start))
    const match = regex.exec(text)

    if (match === null)
      return allowWrap ? search(document, new vscode.Position(0, 0), regex, false) : undefined

    const startPos = findPosition(text, start, match.index),
          endPos = findPosition(text, startPos, match[0].length, match.index)

    return new vscode.Selection(startPos, endPos)
  } else {
    {
      // Custom processing for first line
      const line = document.lineAt(start.line),
            match = regex.exec(line.text.substr(start.character))

      if (match !== null)
        return new vscode.Selection(
          new vscode.Position(start.line, start.character + match.index),
          new vscode.Position(start.line, start.character + match.index + match[0].length),
        )
    }

    for (let i = start.line + 1; i < document.lineCount; i++) {
      const line = document.lineAt(i),
            match = regex.exec(line.text)

      if (match === null)
        continue

      return new vscode.Selection(
        new vscode.Position(i, match.index),
        new vscode.Position(i, match.index + match[0].length),
      )
    }

    return allowWrap ? search(document, new vscode.Position(0, 0), regex, false) : undefined
  }
}

function execFromEnd(regex: RegExp, input: string) {
  let match = regex.exec(input)

  if (match === null || match[0].length === 0)
    return null

  for (;;) {
    const newMatch = regex.exec(input)

    if (newMatch === null)
      return match
    if (newMatch[0].length === 0)
      return null

    match = newMatch
  }
}

function searchBackward(document: vscode.TextDocument, end: vscode.Position, regex: RegExp, allowWrap: boolean): vscode.Selection | undefined {
  if (regex.multiline) {
    const text = document.getText(new vscode.Range(new vscode.Position(0, 0), end))
    const match = execFromEnd(regex, text)

    if (match === null)
      return allowWrap ? searchBackward(document, new vscode.Position(document.lineCount - 1, 10000), regex, false) : undefined

    const startPos = findPositionBackward(text, end, match.index),
          endPos = findPosition(text, startPos, match[0].length, match.index)

    return new vscode.Selection(startPos, endPos)
  } else {
    {
      // Custom processing for first line
      const line = document.lineAt(end.line),
            match = execFromEnd(regex, line.text.substr(0, end.character))

      if (match !== null)
        return new vscode.Selection(
          new vscode.Position(end.line, match.index),
          new vscode.Position(end.line, match.index + match[0].length),
        )
    }

    for (let i = end.line - 1; i >= 0; i--) {
      const line = document.lineAt(i),
            match = execFromEnd(regex, line.text)

      if (match === null)
        continue

      return new vscode.Selection(
        new vscode.Position(i, match.index),
        new vscode.Position(i, match.index + match[0].length),
      )
    }

    return allowWrap ? searchBackward(document, new vscode.Position(document.lineCount - 1, 10000), regex, false) : undefined
  }
}

function registerSearchCommand(command: Command, backward: boolean, extend: boolean) {
  let initialSelections: vscode.Selection[],
      register: WritableRegister

  registerCommand(command, CommandFlags.ChangeSelections, InputKind.Text, {
    prompt: 'Search RegExp',

    setup(editor, state) {
      initialSelections = editor.selections

      const targetRegister = state.currentRegister

      if (targetRegister === undefined || !targetRegister.canWrite())
        register = state.registers.slash
      else
        targetRegister
    },

    validateInput(input) {
      if (input.length === 0)
        return 'RegExp cannot be empty.'

      const editor = vscode.window.activeTextEditor!

      let regex: RegExp
      let flags = (isMultilineRegExp(input) ? 'm' : '') + (backward ? 'g' : '')

      try {
        regex = new RegExp(input, flags)
      } catch {
        return 'Invalid ECMA RegExp.'
      }

      register.set(editor, [input])

      // TODO: For subsequent searches, first try to match at start of previous
      // match by adding a ^, and then fallback to the default search routine
      if (extend) {
        if (backward)
          editor.selections = initialSelections.map(selection => {
            const newSelection = searchBackward(editor.document, selection.anchor, regex, false)

            return newSelection === undefined
              ? selection
              : new vscode.Selection(newSelection.start, selection.end)
          })
        else
          editor.selections = initialSelections.map(selection => {
            const newSelection = search(editor.document, selection.active, regex, false)

            return newSelection === undefined
              ? selection
              : new vscode.Selection(selection.start, newSelection.end)
          })
      } else {
        editor.selections = initialSelections.map(selection => {
          return (backward
            ? searchBackward(editor.document, selection.anchor, regex, false)
            : search(editor.document, selection.active, regex, false))
          || selection
        })
      }

      editor.revealRange(editor.selection)

      return undefined
    }
  }, () => {})
}

registerSearchCommand(Command.search               , false, false)
registerSearchCommand(Command.searchBackwards      , true , false)
registerSearchCommand(Command.searchExtend         , false, true )
registerSearchCommand(Command.searchBackwardsExtend, true , true )

function setSearchSelection(source: string, editor: vscode.TextEditor, state: Extension) {
  try {
    new RegExp(source, 'g')
  } catch {
    return vscode.window.showErrorMessage('Invalid ECMA RegExp.').then(() => {})
  }

  let register = state.currentRegister

  if (register === undefined || !register.canWrite())
    state.registers.slash.set(editor, [source])
  else
    register.set(editor, [source])

  return
}

registerCommand(Command.searchSelection, CommandFlags.ChangeSelections, (editor, _, __, state) => {
  return setSearchSelection(editor.document.getText(editor.selection), editor, state)
})

function isSmartSelectionPart(char: string) {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9')
}

function escapeRegExp(str: string) {
  // TODO: improve that
  return str.replace('/', '\\/')
}

registerCommand(Command.searchSelectionSmart, CommandFlags.ChangeSelections, (editor, _, __, state) => {
  let text = escapeRegExp(editor.document.getText(editor.selection)),
      firstLine = editor.document.lineAt(editor.selection.start).text,
      firstLineStart = editor.selection.start.character

  if (firstLineStart === 0 || !isSmartSelectionPart(firstLine[firstLineStart - 1])) {
    text = `\\b${text}`
  }

  let lastLine = editor.document.lineAt(editor.selection.end).text,
      lastLineEnd = editor.selection.end.character

  if (lastLineEnd >= lastLine.length || !isSmartSelectionPart(lastLine[lastLineEnd])) {
    text = `${text}\\b`
  }

  return setSearchSelection(text, editor, state)
})

function registerNextCommand(command: Command, backward: boolean, replace: boolean) {
  registerCommand(command, CommandFlags.ChangeSelections, async (editor, { currentRegister }, _, state) => {
    const regexStr = await (currentRegister || state.registers.slash).get(editor)

    if (regexStr === undefined || regexStr.length === 0)
      return

    const regex = new RegExp(regexStr[0], 'g')
    const next = backward
      ? searchBackward(editor.document, editor.selection.anchor, regex, true)
      : search(editor.document, editor.selection.active, regex, true)

    if (next === undefined)
      return

    editor.selections = [next, ...editor.selections.slice(replace ? 1 : 0)]
  })
}

registerNextCommand(Command.searchNext       , false, true )
registerNextCommand(Command.searchNextAdd    , false, false)
registerNextCommand(Command.searchPrevious   , true , true )
registerNextCommand(Command.searchPreviousAdd, true , false)
