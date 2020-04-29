// Movement: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, CommandState, preferredColumnsPerEditor } from '.'
import { ExtendBehavior, Backward, Forward, DoNotExtend, Extend, Direction } from '../utils/selectionSet'
import { SelectionHelper, Coord, MoveFunc, AtOrBefore } from '../utils/selectionHelper'
import { EditorState } from '../state/editor'


// Move around (h, j, k, l, H, J, K, L, arrows, shift+arrows)
// ===============================================================================================

const moveByOffset: (direction: Direction) => MoveFunc = (direction) => (from, helper) => {
  const toOffset = helper.offsetAt(from) + helper.state.repetitions * direction
  return { maybeAnchor: helper.coordAt(toOffset), active: AtOrBefore }
}

const moveByOffsetBackward  = moveByOffset(Backward)
const moveByOffsetForward = moveByOffset(Forward)

function moveHorizontal(state: CommandState, editorState: EditorState, direction: Direction, extend: ExtendBehavior) {
  const moveFunc = direction === Forward ? moveByOffsetForward : moveByOffsetBackward
  SelectionHelper.for(editorState, state).moveEach(moveFunc, extend)
  revealActiveTowards(direction, editorState.editor)
}

function revealActiveTowards(direction: Direction, editor: vscode.TextEditor) {
  let revealPosition = undefined as vscode.Position | undefined
  for (let i = 0; i < editor.selections.length; i++) {
    const activePosition = editor.selections[i].active

    if (revealPosition === undefined || revealPosition.compareTo(activePosition) * direction > 0)
      revealPosition = activePosition
  }
  editor.revealRange(new vscode.Range(revealPosition!, revealPosition!))
}

const moveByLine: (direction: Direction) => MoveFunc = (direction) => (from, helper, i) => {
  const targetLine = from.line + helper.state.repetitions * direction
  let actualLine = targetLine
  if (actualLine < 0)
    actualLine = 0
  else if (targetLine > helper.editor.document.lineCount - 1)
    actualLine = helper.editor.document.lineCount

  const lineLen = helper.editor.document.lineAt(actualLine).text.length
  if (lineLen === 0) {
    // Select the line break on an empty line.
    return { maybeAnchor: new Coord(actualLine, 0), active: AtOrBefore }
  }

  const preferredColumn = helper.editorState.preferredColumns![i]
  if (preferredColumn >= lineLen) {
    if (helper.allowNonDirectional)
      return { maybeAnchor: new Coord(actualLine, lineLen - 1), active: AtOrBefore }
    else
      return { maybeAnchor: new Coord(actualLine, lineLen), active: AtOrBefore }
  }
  return { maybeAnchor: new Coord(actualLine, preferredColumn), active: AtOrBefore }
}

const moveByLineBackward = moveByLine(Backward)
const moveByLineForward = moveByLine(Forward)

function moveVertical(state: CommandState, editorState: EditorState, direction: Direction, extend: ExtendBehavior) {
  const { editor, preferredColumns } = editorState,
        selectionHelper = SelectionHelper.for(editorState, state)

  if (preferredColumns.length === 0) {
    for (let i = 0; i < editor.selections.length; i++) {
      const column = selectionHelper.activeCoord(editor.selections[i]).character

      preferredColumns.push(column)
    }
  }

  const moveFunc = direction === Forward ? moveByLineForward : moveByLineBackward
  selectionHelper.moveEach(moveFunc, extend)
  revealActiveTowards(direction, editor)
}

// Move/extend left/down/up/right
registerCommand(Command.left       , CommandFlags.ChangeSelections, (editorState, state) => moveHorizontal(state, editorState, Backward, DoNotExtend))
registerCommand(Command.leftExtend , CommandFlags.ChangeSelections, (editorState, state) => moveHorizontal(state, editorState, Backward,      Extend))
registerCommand(Command.right      , CommandFlags.ChangeSelections, (editorState, state) => moveHorizontal(state, editorState,  Forward, DoNotExtend))
registerCommand(Command.rightExtend, CommandFlags.ChangeSelections, (editorState, state) => moveHorizontal(state, editorState,  Forward,      Extend))
registerCommand(Command.up         , CommandFlags.ChangeSelections | CommandFlags.DoNotResetPreferredColumns, (editorState, state) => moveVertical(state, editorState, Backward, DoNotExtend))
registerCommand(Command.upExtend   , CommandFlags.ChangeSelections | CommandFlags.DoNotResetPreferredColumns, (editorState, state) => moveVertical(state, editorState, Backward,      Extend))
registerCommand(Command.down       , CommandFlags.ChangeSelections | CommandFlags.DoNotResetPreferredColumns, (editorState, state) => moveVertical(state, editorState,  Forward, DoNotExtend))
registerCommand(Command.downExtend , CommandFlags.ChangeSelections | CommandFlags.DoNotResetPreferredColumns, (editorState, state) => moveVertical(state, editorState,  Forward,      Extend))


// Move up/down (ctrl-[bfud])
// ===============================================================================================

function scrollBy(iterations: number, to: 'up' | 'down', extend: ExtendBehavior, translation: number) {
  return vscode.commands.executeCommand('editorScroll', {
    to,
    by: 'line',
    value: iterations * translation,
    revealCursor: true,
    select: extend,
  }) as Promise<void>
}

function getHeight(editor: vscode.TextEditor) {
  const visibleRange = editor.visibleRanges[0]

  return visibleRange.end.line - visibleRange.start.line
}

registerCommand(Command.upPage            , CommandFlags.ChangeSelections, ({ editor }, { repetitions }) => scrollBy(repetitions,   'up', DoNotExtend, getHeight(editor)))
registerCommand(Command.upPageExtend      , CommandFlags.ChangeSelections, ({ editor }, { repetitions }) => scrollBy(repetitions,   'up',      Extend, getHeight(editor)))
registerCommand(Command.upHalfPage        , CommandFlags.ChangeSelections, ({ editor }, { repetitions }) => scrollBy(repetitions,   'up', DoNotExtend, getHeight(editor) / 2 | 0))
registerCommand(Command.upHalfPageExtend  , CommandFlags.ChangeSelections, ({ editor }, { repetitions }) => scrollBy(repetitions,   'up',      Extend, getHeight(editor) / 2 | 0))

registerCommand(Command.downPage          , CommandFlags.ChangeSelections, ({ editor }, { repetitions }) => scrollBy(repetitions, 'down', DoNotExtend, getHeight(editor)))
registerCommand(Command.downPageExtend    , CommandFlags.ChangeSelections, ({ editor }, { repetitions }) => scrollBy(repetitions, 'down',      Extend, getHeight(editor)))
registerCommand(Command.downHalfPage      , CommandFlags.ChangeSelections, ({ editor }, { repetitions }) => scrollBy(repetitions, 'down', DoNotExtend, getHeight(editor) / 2 | 0))
registerCommand(Command.downHalfPageExtend, CommandFlags.ChangeSelections, ({ editor }, { repetitions }) => scrollBy(repetitions, 'down',      Extend, getHeight(editor) / 2 | 0))
