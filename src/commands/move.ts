// Movement: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, CommandState } from '.'
import { ExtendBehavior, Backward, Forward, DoNotExtend, Extend, Direction, Anchor } from '../utils/selectionSet'
import { MoveMode, SelectFunc, SkipFunc, SelectionHelper, Coord } from '../utils/selectionHelper'


// Move around (h, j, k, l, H, J, K, L, arrows, shift+arrows)
// ===============================================================================================

const preferredColumnsPerEditor = new WeakMap<vscode.TextEditor, number[]>()

const selectCurrent: SelectFunc = (from) => from

const skipByOffset: (direction: Direction) => SkipFunc = (direction) => (from, helper) => {
  const toOffset = helper.offsetAt(from) + helper.state.repetitions * direction
  return helper.coordAt(toOffset)
}

const skipByOffsetBackward: SkipFunc = skipByOffset(Backward)
const skipByOffsetForward: SkipFunc = skipByOffset(Forward)

function moveHorizontal(state: CommandState, editor: vscode.TextEditor, direction: Direction, extend: ExtendBehavior) {
  preferredColumnsPerEditor.delete(editor)
  const skip = direction === Forward ? skipByOffsetForward : skipByOffsetBackward
  SelectionHelper.for(editor, state).moveEach(MoveMode.To, skip, selectCurrent, extend)
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

const skipByLine: (direction: Direction) => SkipFunc = (direction) => (from, helper, i) => {
  const targetLine = from.line + helper.state.repetitions * direction

  if (targetLine < 0) {
    return helper.coordAt(0)
  } else if (targetLine > helper.editor.document.lineCount - 1) {
    return helper.editor.document.lineAt(helper.editor.document.lineCount - 1).range.end
  } else {
    const preferredColumns = preferredColumnsPerEditor.get(helper.editor)!
    return new Coord(targetLine, preferredColumns[i])
  }
}

const skipByLineBackward = skipByLine(Backward)
const skipByLineForward = skipByLine(Forward)

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

  const skip = direction === Forward ? skipByLineForward : skipByLineBackward
  selectionHelper.moveEach(MoveMode.To, skip, selectCurrent, extend)
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
