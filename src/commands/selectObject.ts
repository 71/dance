// Objects: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#object-selection

import * as vscode from 'vscode'
import { registerCommand, Command, CommandFlags } from '.'
import { Direction, Forward, Backward, SelectionHelper, RemoveSelection, CoordMapper, SelectionMapper, moveActiveCoord, DoNotExtend, Extend, DocumentStart, Coord, ExtendBehavior } from '../utils/selectionHelper'
import { getCharSetFunction, CharSet } from '../utils/charset'
import { findMatching, skipWhile, skipWhileX } from './select'

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

function objectActions(toStart: CoordMapper, toEnd: CoordMapper, toStartInner: CoordMapper, toEndInner: CoordMapper) {
  const selectObject: SelectionMapper = (selection, helper, i) => {
    const active = helper.activeCoord(selection)
    const start = toStart(active, helper, i)
    const end = toEnd(active, helper, i)
    if ('remove' in start || 'remove' in end) return RemoveSelection
    return helper.selectionBetween(start, end)
  }
  const selectObjectInner: SelectionMapper = (selection, helper, i) => {
    const active = helper.activeCoord(selection)
    const start = toStartInner(active, helper, i)
    const end = toEndInner(active, helper, i)
    if ('remove' in start || 'remove' in end) return RemoveSelection
    return helper.selectionBetween(start, end)
  }

  return {
    select: {
      outer: selectObject,
      inner: selectObjectInner,
    },
    selectToStart: {
      outer: {
        doNotExtend: moveActiveCoord(toStart,      DoNotExtend),
        extend:      moveActiveCoord(toStart,           Extend),
      },
      inner: {
        doNotExtend: moveActiveCoord(toStartInner, DoNotExtend),
        extend:      moveActiveCoord(toStartInner,      Extend),
      },
    },
    selectToEnd: {
      outer: {
        doNotExtend: moveActiveCoord(toEnd,        DoNotExtend),
        extend:      moveActiveCoord(toEnd,             Extend),
      },
      inner: {
        doNotExtend: moveActiveCoord(toEndInner,   DoNotExtend),
        extend:      moveActiveCoord(toEndInner,        Extend),
      },
    },
  }
}

function objectWithinPair(startCharCode: number, endCharCode: number) {
  const toStart: CoordMapper = (active, helper) => findMatching(Backward, active, startCharCode, endCharCode, helper.editor.document) ?? RemoveSelection
  const toEnd: CoordMapper = (active, helper) => findMatching(Forward, active, endCharCode, startCharCode, helper.editor.document) ?? RemoveSelection

  const toStartInner: CoordMapper = (active, helper, i) => {
    const pos = toStart(active, helper, i)
    if ('remove' in pos) return pos
    return helper.nextPos(pos)
  }

  const toEndInner: CoordMapper = (active, helper, i) => {
    const pos = toEnd(active, helper, i)
    if ('remove' in pos) return pos
    return helper.prevPos(pos)
  }

  const actions = objectActions(toStart, toEnd, toStartInner, toEndInner)

  // Special cases for selectObject and selectObjectInner when active is at the
  // start / end of an object, so that it always select a whole object within
  // a matching pair. e.g. (12345) when active at first character should select
  // the whole thing instead of error.
  const defaultSelect = actions.select.outer
  const defaultSelectInner = actions.select.inner
  actions.select.outer = (selection, helper, i) => {
    const active = helper.activeCoord(selection)
    const currentCharCode = helper.editor.document.lineAt(active.line).text.charCodeAt(active.character)
    if (currentCharCode === startCharCode) {
      const end = toEnd(active, helper, i)
      if ('remove' in end) return RemoveSelection
      return helper.selectionBetween(active, end)
    } else if (currentCharCode === endCharCode) {
      const start = toStart(active, helper, i)
      if ('remove' in start) return RemoveSelection
      return helper.selectionBetween(start, active)
    } else {
      return defaultSelect(selection, helper, i)
    }
  }
  actions.select.inner = (selection, helper, i) => {
    const active = helper.activeCoord(selection)
    const currentCharCode = helper.editor.document.lineAt(active.line).text.charCodeAt(active.character)
    if (currentCharCode === startCharCode) {
      const end = toEndInner(active, helper, i)
      if ('remove' in end) return RemoveSelection
      return helper.selectionBetween(helper.nextPos(active), end)
    } else if (currentCharCode === endCharCode) {
      const start = toStartInner(active, helper, i)
      if ('remove' in start) return RemoveSelection
      return helper.selectionBetween(start, helper.prevPos(active))
    } else {
      return defaultSelectInner(selection, helper, i)
    }
  }

  return actions
}

function objectWithCharSet(charSet: CharSet) {
  function toEdge(direction: Direction, includeTrailingWhitespace: boolean): CoordMapper {
    return (active, helper) => {
      const { document } = helper.editor
      const isInSet = getCharSetFunction(charSet, document)
      let col = active.character
      const text = document.lineAt(active.line).text
      if (col >= text.length) {
        // A charset object cannot contain line break, therefore the cursor active
        // is not within any such object.
        return RemoveSelection
      }
      while (isInSet(text.charCodeAt(col))) {
        if (col === 0 || col + 1 === text.length) return active.with(undefined, col)
        col += direction
      }
      if (col === active.character) {
        // The cursor active is on a character outside charSet.
        return RemoveSelection
      }
      if (includeTrailingWhitespace) {
        const isBlank = getCharSetFunction(CharSet.Blank, document)
        while (isBlank(text.charCodeAt(col))) {
          if (col === 0 || col + 1 === text.length) return active.with(undefined, col)
          col += direction
        }
      }
      return active.with(undefined, col - direction)
    }
  }

  const toStart = toEdge(Backward, false)
  const toStartInner = toStart
  const toEnd = toEdge(Forward, true)
  const toEndInner = toEdge(Forward, false)
  return objectActions(toStart, toEnd, toStartInner, toEndInner)
}

// I bet that's the first time you see a Greek question mark used as an actual Greek question mark,
// rather than as a "prank" semicolon.
const punctCharCodes = new Uint32Array(Array.from('.!?¡§¶¿;՞。', ch => ch.charCodeAt(0)))

function sentenceObject() {
  const toStart: CoordMapper = (oldActive, helper, i) => {
    const allowSkipToPrevious = true // TODO
    const document = helper.editor.document
    const isBlank = getCharSetFunction(CharSet.Blank, document)
    let origin = oldActive // TODO: Adjust for caret mode.

    let isPreviousSentence = false

    let skipCurrent = true // TODO: Set to false for select whole object
    let hadLf = true
    const beforeBlank = skipWhileX(Backward, origin, (charCode) => {
      if (charCode === LF) {
        if (hadLf) {
          isPreviousSentence = true
          return allowSkipToPrevious
        }
        hadLf = true
        skipCurrent = false
        return true
      } else {
        hadLf = false
        if (skipCurrent) {
          skipCurrent = false
          return true
        }
        return isBlank(charCode)
      }
    }, document)

    if (beforeBlank !== undefined && (
        !isPreviousSentence || (allowSkipToPrevious && punctCharCodes.includes(document.lineAt(beforeBlank.line).text.charCodeAt(beforeBlank.character)))
    )) {
      if (beforeBlank.line === 0 && beforeBlank.character === 0)
        return beforeBlank
      else
        origin = helper.prevPos(beforeBlank)
    }

    let originLineText = document.lineAt(origin.line).text
    if (originLineText.length === 0 && origin.line + 1 >= document.lineCount) {
      if (origin.line === 0) {
        // There is only one line and that line is empty. What a life.
        return DocumentStart
      }
      // Special case: If at the last line, search from the previous line.
      originLineText = document.lineAt(origin.line - 1).text
      origin = origin.with(origin.line - 1, originLineText.length)
    }
    if (originLineText.length === 0) {
      // This line is empty. Just go to the first non-blank char on next line.
      const nextLineText = document.lineAt(origin.line + 1).text
      let col = 0
      while (col < nextLineText.length && isBlank(nextLineText.charCodeAt(col))) col++
      return new Coord(origin.line + 1, col)
    }

    hadLf = false
    const afterSkip = skipWhileX(Backward, origin, (charCode) => {
      if (charCode === LF) {
        if (hadLf)
          return false
        hadLf = true
      } else {
        hadLf = false
        if (punctCharCodes.indexOf(charCode) >= 0)
          return false
      }
      return true
    }, document)

    // If we hit two LFs or document start, the current sentence starts at the
    // first non-blank character after that.
    if (hadLf || !afterSkip)
      return skipWhileX(
        Forward,
        afterSkip ?? DocumentStart,
        isBlank,
        document,
      ) ?? DocumentStart

    // If we hit a punct char, then the current sentence starts on the first
    // non-blank character on the same line, or the line break.
    let col = afterSkip.character + 1
    const text = document.lineAt(afterSkip.line).text
    while (col < text.length && isBlank(text.charCodeAt(col))) col++
    return afterSkip.with(undefined, col)
  }
  function toEnd(inner: boolean): CoordMapper {
    return (origin, helper) => {
      const document = helper.editor.document

      if (document.lineAt(origin.line).text.length === 0) {
        // We're on an empty line which does not belong to last sentence or this
        // sentence. If next line is also empty, we should just stay here.
        // However, start scanning from the next line if it is not empty.
        if (origin.line + 1 >= document.lineCount || document.lineAt(origin.line + 1).text.length === 0)
          return origin
        else
          origin = new Coord(origin.line + 1, 0)
      }

      const isBlank = getCharSetFunction(CharSet.Blank, document)

      let hadLf = false
      const innerEnd = skipWhileX(Forward, origin, (charCode) => {
        if (charCode === LF) {
          if (hadLf)
            return false
          hadLf = true
        } else {
          hadLf = false
          if (punctCharCodes.indexOf(charCode) >= 0)
            return false
        }
        return true
      }, document)

      if (!innerEnd) return helper.lastCoord()

      // If a sentence ends with two LFs in a row, then the first LF is part of
      // the inner & outer sentence while the second LF should be excluded.
      if (hadLf) return helper.prevPos(innerEnd)

      if (inner) return innerEnd
      // If a sentence ends with punct char, then any blank characters after it
      // but BEFORE any line breaks belongs to the outer sentence.
      let col = innerEnd.character + 1
      const text = document.lineAt(innerEnd.line).text
      while (col < text.length && isBlank(text.charCodeAt(col))) col++
      return innerEnd.with(undefined, col - 1)
    }
  }
  return objectActions(toStart, toEnd(false), toStart, toEnd(true))
}

type ObjectAction = 'select' | 'selectToStart' | 'selectToEnd'
const dispatch = {
  parens:            objectWithinPair(LPAREN,     RPAREN),
  braces:            objectWithinPair(LCRBRACKET, RCRBRACKET),
  brackets:          objectWithinPair(LSQBRACKET, RSQBRACKET),
  angleBrackets:     objectWithinPair(LCHEVRON,   RCHEVRON),
  doubleQuoteString: objectWithinPair(QUOTE_DBL,  QUOTE_DBL),
  singleQuoteString: objectWithinPair(QUOTE_SGL,  QUOTE_SGL),
  graveQuoteString:  objectWithinPair(BACKTICK,   BACKTICK),
  word: objectWithCharSet(CharSet.Word),
  WORD: objectWithCharSet(CharSet.NonBlank),
  sentence: sentenceObject(),
  // TODO: sentence
  // TODO: paragraph
  // TODO: whitespaces
  // TODO: indent
  // TODO: number
  // TODO: argument
  // TODO: custom
}

registerCommand(Command.objectsPerformSelection, CommandFlags.ChangeSelections, (editorState, state) => {
  if (!state.argument || !state.argument.object) {
    throw new Error('Argument must have shape {object: string, action: string, extend?: boolean, inner?: boolean}')
  }
  const dispatch2 = dispatch[state.argument.object as keyof typeof dispatch]
  if (!dispatch2) {
    throw new Error('Invalid argument: object must be a string and one of ' + Object.keys(dispatch).join(','))
  }
  const dispatch3 = dispatch2[state.argument.action as ObjectAction]
  if (!dispatch3) {
    throw new Error('Invalid argument: action must be a string and one of ' + Object.keys(dispatch2).join(','))
  }
  const bound = state.argument.inner ? 'inner' : 'outer'
  let mapper = dispatch3[bound]
  if (typeof mapper === 'object') {
    const extend = state.argument.extend ? 'extend' : 'doNotExtend'
    mapper = mapper[extend]
  }
  const helper = SelectionHelper.for(editorState, state)
  helper.mapEach(mapper)
})
