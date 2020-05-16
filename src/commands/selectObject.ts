// Objects: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#object-selection

import * as vscode from 'vscode'
import { registerCommand, Command, CommandFlags, CommandState } from '.'
import { Direction, Forward, Backward, SelectionHelper, RemoveSelection, CoordMapper, SelectionMapper, moveActiveCoord, DoNotExtend, Extend, DocumentStart, Coord, ExtendBehavior } from '../utils/selectionHelper'
import { getCharSetFunction, CharSet } from '../utils/charset'
import { findMatching, skipWhile, skipWhileX } from './select'
import { SelectionBehavior } from '../state/extension'

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
  function toBeforeBlank(allowSkipToPrevious: boolean) {
    return (oldActive: Coord, helper: SelectionHelper<CommandState>) => {
      const document = helper.editor.document
      const isBlank = getCharSetFunction(CharSet.Blank, document)
      let origin = oldActive // TODO: Adjust for caret mode.

      let jumpedOverBlankLine = false

      let skipCurrent = allowSkipToPrevious
      let hadLf = true
      const beforeBlank = skipWhileX(Backward, origin, (charCode) => {
        if (charCode === LF) {
          if (hadLf) {
            jumpedOverBlankLine = true
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

      if (beforeBlank === undefined) return origin

      const beforeBlankChar = document.lineAt(beforeBlank.line).text.charCodeAt(beforeBlank.character)
      const hitPunctChar = punctCharCodes.includes(beforeBlankChar)
      if (jumpedOverBlankLine && (!allowSkipToPrevious || !hitPunctChar)) {
        // We jumped over blank lines but didn't hit a punct char. Don't accept.
        return origin
      }
      // let result = beforeBlank.isEqual(DocumentStart) ? beforeBlank : helper.prevPos(beforeBlank)
      if (!hitPunctChar) {
        return beforeBlank
      }
      if (allowSkipToPrevious) return { prevSentenceEnd: beforeBlank }
      if (origin.line === beforeBlank.line) return beforeBlank
      // Example below: we started from '|' and found the '.'.
      //     foo.
      //       |  bar
      // In this case, technically we started from the second sentence
      // and reached the first sentence. This is not permitted when when
      // allowSkipToPrevious is false, so let's go back.
      return origin
    }
  }

  const toSentenceStart = (origin: Coord, helper: SelectionHelper<CommandState>): Coord => {
    const document = helper.editor.document
    const isBlank = getCharSetFunction(CharSet.Blank, document)

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

    let first = true
    let hadLf = false
    const afterSkip = skipWhileX(Backward, origin, (charCode) => {
      if (charCode === LF) {
        first = false
        if (hadLf)
          return false
        hadLf = true
      } else {
        hadLf = false
        if (first) {
          // Don't need to check if first character encountered is punct --
          // that may be the current sentence end.
          first = false
          return true
        }
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
  const toBeforeBlankCurrent = toBeforeBlank(false)
  const toCurrentStart: CoordMapper = (oldActive, helper, i) => {
    let beforeBlank = toBeforeBlankCurrent(oldActive, helper)
    if ('prevSentenceEnd' in beforeBlank) beforeBlank = oldActive
    return toSentenceStart(beforeBlank, helper)
  }

  function select(inner: boolean): SelectionMapper {
    return (selection, helper, i) => {
      const active = helper.activeCoord(selection)
      const start = toCurrentStart(active, helper, i)
      if ('remove' in start) return RemoveSelection
      // It is imposssible to determine if active is at leading or trailing or
      // in-sentence blank characters by just looking ahead. Therefore, we start
      // from the sentence start, which may be slightly less efficient but
      // always accurate.
      const end = toEnd(inner)(start, helper, i)
      if ('remove' in start || 'remove' in end) return RemoveSelection
      return helper.selectionBetween(start, end)
    }
  }

  // Special cases to allow jumping to the previous sentence when active is at
  // current sentence start / leading blank chars.
  const toBeforeBlankOrPrev = toBeforeBlank(true)
  const selectToStart = {
    extend: moveActiveCoord((oldActive, helper, i) => {
      let beforeBlank = toBeforeBlankOrPrev(oldActive, helper)
      if ('prevSentenceEnd' in beforeBlank) beforeBlank = beforeBlank.prevSentenceEnd
      return toSentenceStart(beforeBlank, helper)
    }, Extend),
    doNotExtend: (selection: vscode.Selection, helper: SelectionHelper<CommandState>) => {
      const oldActive = helper.activeCoord(selection)
      let beforeBlank = toBeforeBlankOrPrev(oldActive, helper)

      if ('prevSentenceEnd' in beforeBlank) {
        const newAnchor = beforeBlank.prevSentenceEnd
        console.log('hit prev end', helper._visualizeCoord(newAnchor))
        // Special case: re-anchor when skipping to last sentence end.
        return helper.selectionBetween(newAnchor, toSentenceStart(newAnchor, helper))
      } else {
        const newActive = toSentenceStart(beforeBlank, helper)
        if (helper.selectionBehavior === SelectionBehavior.Caret) {
          // TODO: Optimize to avoid coordAt / offsetAt.
          let activePos = selection.active.isBeforeOrEqual(newActive) ?
            helper.coordAt(helper.offsetAt(newActive) + 1) : newActive
          return new vscode.Selection(selection.active, activePos)
        }
        return helper.selectionBetween(oldActive, newActive)
      }
    },
  }
  return {
    select: {
      outer: select(false),
      inner: select(true),
    },
    selectToEnd: {
      outer: {
        doNotExtend: moveActiveCoord(toEnd(false),        DoNotExtend),
        extend:      moveActiveCoord(toEnd(false),             Extend),
      },
      inner: {
        doNotExtend: moveActiveCoord(toEnd(true),   DoNotExtend),
        extend:      moveActiveCoord(toEnd(true),        Extend),
      },
    },
    selectToStart: {
      outer: selectToStart,
      inner: selectToStart,
    },
  }
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
