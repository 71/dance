// Movement: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, CommandState } from '.'
import { ExtendBehavior, Backward, Forward, DoNotExtend, Extend, Direction, Anchor } from '../utils/selectionSet'


// Move around (h, j, k, l, H, J, K, L, arrows, shift+arrows)
// ===============================================================================================

const preferredColumnsPerEditor = new WeakMap<vscode.TextEditor, number[]>()

function moveLeft(state: CommandState, editor: vscode.TextEditor, anchor: Anchor) {
  const offset = state.repetitions

  preferredColumnsPerEditor.delete(editor)

  let firstActiveLine = undefined as number | undefined,
      firstActiveColumn = 0,
      firstActiveOffset = 0

  state.selectionSet.updateEachPosition(anchor, active => {
    active.moveLeftOrGoUp(offset)

    if (firstActiveLine === undefined || firstActiveOffset > active.offset) {
      firstActiveLine = active.line
      firstActiveColumn = active.column
      firstActiveOffset = active.offset
    }
  })

  state.selectionSet.commit(editor)

  const firstActive = new vscode.Position(firstActiveLine!, firstActiveColumn)

  editor.revealRange(new vscode.Range(firstActive, firstActive))
}

function moveRight(state: CommandState, editor: vscode.TextEditor, anchor: Anchor) {
  const offset = state.repetitions

  preferredColumnsPerEditor.delete(editor)

  let lastActiveLine = undefined as number | undefined,
      lastActiveColumn = 0,
      lastActiveOffset = 0

  state.selectionSet.updateEachPosition(anchor, active => {
    active.moveRightOrGoDown(offset)

    if (lastActiveLine === undefined || lastActiveOffset < active.offset) {
      lastActiveLine = active.line
      lastActiveColumn = active.column
      lastActiveOffset = active.offset
    }
  })

  state.selectionSet.commit(editor)

  const lastActive = new vscode.Position(lastActiveLine!, lastActiveColumn)

  editor.revealRange(new vscode.Range(lastActive, lastActive))
}

function moveVertical(state: CommandState, editor: vscode.TextEditor, direction: Direction, anchor: Anchor) {
  const selections = state.selectionSet.selections,
        document = editor.document
  const diff = state.repetitions * direction
  const lastLine = document.lineCount - 1

  // Compute preferred columns.
  let preferredColumns = preferredColumnsPerEditor.get(editor)

  if (preferredColumns === undefined)
    preferredColumnsPerEditor.set(editor, preferredColumns = [])

  let revealLine = undefined as number | undefined,
      revealColumn = 0,
      revealOffset = 0

  if (preferredColumns.length !== selections.length) {
    preferredColumns.length = 0

    for (let i = 0; i < selections.length; i++) {
      preferredColumns.push(selections[i].active.column)
    }
  }

  // Replace selections.
  for (let i = 0; i < selections.length; i++) {
    const selection = selections[i]
    const { active } = selection
    const targetLine = selection.activeLine + diff

    if (targetLine < 0) {
      active.toDocumentFirstCharacter()
    } else if (targetLine > lastLine) {
      active.toDocumentLastCharacter()
    } else {
      active.update(targetLine, preferredColumns[i])
    }

    if (anchor !== Anchor.Extend)
      selection.collapseToActive()

    // Forward (going down): equivalent to active.isBefore(revealPosition).
    // Backward (going up) : equivalent to active.isAfter(revealPosition).
    if (revealLine === undefined || active.offset * direction < revealOffset * direction) {
      revealLine = active.line
      revealColumn = active.column
      revealOffset = active.offset
    }
  }

  state.selectionSet.commit(editor)

  const revealPosition = new vscode.Position(revealLine!, revealColumn)

  editor.revealRange(new vscode.Range(revealPosition, revealPosition))
}

// Move/extend left/down/up/right
registerCommand(Command.left       , CommandFlags.ChangeSelections, (editor, state) =>     moveLeft(state, editor,           Anchor.InheritActive))
registerCommand(Command.leftExtend , CommandFlags.ChangeSelections, (editor, state) =>     moveLeft(state, editor,           Anchor.Extend))
registerCommand(Command.right      , CommandFlags.ChangeSelections, (editor, state) =>    moveRight(state, editor,           Anchor.InheritActive))
registerCommand(Command.rightExtend, CommandFlags.ChangeSelections, (editor, state) =>    moveRight(state, editor,           Anchor.Extend))
registerCommand(Command.up         , CommandFlags.ChangeSelections, (editor, state) => moveVertical(state, editor, Backward, Anchor.InheritActive))
registerCommand(Command.upExtend   , CommandFlags.ChangeSelections, (editor, state) => moveVertical(state, editor, Backward, Anchor.Extend))
registerCommand(Command.down       , CommandFlags.ChangeSelections, (editor, state) => moveVertical(state, editor,  Forward, Anchor.InheritActive))
registerCommand(Command.downExtend , CommandFlags.ChangeSelections, (editor, state) => moveVertical(state, editor,  Forward, Anchor.Extend))


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
