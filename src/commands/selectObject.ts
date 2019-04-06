// Objects: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#object-selection
import * as vscode from 'vscode'

import { promptInList, registerCommand, Command } from '.'
import { TextBuffer }                             from '../utils/textBuffer'


function promptObjectType() {
  return promptInList(false,
    ['b, (, )', 'Select to enclosing parenthesis'],
    ['B, {, }', 'Select to enclosing brackets'],
    ['r, [, ]', 'Select to enclosing square brackets'],
    ['a, <, >', 'Select to enclosing angle brackets'],
    ['Q, "'   , 'Select to enclosing double quotes'],
    ['q, \''  , 'Select enclosing single quotes'],
    ['g, `'   , 'Select to enclosing grave quotes'],
    ['w'      , 'Select word'],
    ['W'      , 'Select non-whitespace word'],
    ['s'      , 'Select sentence'],
    ['p'      , 'Select paragraph'],
    [' '      , 'Select whitespaces'],
    ['i'      , 'Select current indentation block'],
    ['n'      , 'Select number'],
    ['u'      , 'Select the argument'],
    ['c'      , 'Select custom object'],
  )
}


// Selecting is a bit harder than it sounds like:
// 1. Dealing with multiple lines, whether forwards or backwards, is a bit of a pain.
// 2. Dealing with strings is a bit of a pain
// 3. Dealing with inner objects is a bit of a pain

let lastObjectSelectOperation: [boolean, number, boolean, boolean, boolean] | undefined

function findPairObject(text: TextBuffer, reverse: boolean, start: string, end: string, inner: boolean): vscode.Position | undefined {
  let balance = start === end ? -1 : reverse ? -1 : 1
  let diff = reverse ? -1 : 1

  for (let i = balance, c = text.char(i); c !== undefined; c = text.char(i += diff)) {
    if (c === start) {
      if (text.char(i - 1) === '\\')
        continue

      balance++
    } else if (c === end) {
      if (text.char(i - 1) === '\\')
        continue

      balance--
    } else {
      continue
    }

    if (balance === 0) {
      if (inner !== reverse)
        return text.position(i)
      else
        return text.position(i + 1)
    }
  }

  return undefined
}

function findObjectStart(text: TextBuffer, type: number, inner: boolean): vscode.Position | undefined {
  switch (type) {
    case 0: // Parentheses
      return findPairObject(text, true, '(', ')', inner)

    case 1: // Brackets
      return findPairObject(text, true, '{', '}', inner)

    case 2: // Squared brackets
      return findPairObject(text, true, '[', ']', inner)

    case 3: // Angle brackets
      return findPairObject(text, true, '<', '>', inner)

    case 4: // Double quotes
      return findPairObject(text, true, '"', '"', inner)

    case 5: // Single quotes
      return findPairObject(text, true, "'", "'", inner)

    case 6: // Grave quotes
      return findPairObject(text, true, '`', '`', inner)
  }

  for (let i = -1, c = text.char(i); c !== undefined; c = text.char(--i)) {
    switch (type) {
      case 7: // Word
        break

      case 8: // Non-whitespace word
        break

      case 9: // Sentence
        break

      case 10: // Paragraph
        break

      case 11: // Whitespaces
        break

      case 12: // Indentation block
        break

      case 13: // Number
        break

      case 14: // Argument
        break

      case 15: // Custom
        break
    }
  }

  return undefined
}

function findObjectEnd(text: TextBuffer, type: number, inner: boolean): vscode.Position | undefined {
  switch (type) {
    case 0: // Parentheses
      return findPairObject(text, false, '(', ')', inner)

    case 1: // Brackets
      return findPairObject(text, false, '{', '}', inner)

    case 2: // Squared brackets
      return findPairObject(text, false, '[', ']', inner)

    case 3: // Angle brackets
      return findPairObject(text, false, '<', '>', inner)

    case 4: // Double quotes
      return findPairObject(text, false, '"', '"', inner)

    case 5: // Single quotes
      return findPairObject(text, false, "'", "'", inner)

    case 6: // Grave quotes
      return findPairObject(text, false, '`', '`', inner)
  }

  for (let i = 1, c = text.char(i); c !== undefined; c = text.char(++i)) {

  }

  return undefined
}

function performObjectSelect(editor: vscode.TextEditor, count: number, inner: boolean, type: number, extend: boolean, toStart: boolean, toEnd: boolean) {
  lastObjectSelectOperation = [inner, type, extend, toStart, toEnd]

  editor.selections = editor.selections.map(selection => {
    let start = selection.start
    let end = selection.end

    for (let i = 0; i < count; i++) {
      if (toStart) {
        const buf = new TextBuffer(editor.document, start)
        const r = findObjectStart(buf, type, inner)

        if (r === undefined)
          break

        start = r
      }

      if (toEnd) {
        const buf = new TextBuffer(editor.document, end)
        const r = findObjectEnd(buf, type, inner)

        if (r === undefined)
          break

        end = r
      }
    }

    if (!extend && toStart !== toEnd) {
      if (toEnd)
        start = selection.end
      else
        end = selection.start
    }

    return selection.isReversed
      ? new vscode.Selection(end, start)
      : new vscode.Selection(start, end)
  })
}

function registerObjectSelect(command: Command, inner: boolean, extend: boolean, start?: boolean) {
  // Start === true     : Select only to start
  // Start === false    : Select only to end
  // Start === undefined: Select to both start and end

  registerCommand(command, async (editor, state) => {
    const objType = await promptObjectType()

    if (objType !== undefined)
      await performObjectSelect(editor, state.currentCount || 1, inner, objType, extend, start !== false, start !== true)
  })
}

registerObjectSelect(Command.objectsSelect                  , false, true )
registerObjectSelect(Command.objectsSelectInner             , true , true )
registerObjectSelect(Command.objectsSelectToStart           , false, false, true )
registerObjectSelect(Command.objectsSelectToStartInner      , true , false, true )
registerObjectSelect(Command.objectsSelectToStartExtend     , false, true , true )
registerObjectSelect(Command.objectsSelectToStartExtendInner, true , true , true )
registerObjectSelect(Command.objectsSelectToEnd             , false, false, false)
registerObjectSelect(Command.objectsSelectToEndInner        , true , false, false)
registerObjectSelect(Command.objectsSelectToEndExtend       , false, true , false)
registerObjectSelect(Command.objectsSelectToEndExtendInner  , true , true , false)

registerCommand(Command.objectsSelectRepeat, (editor, state) => {
  if (lastObjectSelectOperation === undefined)
    return

  return performObjectSelect(editor, state.currentCount || 1, ...lastObjectSelectOperation)
})
