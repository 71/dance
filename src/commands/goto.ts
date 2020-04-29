import * as fs     from 'fs'
import * as path   from 'path'
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, InputKind, CommandState } from '.'
import { Selection, ExtendBehavior, DoNotExtend, Extend } from '../utils/selectionSet'


const jumps: [string, string][] = [
  ['h', 'go to line start'],
  ['l', 'go to line end'],
  ['i', 'go to non-blank line start'],
  ['g', 'go to first line'],
  ['k', 'go to first line'],
  ['j', 'go to last line'],
  ['e', 'go to last char of last line'],
  ['t', 'go to the first displayed line'],
  ['c', 'go to the middle displayed line'],
  ['b', 'go to the last displayed line'],
  ['a', 'go to previous buffer'],
  ['f', 'go to file whose name is selected'],
  ['.', 'go to last buffer modification position'],
]

function executeGoto(gotoType: number, editor: vscode.TextEditor, state: CommandState, extend: ExtendBehavior) {
  switch (gotoType) {
    case 0: // go to line start
      executeGotoLine(state, extend, 'start')
      break

    case 1: // go to line end
      executeGotoLine(state, extend, 'end')
      break

    case 2: // go to non-blank line start
      executeGotoLine(state, extend, 'first')
      break

    case 3: // go to first line
    case 4: // go to first line
      executeGotoFirstLine(state, extend)
      break

    case 5: // go to last line
      executeGotoLastLine(state, extend)
      break

    case 6: // go to last char of last line
      executeGotoLastLine(state, extend, true)
      break

    case 7: // go to first displayed line
      executeGotoDisplayLine(editor, state, extend, 'top')
      break

    case 8: // go to middle displayed line
      executeGotoDisplayLine(editor, state, extend, 'center')
      break

    case 9: // go to last displayed line
      executeGotoDisplayLine(editor, state, extend, 'bottom')
      break

    case 10: // go to previous buffer
      break

    case 11: // go to file whose name is selected
      const basePath = path.dirname(editor.document.fileName)

      return new Promise<void>(resolve => fs.exists(basePath, exists => {
        if (!exists)
          return

        const selections = state.selectionSet.selections
        let remaining = selections.length

        for (const selection of selections) {
          const filename = selection.getText()
          const filepath = path.resolve(basePath, filename)

          fs.exists(filepath, exists => {
            if (exists)
              vscode.workspace.openTextDocument(filepath).then(vscode.window.showTextDocument)

            if (--remaining === 0)
              resolve()
          })
        }
      }))

    case 12: // go to last buffer modification position
      break
  }

  return
}

const pickGetCharacter = {
  first(x: Selection) {
    return x.active.textLine().firstNonWhitespaceCharacterIndex
  },
  end(x: Selection) {
    return x.active.textLine().text.length
  },
  start() {
    return 0
  },
  default() {
    return 0
  },
}

function executeGotoLine({ selectionSet }: CommandState, extend: ExtendBehavior, position: 'first' | 'end' | 'start' | 'default') {
  const getCharacter = pickGetCharacter[position]

  selectionSet.updateEach(selection => {
    selection.active.updateFromPosition(new vscode.Position(selection.activeLine, getCharacter(selection)))

    if (!extend)
      selection.collapseToActive()
  })
}

const pickNewLine = {
  top(editor: vscode.TextEditor) {
    return editor.visibleRanges[0].start.line
  },
  center(editor: vscode.TextEditor) {
    return (editor.visibleRanges[0].end.line + editor.visibleRanges[0].start.line) / 2
  },
  bottom(editor: vscode.TextEditor) {
    return editor.visibleRanges[0].end.line
  },
  default() {
    return 0
  },
}

function executeGotoDisplayLine(editor: vscode.TextEditor, { selectionSet }: CommandState, extend: ExtendBehavior, position: 'top' | 'center' | 'bottom' | 'default') {
  const newLine = pickNewLine[position](editor)

  if (extend) {
    selectionSet.updateEach(selection => {
      selection.active.update(newLine, 0)
    })
  } else {
    selectionSet.updateAll(selections => {
      selections.length = 1
      selections[0].active.update(newLine, 0)
      selections[0].anchor.update(newLine, 0)
    })
  }
}

function executeGotoFirstLine({ selectionSet }: CommandState, extend: boolean) {
  selectionSet.updateAll(selections => {
    const selection = selections[0]

    selection.active.toDocumentFirstCharacter()

    if (extend) {
      const newAnchor = selections
        .map(x => x.anchor)
        .reduce((furthestFromStart, current) => furthestFromStart.offset > current.offset ? furthestFromStart : current)

      selection.anchor.inheritPosition(newAnchor)
    } else {
      selection.collapseToActive()
    }

    selections.length = 1
  })
}

function executeGotoLastLine({ selectionSet }: CommandState, extend: ExtendBehavior, gotoLastChar: boolean = false) {
  selectionSet.updateAll(selections => {
    const selection = selections[0]

    if (gotoLastChar)
      selection.active.toDocumentLastCharacter()
    else
      selection.active.update(selectionSet.end.line - 1, 0)

    if (extend) {
      const newAnchor = selections
        .map(x => x.anchor)
        .reduce((furthestFromEnd, current) => furthestFromEnd.offset < current.offset ? furthestFromEnd : current)

      selection.anchor.inheritPosition(newAnchor)
    } else {
      selection.collapseToActive()
    }

    selections.length = 1
  })
}


registerCommand(Command.goto, CommandFlags.ChangeSelections, InputKind.ListOneItemOrCount, jumps, ({ editor }, state) => {
  if (state.input === null) {
    let line = state.currentCount - 1

    if (line >= editor.document.lineCount)
      line = editor.document.lineCount - 1

    state.selectionSet.updateAll(selections => {
      selections.length = 1
      selections[0].active.update(line, 0)
      selections[0].collapseToActive()
    })
  } else {
    executeGoto(state.input, editor, state, DoNotExtend)
  }
})

registerCommand(Command.gotoExtend, CommandFlags.ChangeSelections, InputKind.ListOneItemOrCount, jumps, ({ editor }, state) => {
  if (state.input === null) {
    let line = state.currentCount - 1

    if (line >= editor.document.lineCount)
      line = editor.document.lineCount - 1

    state.selectionSet.updateAll(selections => {
      selections.length = 1
      selections[0].active.update(line, 0)
    })
  } else {
    executeGoto(state.input, editor, state, Extend)
  }
})
