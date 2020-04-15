// Objects: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#object-selection
import * as vscode from 'vscode'

import { Position, Direction, Forward, ExtendBehavior, Backward } from '../utils/selections'

import { registerCommand, Command, CommandFlags, InputKind, CommandState } from '.'
import { CharSet } from '../extension'


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

const [
  LPAREN,
  RPAREN,
  LSQBRACKET,
  RSQBRACKET,
  LCRBRACKET,
  RCRBRACKET,
  LCHEVRON,
  RCHEVRON,
  LF,
  SPACE,
  QUOTE_DBL,
  QUOTE_SGL,
  BACKTICK,
  BACKSLASH,
  COMMA,
] = Array.from('()[]{}<>\n "\'`\\,', ch => ch.charCodeAt(0))

let lastObjectSelectOperation: [boolean, number, boolean, boolean, boolean] | undefined

function findPairObject(origin: Position, direction: Direction, start: number, end: number, inner: boolean) {
  const cursor = origin.cursor()
  let balance = start === end || direction === Backward ? -1 : 1

  const found = cursor.skipUntil(direction, charCode => {
    if (charCode === start)
      balance++
    else if (charCode === end)
      balance--
    else
      return false

    return balance === 0
  }, direction === Forward)

  if (found && inner === (direction === Backward)) {
    cursor.skip(Forward)
  }

  return found
}

function findObjectWithChars(origin: Position, direction: Direction, inner: boolean, ok: (charCode: number) => boolean) {
  const cursor = origin.cursor()
  const found = cursor.skipUntil(direction, charCode => !ok(charCode), direction === Forward)

  if (!found)
    return false

  if (inner === (direction === Backward))
    cursor.skip(Forward)

  return true
}

// I bet that's the first time you see a Greek question mark used as an actual Greek question mark,
// rather than as a "prank" semicolon.
const punctCharCodes = new Uint32Array(Array.from('.!?¡§¶¿;՞。', ch => ch.charCodeAt(0)))

function findSentenceStart(origin: Position, isWord: (charCode: number) => boolean) {
  const cursor = origin.cursor()

  // Go to the end of the last sentence.
  if (!cursor.skipWhile(Backward, charCode => charCode === SPACE))
    return true

  let lastCharOffset = 0, lastLine = 0, lastChar = 0
  let hadLf = false

  cursor.skipUntil(Backward, (charCode, offset, line, char) => {
    if (charCode === LF) {
      if (hadLf)
        return true

      hadLf = true
    } else if (punctCharCodes.indexOf(charCode) !== -1) {
      return true
    } else if (isWord(charCode)) {
      lastCharOffset = offset, lastLine = line, lastChar = char
    } else {
      hadLf = false
    }

    return false
  }, false)

  cursor.position.updateForNewPositionFast(lastCharOffset, new vscode.Position(lastLine, lastChar))
  cursor.notifyPositionUpdated()

  return true
}

function findSentenceEnd(origin: Position, inner: boolean, isWord: (charCode: number) => boolean) {
  const cursor = origin.cursor()

  let hadLf = false
  let toNextWord = false

  cursor.skipWhile(Forward, charCode => {
    if (charCode === LF) {
      if (hadLf)
        return false

      hadLf = true
    } else if (punctCharCodes.indexOf(charCode) !== -1) {
      if (inner)
        toNextWord = true

      return false
    }

    return true
  })

  if (toNextWord) {
    cursor.skipWhile(Forward, charCode => !isWord(charCode))
  }

  return true
}

function findParagraphStart(origin: Position, inner: boolean) {
  const cursor = origin.cursor(),
        document = origin.set.document
  let lineNumber = origin.line

  if (!inner) {
    while (lineNumber >= 0 && document.lineAt(lineNumber).isEmptyOrWhitespace) {
      lineNumber--
    }
  }

  while (lineNumber >= 0 && !document.lineAt(lineNumber).isEmptyOrWhitespace) {
    lineNumber--
  }

  cursor.position.updateForNewPosition(document.lineAt(lineNumber + 1).range.start)
  cursor.notifyPositionUpdated()

  return true
}

function findParagraphEnd(origin: Position, inner: boolean) {
  const cursor = origin.cursor(),
        document = origin.set.document,
        lineCount = document.lineCount
  let lineNumber = origin.line

  while (lineNumber < lineCount && !document.lineAt(lineNumber).isEmptyOrWhitespace) {
    lineNumber++
  }

  if (!inner) {
    while (lineNumber < lineCount && document.lineAt(lineNumber).isEmptyOrWhitespace) {
      lineNumber++
    }
  }

  if (lineNumber === lineCount)
    cursor.position.updateForNewPosition(document.lineAt(lineNumber - 1).range.end)
  else
    cursor.position.updateForNewPosition(document.lineAt(lineNumber).range.start)

  cursor.notifyPositionUpdated()

  return true
}

function findIndentBlockStart(origin: Position) {
  const cursor = origin.cursor(),
        document = origin.set.document
  let textLine = cursor.textLine

  while (textLine.isEmptyOrWhitespace) {
    if (textLine.lineNumber === 0) {
      cursor.position.updateForNewPosition(textLine.range.start)
      cursor.notifyPositionUpdated()

      return true
    }

    textLine = document.lineAt(textLine.lineNumber - 1)
  }

  const indent = textLine.firstNonWhitespaceCharacterIndex
  let lastValidPosition = textLine.range.start

  for (;;) {
    if (textLine.lineNumber === 0)
      break

    if (!textLine.isEmptyOrWhitespace) {
      if (textLine.firstNonWhitespaceCharacterIndex < indent)
        break

      lastValidPosition = textLine.range.start
    }

    textLine = document.lineAt(textLine.lineNumber - 1)
  }

  cursor.position.updateForNewPosition(lastValidPosition)
  cursor.notifyPositionUpdated()

  return true
}

function findIndentBlockEnd(origin: Position) {
  const cursor = origin.cursor(),
        document = origin.set.document,
        lastLine = document.lineCount - 1
  let textLine = cursor.textLine

  while (textLine.isEmptyOrWhitespace) {
    if (textLine.lineNumber === lastLine) {
      cursor.position.updateForNewPosition(textLine.range.end)
      cursor.notifyPositionUpdated()

      return true
    }

    textLine = document.lineAt(textLine.lineNumber + 1)
  }

  const indent = textLine.firstNonWhitespaceCharacterIndex
  let lastValidPosition = textLine.range.end

  for (;;) {
    if (textLine.lineNumber === lastLine)
      break

    if (!textLine.isEmptyOrWhitespace) {
      if (textLine.firstNonWhitespaceCharacterIndex < indent)
        break

      lastValidPosition = textLine.range.end
    }

    textLine = document.lineAt(textLine.lineNumber + 1)
  }

  cursor.position.updateForNewPosition(lastValidPosition)
  cursor.notifyPositionUpdated()

  return true
}

function findArgumentStart(origin: Position) {
  const cursor = origin.offsetCursor()

  let bbalance = 0,
      pbalance = 0,
      strOpenCharCode = 0

  for (let i = 0, charCode = cursor.char(i);; charCode = cursor.char(--i)) {
    if (charCode === 0) {
      cursor.commit(i + 1)

      return true
    } else if (strOpenCharCode !== 0) {
      if (charCode === strOpenCharCode && cursor.charInLine(charCode - 1) !== BACKSLASH)
        strOpenCharCode = 0
    } else if (charCode === QUOTE_DBL || charCode === QUOTE_SGL || charCode === BACKTICK) {
      strOpenCharCode = charCode
    } else if (charCode === LPAREN && pbalance !== 0) {
      pbalance++
    } else if (charCode === LSQBRACKET) {
      bbalance++
    } else if (charCode === RPAREN) {
      pbalance--
    } else if (charCode === RSQBRACKET) {
      bbalance--
    } else if (pbalance !== 0 || bbalance !== 0) {
      // Nop.
    } else if (charCode === COMMA) {
      cursor.commit(i + 2)

      return true
    } else if (charCode === LPAREN) {
      cursor.commit(i + 1)

      return true
    }
  }
}

function findArgumentEnd(origin: Position) {
  const cursor = origin.offsetCursor()

  let bbalance = 0,
      pbalance = 0,
      strOpenCharCode = 0

  for (let i = 0, charCode = cursor.char(i);; charCode = cursor.char(++i)) {
    if (charCode === 0) {
      cursor.commit(i - 1)

      return true
    } else if (strOpenCharCode !== 0) {
      if (charCode === strOpenCharCode && cursor.charInLine(i - 1) !== BACKSLASH)
        strOpenCharCode = 0
    } else if (charCode === QUOTE_DBL || charCode === QUOTE_SGL || charCode === BACKTICK) {
      strOpenCharCode = charCode
    } else if (charCode === LPAREN) {
      pbalance++
    } else if (charCode === LSQBRACKET) {
      bbalance++
    } else if (charCode === RPAREN && pbalance !== 0) {
      pbalance--
    } else if (charCode === RSQBRACKET) {
      bbalance--
    } else if (pbalance !== 0 || bbalance !== 0) {
      // Nop.
    } else if (charCode === COMMA) {
      cursor.commit(i)

      return true
    } else if (charCode === RPAREN) {
      cursor.commit(i)

      return true
    }
  }
}

function findObjectStart(origin: Position, type: number, inner: boolean) {
  switch (type) {
    case 0: // Parentheses
      return findPairObject(origin, Backward, LPAREN, RPAREN, inner)

    case 1: // Brackets
      return findPairObject(origin, Backward, LCRBRACKET, RCRBRACKET, inner)

    case 2: // Squared brackets
      return findPairObject(origin, Backward, LSQBRACKET, RSQBRACKET, inner)

    case 3: // Angle brackets
      return findPairObject(origin, Backward, LCHEVRON, RCHEVRON, inner)

    case 4: // Double quotes
      return findPairObject(origin, Backward, QUOTE_DBL, QUOTE_DBL, inner)

    case 5: // Single quotes
      return findPairObject(origin, Backward, QUOTE_SGL, QUOTE_SGL, inner)

    case 6: // Grave quotes
      return findPairObject(origin, Backward, BACKTICK, BACKTICK, inner)


    case 7: // Word
      return findObjectWithChars(origin, Backward, inner, origin.set.extension.getCharSetFunction(CharSet.Word, origin.set.document))

    case 8: // Non-whitespace word
      return findObjectWithChars(origin, Backward, inner, origin.set.extension.getCharSetFunction(CharSet.NonBlank, origin.set.document))

    case 11: // Whitespaces
      return findObjectWithChars(origin, Backward, inner, origin.set.extension.getCharSetFunction(CharSet.Blank, origin.set.document))

    case 13: // Number
      return findObjectWithChars(origin, Backward, inner, charCode => charCode >= 48 && charCode <= 57)


    case 9: // Sentence
      return findSentenceStart(origin, origin.set.extension.getCharSetFunction(CharSet.Word, origin.set.document))

    case 10: // Paragraph
      return findParagraphStart(origin, inner)

    case 12: // Indentation block
      return findIndentBlockStart(origin)

    case 14: // Argument
      return findArgumentStart(origin)

    default:
      throw new Error('Invalid object type.')
  }
}

function findObjectEnd(origin: Position, type: number, inner: boolean) {
  switch (type) {
    case 0: // Parentheses
      return findPairObject(origin, Forward, LPAREN, RPAREN, inner)

    case 1: // Brackets
      return findPairObject(origin, Forward, LCRBRACKET, RCRBRACKET, inner)

    case 2: // Squared brackets
      return findPairObject(origin, Forward, LSQBRACKET, RSQBRACKET, inner)

    case 3: // Angle brackets
      return findPairObject(origin, Forward, LCHEVRON, RCHEVRON, inner)

    case 4: // Double quotes
      return findPairObject(origin, Forward, QUOTE_DBL, QUOTE_DBL, inner)

    case 5: // Single quotes
      return findPairObject(origin, Forward, QUOTE_SGL, QUOTE_SGL, inner)

    case 6: // Grave quotes
      return findPairObject(origin, Forward, BACKTICK, BACKTICK, inner)


    case 7: // Word
      return findObjectWithChars(origin, Forward, inner, origin.set.extension.getCharSetFunction(CharSet.Word, origin.set.document))

    case 8: // Non-whitespace word
      return findObjectWithChars(origin, Forward, inner, origin.set.extension.getCharSetFunction(CharSet.NonBlank, origin.set.document))

    case 11: // Whitespaces
      return findObjectWithChars(origin, Forward, inner, origin.set.extension.getCharSetFunction(CharSet.Blank, origin.set.document))

    case 13: // Number
      return findObjectWithChars(origin, Forward, inner, charCode => charCode >= 48 && charCode <= 57)


    case 9: // Sentence
      return findSentenceEnd(origin, inner, origin.set.extension.getCharSetFunction(CharSet.Word, origin.set.document))

    case 10: // Paragraph
      return findParagraphEnd(origin, inner)

    case 12: // Indentation block
      return findIndentBlockEnd(origin)

    case 14: // Argument
      return findArgumentEnd(origin)

    default:
      throw new Error('Invalid object type.')
  }
}

function performObjectSelect(editor: vscode.TextEditor, state: CommandState, inner: boolean, type: number, extend: ExtendBehavior, toStart: boolean, toEnd: boolean) {
  lastObjectSelectOperation = [inner, type, extend, toStart, toEnd]

  const count = state.currentCount || 1

  state.selectionSet.updateEach(editor, selection => {
    const prevStart = selection.start.copy(selection.set),
          prevEnd = selection.end.copy(selection.set),
          { active, start, end } = selection

    if (end === active)
      start.inheritPosition(active)
    else
      end.inheritPosition(active)

    if (toStart && !toEnd) {
      start.moveLeftOrGoUp()
    }

    for (let i = 0; i < count; i++) {
      if (toStart) {
        if (!findObjectStart(start, type, inner))
          break
      }

      if (toEnd) {
        if (!findObjectEnd(end, type, inner))
          break
      }
    }

    if (extend && toStart !== toEnd) {
      if (toEnd)
        start.inheritPosition(prevStart)
      else
        end.inheritPosition(prevEnd)
    }

    selection.isReversed = toEnd
  })
}

function registerObjectSelect(command: Command, inner: boolean, extend: boolean, start?: boolean) {
  // Start === true     : Select only to start
  // Start === false    : Select only to end
  // Start === undefined: Select to both start and end

  registerCommand(command, CommandFlags.ChangeSelections, InputKind.ListOneItem, objectTypePromptItems, (editor, state) => {
    performObjectSelect(editor, state, inner, state.input, extend, start !== false, start !== true)
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

  return performObjectSelect(editor, state, ...lastObjectSelectOperation)
})
