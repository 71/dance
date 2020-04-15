// Search: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#searching
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, InputKind } from '.'

import { Extension, CharSet } from '../extension'
import { WritableRegister }   from '../registers'
import { Direction, ExtendBehavior, Backward, Forward, DoNotExtend, Extend, Selection, Position, SelectionSet } from '../utils/selections'


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

function moveForwardBy(position: Position, offset: number, text: string, add = 0) {
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

  position.updateForNewPositionFast(position.offset + offset, new vscode.Position(line, character))
}

function moveBackwardBy(position: Position, offset: number, text: string, add = 0) {
  let { line, character } = position

  for (let i = text.length - 1; i >= offset; i--) {
    const ch = text[i + add]

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

  position.updateForNewPositionFast(position.offset - offset, new vscode.Position(line, character - 1))
}

// TODO: Should search strings be limited to the range between the current selection
// and the previous/next selection, or only to the bounds of the document?

function search(selection: Selection, start: Position, regex: RegExp, allowWrap: boolean): boolean {
  const document = selection.document

  if (regex.multiline) {
    const text = document.getText(document.lineAt(document.lineCount - 1).range.with(start.asPosition()))
    const match = regex.exec(text)

    if (match !== null) {
      selection.anchor.inheritPosition(start)
      moveForwardBy(selection.anchor, match.index, text)

      selection.active.inheritPosition(selection.anchor)
      moveForwardBy(selection.active, match[0].length, text, match.index)

      return true
    }
  } else {
    {
      // Custom processing for first line.
      const line = document.lineAt(start.line),
            match = regex.exec(line.text.substr(start.character))

      if (match !== null) {
        const length = match[0].length

        selection.anchor.updateForNewPosition(new vscode.Position(start.line, start.character + match.index))
        selection.active.inheritPosition(selection.anchor)
        selection.active.updateForNewPositionFast(selection.anchor.offset + length, selection.anchor.asPosition().translate(0, length))

        return true
      }
    }

    for (let line = start.line + 1; line < document.lineCount; line++) {
      const textLine = document.lineAt(line),
            match = regex.exec(textLine.text)

      if (match === null)
        continue

      const length = match[0].length

      selection.anchor.updateForNewPosition(new vscode.Position(line, match.index))
      selection.active.inheritPosition(selection.anchor)
      selection.active.updateForNewPositionFast(selection.anchor.offset + length, selection.anchor.asPosition().translate(0, length))

      return true
    }
  }

  if (!allowWrap)
    return false

  selection.active.toDocumentStart()
  selection.anchor.inheritPosition(selection.active)

  return search(selection, start, regex, false)
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

function searchBackward(selection: Selection, end: Position, regex: RegExp, allowWrap: boolean): boolean {
  const document = selection.document

  if (regex.multiline) {
    const text = document.getText(new vscode.Range(new vscode.Position(0, 0), end.asPosition()))
    const match = execFromEnd(regex, text)

    if (match !== null) {
      selection.anchor.inheritPosition(end)
      moveBackwardBy(selection.anchor, match.index, text)

      selection.active.inheritPosition(selection.anchor)
      moveBackwardBy(selection.active, match[0].length, text, match.index)

      return true
    }
  } else {
    {
      // Custom processing for first line.
      const line = document.lineAt(end.line),
            match = execFromEnd(regex, line.text.substr(0, end.character))

      if (match !== null) {
        const length = match[0].length

        selection.anchor.updateForNewPosition(new vscode.Position(end.line, match.index))
        selection.active.inheritPosition(selection.anchor)
        selection.active.updateForNewPositionFast(selection.anchor.offset + length, selection.anchor.asPosition().translate(0, length))

        return true

      }
    }

    for (let line = end.line - 1; line >= 0; line--) {
      const textLine = document.lineAt(line),
            match = execFromEnd(regex, textLine.text)

      if (match === null)
        continue

      const length = match[0].length

      selection.anchor.updateForNewPosition(new vscode.Position(line, match.index))
      selection.active.inheritPosition(selection.anchor)
      selection.active.updateForNewPositionFast(selection.anchor.offset + length, selection.anchor.asPosition().translate(0, length))

      return true
    }
  }

  if (!allowWrap)
    return false

  selection.active.toDocumentEnd()
  selection.anchor.inheritPosition(selection.active)

  return searchBackward(selection, end, regex, false)
}

function registerSearchCommand(command: Command, direction: Direction, extend: ExtendBehavior) {
  let initialSelections: SelectionSet.Copy,
      register: WritableRegister

  registerCommand(command, CommandFlags.ChangeSelections, InputKind.Text, {
    prompt: 'Search RegExp',

    setup(_, selections, state) {
      initialSelections = selections.copy()

      const targetRegister = state.currentRegister

      if (targetRegister === undefined || !targetRegister.canWrite())
        register = state.registers.slash
      else
        targetRegister
    },

    validateInput(input: string) {
      const selections = initialSelections.original

      selections.restore(initialSelections)

      if (input.length === 0)
        return 'RegExp cannot be empty.'

      const editor = vscode.window.activeTextEditor!

      let regex: RegExp
      let flags = (isMultilineRegExp(input) ? 'm' : '') + (direction === Backward ? 'g' : '')

      try {
        regex = new RegExp(input, flags)
      } catch {
        return 'Invalid ECMA RegExp.'
      }

      register.set(editor, [input])

      // TODO: For subsequent searches, first try to match at start of previous
      // match by adding a ^, and then fallback to the default search routine
      if (extend) {
        if (direction === Backward)
          selections.updateEach(editor, selection => {
            const endSave = selection.end.save()
            const found = searchBackward(selection, selection.anchor, regex, true)

            if (found) {
              selection.active.restore(endSave)
            }
          })
        else
          selections.updateEach(editor, selection => {
            const startSave = selection.start.save()
            const found = search(selection, selection.active, regex, true)

            if (found) {
              selection.anchor.restore(startSave)
            }
          })
      } else {
        if (direction === Backward) {
          selections.updateEach(editor, selection => searchBackward(selection, selection.anchor, regex, true))
        } else {
          selections.updateEach(editor, selection => search(selection, selection.active, regex, true))
        }
      }

      selections.commit(editor)
      editor.revealRange(editor.selection)

      return undefined
    },
  }, () => {
    initialSelections.forget()
  })
}

registerSearchCommand(Command.search               , Forward , DoNotExtend)
registerSearchCommand(Command.searchBackwards      , Backward, DoNotExtend)
registerSearchCommand(Command.searchExtend         , Forward , Extend)
registerSearchCommand(Command.searchBackwardsExtend, Backward, Extend)

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

function escapeRegExp(str: string) {
  // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

registerCommand(Command.searchSelection, CommandFlags.ChangeSelections, (editor, _, __, state) => {
  let text = escapeRegExp(editor.document.getText(editor.selection))

  return setSearchSelection(text, editor, state)
})

registerCommand(Command.searchSelectionSmart, CommandFlags.ChangeSelections, (editor, _, __, state) => {
  const isWord = state.getCharSetFunction(CharSet.Word, editor.document)

  let text = escapeRegExp(editor.document.getText(editor.selection)),
      firstLine = editor.document.lineAt(editor.selection.start).text,
      firstLineStart = editor.selection.start.character

  if (firstLineStart === 0 || !isWord(firstLine.charCodeAt(firstLineStart - 1))) {
    text = `\\b${text}`
  }

  let lastLine = editor.document.lineAt(editor.selection.end).text,
      lastLineEnd = editor.selection.end.character

  if (lastLineEnd >= lastLine.length || !isWord(lastLine.charCodeAt(lastLineEnd))) {
    text = `${text}\\b`
  }

  return setSearchSelection(text, editor, state)
})

function registerNextCommand(command: Command, direction: Direction, replace: boolean) {
  registerCommand(command, CommandFlags.ChangeSelections, async (editor, { currentRegister, selectionSet: selections }, _, state) => {
    const regexStr = await (currentRegister ?? state.registers.slash).get(editor)

    if (regexStr === undefined || regexStr.length === 0)
      return

    const regex = new RegExp(regexStr[0], 'g')
    const selection = replace ? selections.selections[0] : selections.selections[0].copy(selections)
    const found = direction === Backward
      ? searchBackward(selection, selection.anchor, regex, true)
      : search(selection, selection.anchor, regex, true)

    if (found && !replace)
      selections.updateAll(editor, selections => selections.unshift(selection))
  })
}

registerNextCommand(Command.searchNext       , Forward , true )
registerNextCommand(Command.searchNextAdd    , Forward , false)
registerNextCommand(Command.searchPrevious   , Backward, true )
registerNextCommand(Command.searchPreviousAdd, Backward, false)
