import * as vscode from 'vscode'
import * as path   from 'path'
import * as fs     from 'fs'

import { registerCommand, Command, CommandFlags, InputKind, subscriptions } from '.'


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

// Map of editor to vscode.Position that was last edit position.
const lastLocations = new Map<vscode.TextEditor, vscode.Position>()

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
      const p = lastLocations.get(editor)
      if (p === undefined)
        break
      executeGotoPosition(editor, extend, p)
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
  executeGotoPosition(editor, extend, new vscode.Position(0,0))
}

function executeGotoLastLine(editor: vscode.TextEditor, extend: boolean, gotoLastChar: boolean = false) {
  const lastLine = editor.document.lineCount - 1
  const npos = new vscode.Position(lastLine, gotoLastChar ? editor.document.lineAt(lastLine).range.end.character : 0)
  executeGotoPosition(editor, extend, npos)
}

function executeGotoPosition(editor: vscode.TextEditor, extend: boolean, npos: vscode.Position) {
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

subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
  const change = e.contentChanges[e.contentChanges.length - 1];
  if (!change) {
    return;
  }

  // Look at all the TextEditors that have this document.
  vscode.window.visibleTextEditors.filter(editor => {
    return editor.document === e.document
  }).forEach(e => {
    // For all editors that have this document, if they are not tracked, add
    // them to the list with a default start position.
    if (!lastLocations.has(e)) {
      lastLocations.set(e, new vscode.Position(0, 0))
    }
  })
  const start = change.range.start
  const p = new vscode.Position(start.line, start.character + change.text.length)
  // Now update the editors that have this document with the latest position.
  lastLocations.forEach((_, editor) => {
    if (editor.document === e.document) {
      lastLocations.set(editor, p)
    }
  })
}))

subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(editors => {
  // Look through all tracked TextEditor objects. If we can't find a TextEditor
  // in the new list that was tracked earlier, remove it.
  lastLocations.forEach((_, e) => {
    if (!editors.includes(e)) {
      lastLocations.delete(e)
    }
  })
  editors.forEach(editor => {
    if (!lastLocations.has(editor)) {
      // New editor that is not tracked yet. Check if there are any editors
      // that have the same document open.
      for (const [e, pos] of lastLocations.entries()) {
        if (e.document === editor.document) {
          lastLocations.set(editor, pos)
          break
        }
      }
    }
  })
}))
