// Objects: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#object-selection

import { registerCommand, Command, CommandFlags } from '.'
import { Direction, Forward, Backward, SelectionHelper, RemoveSelection, CoordMapper, SelectionMapper, moveActiveCoord, DoNotExtend, Extend } from '../utils/selectionHelper'
import { getCharSetFunction, CharSet } from '../utils/charset'
import { findMatching } from './select'

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
  // TODO: sentence
  // TODO: paragraph
  // TODO: whitespaces
  // TODO: indent
  // TODO: number
  // TODO: argument
  // TODO: custom
}

// I bet that's the first time you see a Greek question mark used as an actual Greek question mark,
// rather than as a "prank" semicolon.
const punctCharCodes = new Uint32Array(Array.from('.!?¡§¶¿;՞。', ch => ch.charCodeAt(0)))

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

  return objectActions(toStart, toEnd, toStartInner, toEndInner)
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

// TODO
registerCommand(Command.objectsSelectRepeat, CommandFlags.ChangeSelections, () => {
  // TODO: Or repeat the last t/f selection.

})
