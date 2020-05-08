// Movement: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, CommandState, preferredColumnsPerEditor } from '.'
import { ExtendBehavior, Backward, Forward, DoNotExtend, Extend, Direction, SelectionMapper, jumpTo } from '../utils/selectionHelper'
import { SelectionHelper, Coord } from '../utils/selectionHelper'
import { EditorState } from '../state/editor'
import { SelectionBehavior } from '../state/extension'


// Move around (h, j, k, l, H, J, K, L, arrows, shift+arrows)
// ===============================================================================================

function revealActiveTowards(direction: Direction, editor: vscode.TextEditor) {
  let revealPosition = undefined as vscode.Position | undefined
  for (let i = 0; i < editor.selections.length; i++) {
    const activePosition = editor.selections[i].active

    if (revealPosition === undefined || revealPosition.compareTo(activePosition) * direction > 0)
      revealPosition = activePosition
  }
  editor.revealRange(new vscode.Range(revealPosition!, revealPosition!))
}

function registerMoveHorizontal(command: Command, direction: Direction, extend: ExtendBehavior) {
  const selectionMapper = jumpTo((from, helper) => {
    return helper.coordAt(helper.offsetAt(from) + helper.state.repetitions * direction)
  }, extend)

  registerCommand(command, CommandFlags.ChangeSelections, (editorState, state) => {
    SelectionHelper.for(editorState, state).mapEach(selectionMapper)
    revealActiveTowards(direction, editorState.editor)
  })
}

function registerMoveVertical(command: Command, direction: Direction, extend: ExtendBehavior) {
  const selectionMapper = jumpTo((from, helper, i) => {
    const targetLine = from.line + helper.state.repetitions * direction
    let actualLine = targetLine
    if (actualLine < 0)
      actualLine = 0
    else if (targetLine > helper.editor.document.lineCount - 1)
      actualLine = helper.editor.document.lineCount - 1

    const lineLen = helper.editor.document.lineAt(actualLine).text.length
    if (lineLen === 0) {
      // Select the line break on an empty line.
      return new Coord(actualLine, 0)
    }

    const preferredColumn = helper.editorState.preferredColumns![i]
    if (preferredColumn >= lineLen) {
      if (helper.selectionBehavior === SelectionBehavior.Character)
        return new Coord(actualLine, lineLen - 1)
      else
        return new Coord(actualLine, lineLen)
    }
    return new Coord(actualLine, preferredColumn)
  }, extend)

  registerCommand(command, CommandFlags.ChangeSelections | CommandFlags.DoNotResetPreferredColumns, (editorState, state) => {
    const { editor, preferredColumns } = editorState,
          selectionHelper = SelectionHelper.for(editorState, state)

    if (preferredColumns.length === 0) {
      for (let i = 0; i < editor.selections.length; i++) {
        const column = selectionHelper.activeCoord(editor.selections[i]).character

        preferredColumns.push(column)
      }
    }
    SelectionHelper.for(editorState, state).mapEach(selectionMapper)
    revealActiveTowards(direction, editorState.editor)
  })
}

// Move/extend left/down/up/right

registerMoveHorizontal(Command.left       , Backward, DoNotExtend)
registerMoveHorizontal(Command.leftExtend , Backward,      Extend)
registerMoveHorizontal(Command.right      ,  Forward, DoNotExtend)
registerMoveHorizontal(Command.rightExtend,  Forward,      Extend)
registerMoveVertical(  Command.up         , Backward, DoNotExtend)
registerMoveVertical(  Command.upExtend   , Backward,      Extend)
registerMoveVertical(  Command.down       ,  Forward, DoNotExtend)
registerMoveVertical(  Command.downExtend ,  Forward,      Extend)

// Move up/down (ctrl-[bfud])
// ===============================================================================================

function scrollBy(iterations: number, to: 'up' | 'down', translation: number) {
  return vscode.commands.executeCommand('editorScroll', {
    to,
    by: 'line',
    value: iterations * translation,
    revealCursor: true,
  }) as Promise<void>
}

function getHeight(editor: vscode.TextEditor) {
  const visibleRange = editor.visibleRanges[0]

  return visibleRange.end.line - visibleRange.start.line
}

registerCommand(Command.upPage            , CommandFlags.ChangeSelections, ({ editor }, { repetitions }) => scrollBy(repetitions,   'up', getHeight(editor)))
registerCommand(Command.upHalfPage        , CommandFlags.ChangeSelections, ({ editor }, { repetitions }) => scrollBy(repetitions,   'up', getHeight(editor) / 2 | 0))
registerCommand(Command.downPage          , CommandFlags.ChangeSelections, ({ editor }, { repetitions }) => scrollBy(repetitions, 'down', getHeight(editor)))
registerCommand(Command.downHalfPage      , CommandFlags.ChangeSelections, ({ editor }, { repetitions }) => scrollBy(repetitions, 'down', getHeight(editor) / 2 | 0))
