// Objects: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#object-selection

import * as vscode from 'vscode'
import { registerCommand, Command, CommandFlags, CommandState } from '.'
import { Direction, Forward, Backward, SelectionHelper, RemoveSelection, CoordMapper, SelectionMapper, moveActiveCoord, DoNotExtend, Extend, DocumentStart, Coord, ExtendBehavior, SeekFunc, seekToRange } from '../utils/selectionHelper'
import { getCharSetFunction, CharSet } from '../utils/charset'
import { findMatching, skipWhileX, skipWhile } from './select'
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

function objectActions(toStart: CoordMapper, toEnd: CoordMapper, toStartInner: CoordMapper, toEndInner: CoordMapper, scanFromStart: boolean = false) {
  const selectObject: SelectionMapper = (selection, helper, i) => {
    const active = helper.activeCoord(selection)
    const start = toStart(active, helper, i)
    if ('remove' in start) return RemoveSelection
    const end = toEnd(scanFromStart ? start : active, helper, i)
    if ('remove' in end) return RemoveSelection
    return helper.selectionBetween(start, end)
  }
  const selectObjectInner: SelectionMapper = (selection, helper, i) => {
    const active = helper.activeCoord(selection)
    const start = toStartInner(active, helper, i)
    if ('remove' in start) return RemoveSelection
    const end = toEndInner(scanFromStart ? start : active, helper, i)
    if ('remove' in end) return RemoveSelection
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

type CharCodePredicate = (charCode: number) => boolean
function objectWithCharSet(charSet: CharSet | CharCodePredicate) {
  function toEdge(direction: Direction, includeTrailingWhitespace: boolean): CoordMapper {
    return (active, helper) => {
      const { document } = helper.editor
      const isInSet = typeof charSet === 'function' ? charSet : getCharSetFunction(charSet, document)
      let col = active.character
      const text = document.lineAt(active.line).text
      if (col >= text.length) {
        // A charset object cannot contain line break, therefore the cursor active
        // is not within any such object.
        return RemoveSelection
      }
      while (isInSet(text.charCodeAt(col))) {
        col += direction
        if (col < 0 || col >= text.length) return active.with(undefined, col - direction)
      }
      if (col === active.character) {
        // The cursor active is on a character outside charSet.
        return RemoveSelection
      }
      if (includeTrailingWhitespace) {
        const isBlank = getCharSetFunction(CharSet.Blank, document)
        while (isBlank(text.charCodeAt(col))) {
          col += direction
          if (col < 0 || col >= text.length) return active.with(undefined, col - direction)
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

function sentenceObject() {
  // I bet that's the first time you see a Greek question mark used as an actual Greek question mark,
  // rather than as a "prank" semicolon.
  const punctCharCodes = new Uint32Array(Array.from('.!?¡§¶¿;՞。', ch => ch.charCodeAt(0)))

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

  // It is imposssible to determine if active is at leading or trailing or
  // in-sentence blank characters by just looking ahead. Therefore, we search
  // from the sentence start, which may be slightly less efficient but
  // always accurate.
  const scanFromStart = true
  const actions = objectActions(toCurrentStart, toEnd(false), toCurrentStart, toEnd(true), scanFromStart)

  // Special cases to allow jumping to the previous sentence when active is at
  // current sentence start / leading blank chars.
  const toBeforeBlankOrPrev = toBeforeBlank(true)
  actions.selectToStart.inner = actions.selectToStart.outer = {
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
  return actions
}

function paragraphObject() {
  const lookBack: CoordMapper = (active, helper) => {
    const { line } = active
    if (line > 0 && active.character === 0 &&
        helper.editor.document.lineAt(line - 1).text.length === 0) {
      return new Coord(line - 1, 0) // Re-anchor to the previous line.
    }
    return active
  }
  const lookAhead: CoordMapper = (active, helper) => {
    const { line } = active
    if (helper.editor.document.lineAt(line).text.length === 0)
      return new Coord(line + 1, 0)
    return active
  }

  const toCurrentStart: CoordMapper = (active, helper) => {
    const { document } = helper.editor
    let { line } = active

    // Move past any trailing empty lines.
    while (line >= 0 && document.lineAt(line).text.length === 0) line--
    if (line <= 0) return DocumentStart

    // Then move to the start of the paragraph (non-empty lines).
    while (line > 0 && document.lineAt(line - 1).text.length > 0) line--
    return new Coord(line, 0)
  }

  function toEnd(inner: boolean): CoordMapper {
    return (active, helper) => {
      const { document } = helper.editor
      let { line } = active

      // Move to the end of the paragraph (non-empty lines)
      while (line < document.lineCount && document.lineAt(line).text.length > 0)
        line++
      if (line >= document.lineCount) return helper.lastCoord()
      if (inner) {
        if (line > 0) line--
        return new Coord(line, document.lineAt(line).text.length)
      }

      // Then move to the last trailing empty line.
      while (line + 1 < document.lineCount && document.lineAt(line + 1).text.length === 0)
        line++
      return new Coord(line, document.lineAt(line).text.length)
    }
  }

  function selectToEdge(direction: Direction, adjust: CoordMapper, toEdge: CoordMapper) {
    return {
      extend: moveActiveCoord((oldActive, helper, i) => {
        const adjusted = adjust(oldActive, helper, i)
        if ('remove' in adjusted) return RemoveSelection
        if (direction === Forward &&
            helper.editor.document.lineAt(adjusted.line).text.length === 0)
          return toEdge(new Coord(adjusted.line + 1, 0), helper, i)
        else
          return toEdge(adjusted, helper, i)
      }, Extend),
      doNotExtend: seekToRange((oldActive, helper, i) => {
        const anchor = adjust(oldActive, helper, i)
        if ('remove' in anchor) return RemoveSelection

        let active
        if (direction === Forward &&
            helper.editor.document.lineAt(anchor.line).text.length === 0)
          active = toEdge(new Coord(anchor.line + 1, 0), helper, i)
        else
          active = toEdge(anchor, helper, i)

        if ('remove' in active) return RemoveSelection
        return [anchor, active]
      }, DoNotExtend),
    }
  }

  function select(inner: boolean): SelectionMapper {
    const toEndFunc = toEnd(inner)
    return (selection, helper, i) => {
      let active = helper.activeCoord(selection)
      const { document } = helper.editor

      let start
      if (active.line + 1 < document.lineCount &&
          document.lineAt(active.line).text.length === 0 &&
          document.lineAt(active.line + 1).text.length) {
        // Special case: if current line is empty, check next line and select
        // the NEXT paragraph if next line is not empty.
        start = new Coord(active.line + 1, 0)
      } else {
        const startResult = toCurrentStart(active, helper, i)
        if ('remove' in startResult) return RemoveSelection
        start = startResult
      }
      // It's just much easier to check from start.
      const end = toEndFunc(start, helper, i)
      if ('remove' in end) return RemoveSelection
      return helper.selectionBetween(start, end)
    }
  }

  const selectToStart = selectToEdge(Backward, lookBack, toCurrentStart)
  return {
    select: {
      outer: select(/* inner = */ false),
      inner: select(/* inner = */ true),
    },
    selectToEnd: {
      outer: selectToEdge(Forward, lookAhead, toEnd(/* inner = */ false)),
      inner: selectToEdge(Forward, lookAhead, toEnd(/* inner = */ true)),
    },
    selectToStart: {
      outer: selectToStart,
      inner: selectToStart,
    },
  }
}

function whitespacesObject() {
  // The "inner" versions of a whitespaces object excludes all line breaks and
  // the "outer" versions includes line breaks as well. Unlike other objects,
  // there are no actual "surrounding" parts of objects.

  // The objectWithCharSet helper function can handle the inline whitespaces.
  const actions = objectWithCharSet(CharSet.Blank)

  // Let's then overwrite logic for "outer" actions to include line breaks.
  const toStart: CoordMapper = (active, helper) => {
    const { document } = helper.editor
    const isBlank = getCharSetFunction(CharSet.Blank, document)
    const afterSkip = skipWhileX(Backward, active, isBlank, document)
    if (!afterSkip) return DocumentStart
    if (afterSkip.isEqual(active)) return RemoveSelection
    return helper.nextPos(afterSkip)
  }
  const toEnd: CoordMapper = (active, helper) => {
    const { document } = helper.editor
    const isBlank = getCharSetFunction(CharSet.Blank, document)
    const afterSkip = skipWhileX(Forward, active, isBlank, document)
    if (!afterSkip) return helper.lastCoord()
    if (afterSkip.isEqual(active)) return RemoveSelection
    return helper.prevPos(afterSkip)
  }
  actions.select.outer = (selection, helper, i) => {
    const active = helper.activeCoord(selection)
    const start = toStart(active, helper, i)
    const end = toEnd(active, helper, i)
    if ('remove' in start || 'remove' in end) return RemoveSelection
    return helper.selectionBetween(start, end)
  }
  actions.selectToStart.outer = {
    doNotExtend: moveActiveCoord(toStart, DoNotExtend),
    extend:      moveActiveCoord(toStart,      Extend),
  }
  actions.selectToEnd.outer = {
    doNotExtend: moveActiveCoord(toEnd,   DoNotExtend),
    extend:      moveActiveCoord(toEnd,        Extend),
  }
  return actions
}

function indentObject() {
  function toEdge(direction: Direction, inner: boolean): CoordMapper {
    return (oldActive, helper) => {
      const { document } = helper.editor
      let { line } = oldActive
      let lineObj = document.lineAt(line)

      // First, scan backwards through blank lines. (Note that whitespace-only
      // lines do not count -- those have a proper indentation level and should
      // be treated as the inner part of the indent block.)
      while (lineObj.text.length === 0) {
        line += direction
        if (line < 0) return DocumentStart
        if (line >= document.lineCount) return helper.lastCoord()
        lineObj = document.lineAt(line)
      }

      let indent = lineObj.firstNonWhitespaceCharacterIndex
      let lastNonBlankLine = line

      for (;;) {
        line += direction
        if (line < 0) return DocumentStart
        if (line >= document.lineCount) return helper.lastCoord()
        lineObj = document.lineAt(line)

        if (lineObj.text.length === 0) continue
        if (lineObj.firstNonWhitespaceCharacterIndex < indent) {
          const resultLine = inner ? lastNonBlankLine : line - direction
          if (direction === Forward && resultLine + 1 === document.lineCount)
            return helper.lastCoord()
          const resultCol = direction === Backward ? 0 : document.lineAt(resultLine).text.length
          return new Coord(resultLine, resultCol)
        }
        lastNonBlankLine = line
      }
    }
  }
  const toStart      = toEdge(Backward, false),
        toStartInner = toEdge(Backward,  true),
        toEnd        = toEdge(Forward,  false),
        toEndInner   = toEdge(Forward,   true)

  // When selecting a whole indent object, scanning separately toStart and then
  // toEnd will lead to wrong results like two different indentation levels and
  // skipping over blank lines more than needed. We can mitigate this by finding
  // the start first and then scan from there to find the end of indent block.
  const scanFromStart = true
  return objectActions(toStart, toEnd, toStartInner, toEndInner, scanFromStart)
}

function numberObject() {
  // TODO: Handle optional leading minus sign for numbers.
  const numberCharCodes = new Uint32Array(Array.from('0123456789.', ch => ch.charCodeAt(0)))

  // Numbers cannot have trailing whitespaces even for outer in Kakoune, and
  // let's match the behavior here.
  const actions = objectWithCharSet((charCode) => numberCharCodes.indexOf(charCode) >= 0)
  actions.select.outer = actions.select.inner
  actions.selectToEnd.outer = actions.selectToEnd.inner
  actions.selectToStart.outer = actions.selectToStart.inner
  return actions
}

function argumentObject() {
  function toEdge(direction: Direction, inner: boolean): CoordMapper {
    const paren = (direction === Backward ? LPAREN : RPAREN)
    return (oldActive, helper) => {
      const { document } = helper.editor
      let bbalance = 0,
          pbalance = 0
      const afterSkip = skipWhile(direction, oldActive, (charCode) => {
        // TODO: Kak does not care about strings or ignoring braces in strings
        // but maybe we should add a setting or an alternative command for that.
        if (charCode === paren && pbalance === 0 && bbalance === 0) {
          return false
        } else if (charCode === LPAREN) {
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
          return false
        }
        return true
      }, helper.editor.document)

      let end
      if (afterSkip === undefined) {
        end = direction === Backward ? DocumentStart : helper.lastCoord()
      } else {
        const charCode = document.lineAt(afterSkip.line).text.charCodeAt(afterSkip.character)
        // Make sure parens are not included in the object. Deliminator commas
        // after the argument is included as outer, but ones before are NOT.

        // TODO: Kakoune seems to have more sophisticated edge cases for commas,
        // e.g. outer last argument includes the comma before it, plus more edge
        // cases for who owns the whitespace. Those are not implemented for now
        // because they require extensive tests and mess a lot with the logic of
        // selecting the whole object.
        if (inner || charCode === paren || direction === Backward)
          end = direction === Backward ? helper.nextPos(afterSkip) : helper.prevPos(afterSkip)
        else
          end = afterSkip
      }
      if (!inner) return end
      const isBlank = getCharSetFunction(CharSet.Blank, document)
      // Exclude any surrounding whitespaces.
      end = skipWhileX(-direction, end, isBlank, helper.editor.document)
      if (!end)
        return direction === Backward ? DocumentStart : helper.lastCoord()
      return end
    }
  }

  const toStart      = toEdge(Backward, false),
        toStartInner = toEdge(Backward,  true),
        toEnd        = toEdge(Forward,  false),
        toEndInner   = toEdge(Forward,   true)
  return objectActions(toStart, toEnd, toStartInner, toEndInner)
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
  paragraph: paragraphObject(),
  whitespaces: whitespacesObject(),
  indent: indentObject(),
  number: numberObject(),
  argument: argumentObject(),
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
