import * as vscode from 'vscode'
import * as path   from 'path'
import * as fs     from 'fs'

import { registerCommand, Command, CommandFlags, InputKind } from '.'

import { Extension } from '../extension'


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

function executeGoto(gotoType: number, editor: vscode.TextEditor, extend: boolean) {
  switch (gotoType) {
    case 0: // go to line start
      executeGotoLine(editor, extend, 'start')
      break

    case 1: // go to line end
      executeGotoLine(editor, extend, 'end')
      break

    case 2: // go to non-blank line start
      executeGotoLine(editor, extend, 'first')
      break

    case 3: // go to first line
    case 4: // go to first line
      executeGotoFirstLine(editor, extend)
      break

    case 5: // go to last line
      executeGotoLastLine(editor, extend)
      break

    case 6: // go to last char of last line
      executeGotoLastLine(editor, extend, true)
      break

    case 7: // go to first displayed line
      executeGotoDisplayLine(editor, extend, 'top')
      break

    case 8: // go to middle displayed line
      executeGotoDisplayLine(editor, extend, 'center')
      break

    case 9: // go to last displayed line
      executeGotoDisplayLine(editor, extend, 'bottom')
      break

    case 10: // go to previous buffer
      break

    case 11: // go to file whose name is selected
      const basePath = path.dirname(editor.document.fileName)

      return new Promise<void>(resolve => fs.exists(basePath, exists => {
        if (!exists)
          return

        let remaining = editor.selections.length

        for (const selection of editor.selections) {
          const filename = editor.document.getText(selection)
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

function executeGotoLine(editor: vscode.TextEditor, extend: boolean, position: 'first' | 'end' | 'start' | 'default') {
  const getCharacter = {
    first(x: vscode.Selection) {
      return editor.document.lineAt(x.active.line).firstNonWhitespaceCharacterIndex
    },
    end(x: vscode.Selection) {
      return editor.document.lineAt(x.active.line).range.end.character
    },
    start() {
      return 0
    },
    default() {
      return 0
    },
  }[position]

  editor.selections = editor.selections.map(x => {
    const npos = new vscode.Position(x.active.line, getCharacter(x))
    return new vscode.Selection(extend ? x.anchor : npos, npos)
  })
}

function executeGotoDisplayLine(editor: vscode.TextEditor, extend: boolean, position: 'top' | 'center' | 'bottom' | 'default') {
  const newLine = {
    top() {
      return editor.visibleRanges[0].start.line
    },
    center() {
      return (editor.visibleRanges[0].end.line + editor.visibleRanges[0].start.line) / 2
    },
    bottom() {
      return editor.visibleRanges[0].end.line
    },
    default() {
      return 0
    },
  }[position]()

  const newActive = new vscode.Position(newLine, 0)

  if (extend) {
    editor.selections = editor.selections.map(x => {
      return new vscode.Selection(x.anchor, newActive)
    })
  } else {
    editor.selections = [new vscode.Selection(newActive, newActive)]
  }
}

function executeGotoFirstLine(editor: vscode.TextEditor, extend: boolean) {
  const nanch = extend
    ? editor.selections.map(x => x.anchor).reduce((prev, current) => prev.isAfter(current) ? prev : current)
    : new vscode.Position(0, 0)

  editor.selections = [new vscode.Selection(nanch, new vscode.Position(0, 0))]
}

function executeGotoLastLine(editor: vscode.TextEditor, extend: boolean, gotoLastChar: boolean = false) {
  const lastLine = editor.document.lineCount - 1
  const npos = new vscode.Position(lastLine, gotoLastChar ? editor.document.lineAt(lastLine).range.end.character : 0)
  const nanch = extend
    ? editor.selections.map(x => x.anchor).reduce((prev, current) => (prev.isBefore(current) ? prev : current))
    : npos

  editor.selections = [new vscode.Selection(nanch, npos)]
}


registerCommand(Command.goto, CommandFlags.ChangeSelections, InputKind.ListOneItemOrCount, jumps, (editor, state, _, __) => {
  if (state.input === null) {
    let line = state.currentCount - 1

    if (line >= editor.document.lineCount)
      line = editor.document.lineCount - 1

    editor.selection = new vscode.Selection(new vscode.Position(line, 0), new vscode.Position(line, 0))

    return
  } else {
    return executeGoto(state.input, editor, false)
  }
})

registerCommand(Command.gotoExtend, CommandFlags.ChangeSelections, InputKind.ListOneItemOrCount, jumps, (editor, state, _, __) => {
  if (state.input === null) {
    let line = state.currentCount - 1

    if (line >= editor.document.lineCount)
      line = editor.document.lineCount - 1

    editor.selection = new vscode.Selection(editor.selection.anchor, new vscode.Position(line, 0))

    return
  } else {
    return executeGoto(state.input, editor, true)
  }
})
