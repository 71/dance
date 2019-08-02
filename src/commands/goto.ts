import * as vscode from 'vscode'
import * as path   from 'path'
import * as fs     from 'fs'

import { registerCommand, Command, CommandDescriptor, CommandFlags, InputKind } from '.'


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

function executeGoto(gotoType: number, editor: vscode.TextEditor, count: number, extend: boolean) {
  switch (gotoType) {
    case 0: // go to line start
      editor.selections = editor.selections.map(x =>
        new vscode.Selection(extend ? x.anchor : x.active, new vscode.Position(x.active.line, 0)))
      break

    case 1: // go to line end
      editor.selections = editor.selections.map(x => {
        const line = editor.document.lineAt(x.active)

        return new vscode.Selection(extend ? x.anchor : x.active, line.range.end)
      })
      break

    case 2: // go to non-blank line start
      break

    case 3: // go to first line
    case 4: // go to first line
      break

    case 5: // go to last line
      break

    case 6: // go to last char of last line
      break

    case 7: // go to first displayed line
      break

    case 8: // go to middle displayed line
      break

    case 9: // go to last displayed line
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
              vscode.workspace.openTextDocument(filepath)

            if (--remaining === 0)
              resolve()
          })
        }
      }))

    case 12: // go to last buffer modification position
      break
  }
}

registerCommand(Command.goto, CommandFlags.ChangeSelections, InputKind.ListOneItem, jumps, (editor, state, _, __) => {
  return executeGoto(state.input, editor, state.currentCount, false)
})

registerCommand(Command.gotoExtend, CommandFlags.ChangeSelections, InputKind.ListOneItem, jumps, (editor, state, _, __) => {
  return executeGoto(state.input, editor, state.currentCount, true)
})
