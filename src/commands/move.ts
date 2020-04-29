// Movement: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, CommandState } from '.'
import { ExtendBehavior, Backward, Forward, DoNotExtend, Extend, Direction } from '../utils/selectionSet'
import { SelectionHelper, Coord, MoveFunc, AtOrBefore } from '../utils/selectionHelper'


// Move around (h, j, k, l, H, J, K, L, arrows, shift+arrows)
// ===============================================================================================

const preferredColumnsPerEditor = new WeakMap<vscode.TextEditor, number[]>()

const moveByOffset: (direction: Direction) => MoveFunc = (direction) => (from, helper) => {
  const toOffset = helper.offsetAt(from) + helper.state.repetitions * direction
  return { maybeAnchor: helper.coordAt(toOffset), active: AtOrBefore }
}

const moveByOffsetBackward  = moveByOffset(Backward)
const moveByOffsetForward = moveByOffset(Forward)

function moveHorizontal(state: CommandState, editor: vscode.TextEditor, direction: Direction, extend: ExtendBehavior) {
  preferredColumnsPerEditor.delete(editor)
  const moveFunc = direction === Forward ? moveByOffsetForward : moveByOffsetBackward
  SelectionHelper.for(editor, state).moveEach(moveFunc, extend)
  revealActiveTowards(direction, editor)
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

  const preferredColumn = preferredColumnsPerEditor.get(helper.editor)![i]
  if (preferredColumn >= lineLen) {
    if (helper.state.allowEmptySelections)
      return { maybeAnchor: new Coord(actualLine, lineLen), active: AtOrBefore }
    else
      return { maybeAnchor: new Coord(actualLine, lineLen - 1), active: AtOrBefore }
  }
  return { maybeAnchor: new Coord(actualLine, preferredColumn), active: AtOrBefore }
}

const moveByLineBackward = moveByLine(Backward)
const moveByLineForward = moveByLine(Forward)

function moveVertical(state: CommandState, editor: vscode.TextEditor, direction: Direction, extend: ExtendBehavior) {
  let preferredColumns = preferredColumnsPerEditor.get(editor)
  const selectionHelper = SelectionHelper.for(editor, state)

  if (preferredColumns === undefined)
    preferredColumnsPerEditor.set(editor, preferredColumns = [])

  if (preferredColumns.length !== editor.selections.length) {
    preferredColumns.length = 0
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
registerCommand(Command.left       , CommandFlags.ChangeSelections, (editor, state) => moveHorizontal(state, editor, Backward, DoNotExtend))
registerCommand(Command.leftExtend , CommandFlags.ChangeSelections, (editor, state) => moveHorizontal(state, editor, Backward,      Extend))
registerCommand(Command.right      , CommandFlags.ChangeSelections, (editor, state) => moveHorizontal(state, editor,  Forward, DoNotExtend))
registerCommand(Command.rightExtend, CommandFlags.ChangeSelections, (editor, state) => moveHorizontal(state, editor,  Forward,      Extend))
registerCommand(Command.up         , CommandFlags.ChangeSelections, (editor, state) =>   moveVertical(state, editor, Backward, DoNotExtend))
registerCommand(Command.upExtend   , CommandFlags.ChangeSelections, (editor, state) =>   moveVertical(state, editor, Backward,      Extend))
registerCommand(Command.down       , CommandFlags.ChangeSelections, (editor, state) =>   moveVertical(state, editor,  Forward, DoNotExtend))
registerCommand(Command.downExtend , CommandFlags.ChangeSelections, (editor, state) =>   moveVertical(state, editor,  Forward,      Extend))


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

registerCommand(Command.upPage            , CommandFlags.ChangeSelections, (editor, { repetitions }) => scrollBy(repetitions,   'up', DoNotExtend, getHeight(editor)))
registerCommand(Command.upPageExtend      , CommandFlags.ChangeSelections, (editor, { repetitions }) => scrollBy(repetitions,   'up',      Extend, getHeight(editor)))
registerCommand(Command.upHalfPage        , CommandFlags.ChangeSelections, (editor, { repetitions }) => scrollBy(repetitions,   'up', DoNotExtend, getHeight(editor) / 2 | 0))
registerCommand(Command.upHalfPageExtend  , CommandFlags.ChangeSelections, (editor, { repetitions }) => scrollBy(repetitions,   'up',      Extend, getHeight(editor) / 2 | 0))

registerCommand(Command.downPage          , CommandFlags.ChangeSelections, (editor, { repetitions }) => scrollBy(repetitions, 'down', DoNotExtend, getHeight(editor)))
registerCommand(Command.downPageExtend    , CommandFlags.ChangeSelections, (editor, { repetitions }) => scrollBy(repetitions, 'down',      Extend, getHeight(editor)))
registerCommand(Command.downHalfPage      , CommandFlags.ChangeSelections, (editor, { repetitions }) => scrollBy(repetitions, 'down', DoNotExtend, getHeight(editor) / 2 | 0))
registerCommand(Command.downHalfPageExtend, CommandFlags.ChangeSelections, (editor, { repetitions }) => scrollBy(repetitions, 'down',      Extend, getHeight(editor) / 2 | 0))
