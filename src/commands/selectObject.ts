// Objects: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#object-selection
import * as vscode from 'vscode'

import { TextBuffer }   from '../utils/textBuffer'

import { registerCommand, Command, CommandFlags, InputKind } from '.'


const objectTypePromptItems: [string, string][] = [
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
]


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

function findObjectWithChars(text: TextBuffer, reverse: boolean, inner: boolean, ok: (c: string) => boolean): vscode.Position | undefined {
  let diff = reverse ? -1 : 1
  let i = diff

  for (let c = text.char(i); c !== undefined; c = text.char(i += diff)) {
    if (!ok(c))
      break
  }

  return inner !== reverse
    ? text.position(i)
    : text.position(i + 1)
}

function findSentenceStart(text: TextBuffer, inner: boolean): vscode.Position {
  let balance = 0

  for (let i = 0, c = text.char(i);; c = text.char(--i)) {
    if (c === '(') {
      balance++
    } else if (c === ')') {
      balance--
    } else if (c === undefined) {
      return text.position(i + 1)!
    } else if (balance !== 0) {
      // Nop.
    } else if (c === '\n' && text.char(i - 1) === '\n') {
      return text.position(i + 1)!
    } else if (c === '.' || c === ';' || c === '!' || c === '?') {
      return text.position(i + 1)!
    }
  }
}

function findSentenceEnd(text: TextBuffer, inner: boolean): vscode.Position {
  let balance = 0

  for (let i = 0, c = text.char(i);; c = text.char(++i)) {
    if (c === '(') {
      balance++
    } else if (c === ')') {
      balance--
    } else if (c === undefined) {
      return text.position(i + 1)!
    } else if (balance !== 0) {
      // Nop.
    } else if (c === '\n' && text.char(i + 1) === '\n') {
      return text.position(i)!
    } else if (c === '.' || c === ';' || c === '!' || c === '?') {
      return text.position(i + (inner ? 1 : 0))!
    }
  }
}

function findParagraphStart(text: TextBuffer, inner: boolean): vscode.Position {
  let balance = 0

  for (let i = 0, c = text.char(i);; c = text.char(--i)) {
    if (c === '(') {
      balance++
    } else if (c === ')') {
      balance--
    } else if (c === undefined) {
      return text.position(i + 1)!
    } else if (balance !== 0) {
      // Nop.
    } else if (c === '\n' && text.char(i - 1) === '\n') {
      return text.position(i + 1)!
    }
  }
}

function findParagraphEnd(text: TextBuffer, inner: boolean): vscode.Position {
  let balance = 0

  for (let i = 0, c = text.char(i);; c = text.char(++i)) {
    if (c === '(') {
      balance++
    } else if (c === ')') {
      balance--
    } else if (c === undefined) {
      return text.position(i + 1)!
    } else if (balance !== 0) {
      // Nop.
    } else if (c === '\n' && text.char(i + 1) === '\n') {
      return text.position(i)!
    }
  }
}

function findIndentBlockStart(text: TextBuffer, inner: boolean): vscode.Position {
  let line = text.line

  while (line.isEmptyOrWhitespace) {
    if (line.lineNumber === 0)
      return line.range.start

    line = text.doc.lineAt(line.lineNumber - 1)
  }

  let indent = line.firstNonWhitespaceCharacterIndex
  let lastValidPosition = line.range.start

  for (;;) {
    if (line.lineNumber === 0)
      return lastValidPosition

    if (!line.isEmptyOrWhitespace) {
      if (line.firstNonWhitespaceCharacterIndex < indent)
        return lastValidPosition
      else
        lastValidPosition = line.range.start
    }

    line = text.doc.lineAt(line.lineNumber - 1)
  }
}

function findIndentBlockEnd(text: TextBuffer, inner: boolean): vscode.Position {
  let line = text.line
  let lastLine = text.doc.lineCount - 1

  while (line.isEmptyOrWhitespace) {
    if (line.lineNumber === lastLine)
      return line.range.end

    line = text.doc.lineAt(line.lineNumber + 1)
  }

  let indent = line.firstNonWhitespaceCharacterIndex
  let lastValidPosition = line.range.end

  for (;;) {
    if (line.lineNumber === lastLine)
      return lastValidPosition

    if (!line.isEmptyOrWhitespace) {
      if (line.firstNonWhitespaceCharacterIndex < indent)
        return lastValidPosition
      else
        lastValidPosition = line.range.end
    }

    line = text.doc.lineAt(line.lineNumber + 1)
  }
}

function findArgumentStart(text: TextBuffer, inner: boolean): vscode.Position {
  let bbalance = 0,
      pbalance = 0,
      strOpen = undefined as string | undefined

  for (let i = 0, c = text.char(i);; c = text.char(--i)) {
    if (c === undefined) {
      return text.position(i + 1)!
    } else if (strOpen !== undefined) {
      if (c === strOpen && text.char(i - 1) !== '\\')
        strOpen = undefined
    } else if (c === '"' || c === "'" || c === '`') {
      strOpen = c
    } else if (c === '(' && pbalance !== 0) {
      pbalance++
    } else if (c === '[') {
      bbalance++
    } else if (c === ')') {
      pbalance--
    } else if (c === ']') {
      bbalance--
    } else if (pbalance !== 0 || bbalance !== 0) {
      // Nop.
    } else if (c === ',') {
      return text.position(i + 2)!
    } else if (c === '(') {
      return text.position(i + 1)!
    }
  }
}

function findArgumentEnd(text: TextBuffer, inner: boolean): vscode.Position {
  let bbalance = 0,
      pbalance = 0,
      strOpen = undefined as string | undefined

  for (let i = 0, c = text.char(i);; c = text.char(++i)) {
    if (c === undefined) {
      return text.position(i - 1)!
    } else if (strOpen !== undefined) {
      if (c === strOpen && text.char(i - 1) !== '\\')
        strOpen = undefined
    } else if (c === '"' || c === "'" || c === '`') {
      strOpen = c
    } else if (c === '(') {
      pbalance++
    } else if (c === '[') {
      bbalance++
    } else if (c === ')' && pbalance !== 0) {
      pbalance--
    } else if (c === ']') {
      bbalance--
    } else if (pbalance !== 0 || bbalance !== 0) {
      // Nop.
    } else if (c === ',') {
      return text.position(i)!
    } else if (c === ')') {
      return text.position(i)!
    }
  }
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


    case 7: // Word
      return findObjectWithChars(text, true, inner, c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'))

    case 8: // Non-whitespace word
      return findObjectWithChars(text, true, inner, c => !' \t\r\n'.includes(c))

    case 11: // Whitespaces
      return findObjectWithChars(text, true, inner, c => ' \t\r\n'.includes(c))

    case 13: // Number
      return findObjectWithChars(text, true, inner, c => c >= '0' && c <= '9')


    case 9: // Sentence
      return findSentenceStart(text, inner)

    case 10: // Paragraph
      return findParagraphStart(text, inner)

    case 12: // Indentation block
      return findIndentBlockStart(text, inner)

    case 14: // Argument
      return findArgumentStart(text, inner)
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


    case 7: // Word
      return findObjectWithChars(text, false, inner, c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'))

    case 8: // Non-whitespace word
      return findObjectWithChars(text, false, inner, c => !' \t\r\n'.includes(c))

    case 11: // Whitespaces
      return findObjectWithChars(text, false, inner, c => ' \t\r\n'.includes(c))

    case 13: // Number
      return findObjectWithChars(text, false, inner, c => c >= '0' && c <= '9')


    case 9: // Sentence
      return findSentenceEnd(text, inner)

    case 10: // Paragraph
      return findParagraphEnd(text, inner)

    case 12: // Indentation block
      return findIndentBlockEnd(text, inner)

    case 14: // Argument
      return findArgumentEnd(text, inner)
  }

  return undefined
}

function performObjectSelect(editor: vscode.TextEditor, count: number, inner: boolean, type: number, extend: boolean, toStart: boolean, toEnd: boolean) {
  lastObjectSelectOperation = [inner, type, extend, toStart, toEnd]

  editor.selections = editor.selections.map(selection => {
    let start = selection.start
    let end = selection.end
    let inInfiniteLooop = false

    for (let i = 0; i < count; i++) {
      let sameStart = true,
          sameEnd = true

      if (toStart) {
        const buf = new TextBuffer(editor.document, start)
        const r = findObjectStart(buf, type, inner)

        if (r === undefined)
          break

        sameStart = start.isEqual(r)
        start = r
      }

      if (toEnd) {
        const buf = new TextBuffer(editor.document, end)
        const r = findObjectEnd(buf, type, inner)

        if (r === undefined)
          break

        sameEnd = end.isEqual(r)
        end = r
      }

      if (sameStart && sameEnd) {
        // Our object did not move, so we try again with shifted indices
        if (inInfiniteLooop)
          break

        inInfiniteLooop = true

        start = start.character === 0
          ? (start.line === 0 ? start : new vscode.Position(start.line - 1, 0))
          : (start.translate(0, -1))

        const lastChar = editor.document.lineAt(end.line).range.end.character

        end = end.character === lastChar
          ? (end.line === editor.document.lineCount - 1 ? end : new vscode.Position(end.line + 1, 0))
          : end.translate(0, 1)

        i--
      } else {
        inInfiniteLooop = false
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

  registerCommand(command, CommandFlags.ChangeSelections, InputKind.ListOneItem, objectTypePromptItems, async (editor, state) => {
    await performObjectSelect(editor, state.currentCount || 1, inner, state.input, extend, start !== false, start !== true)
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

registerCommand(Command.objectsSelectRepeat, CommandFlags.ChangeSelections, (editor, state) => {
  if (lastObjectSelectOperation === undefined)
    return

  return performObjectSelect(editor, state.currentCount || 1, ...lastObjectSelectOperation)
})
