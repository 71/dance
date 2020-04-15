// Changes: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#changes
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags } from '.'
import { Selection } from '../utils/selections'


registerCommand(Command.join, CommandFlags.Edit, () => {
  return vscode.commands.executeCommand('editor.action.joinLines')
})

registerCommand(Command.joinSelect, CommandFlags.ChangeSelections | CommandFlags.Edit, async (editor, { selectionSet }, undoStops) => {
  // Select all line endings.
  selectionSet.modify(editor, (selection, _, builder) => {
    const { startLine, endLine } = selection

    selection.anchor.updateForNewPosition(new vscode.Position(startLine, editor.document.lineAt(startLine).text.length))
    selection.active.updateForNewPosition(new vscode.Position(startLine + 1, 0))

    builder.push(selection)

    for (let line = startLine + 1; line < endLine; line++) {
      const { text } = editor.document.lineAt(line)

      const anchor = new vscode.Position(line, text.length),
            active = new vscode.Position(line + 1, 0)

      builder.push(Selection.from(selectionSet, new vscode.Selection(anchor, active)))
    }
  })

  // Replace all line endings by spaces.
  await editor.edit(builder => {
    for (const selection of selectionSet.selections) {
      builder.replace(selection.asRange(), ' ')
    }
  })
})


function getSelectionsLines(selections: vscode.Selection[]) {
  const lines: number[] = []

  for (const selection of selections) {
    const startLine = selection.start.line,
          endLine = selection.end.line

    // The first and last lines of the selection may contain other selections,
    // so we check for duplicates with them. However, the intermediate
    // lines are known to belong to one selection only, so there's no need
    // for that with them.
    if (lines.indexOf(startLine) === -1) lines.push(startLine)

    for (let i = startLine + 1; i < endLine; i++)
      lines.push(i)

    if (lines.indexOf(endLine) === -1) lines.push(endLine)
  }

  return lines
}

function indent(editor: vscode.TextEditor, ignoreEmpty: boolean) {
  return editor.edit(builder => {
    const indent = editor.options.insertSpaces === true
                    ? ' '.repeat(editor.options.tabSize as number)
                    : '\t'

    for (const i of getSelectionsLines(editor.selections)) {
      if (ignoreEmpty && editor.document.lineAt(i).isEmptyOrWhitespace)
        continue

      builder.insert(new vscode.Position(i, 0), indent)
    }
  }).then(() => undefined)
}

registerCommand(Command.indent         , CommandFlags.Edit, editor => indent(editor, true))
registerCommand(Command.indentWithEmpty, CommandFlags.Edit, editor => indent(editor, false))

function deindent(editor: vscode.TextEditor, currentCount: number, further: boolean) {
  return editor.edit(builder => {
    const doc = editor.document
    const tabSize = editor.options.tabSize as number

    // Number of blank characters needed to deindent:
    const needed = (currentCount || 1) * tabSize

    for (const i of getSelectionsLines(editor.selections)) {
      const line = doc.lineAt(i),
            text = line.text

      let column = 0,   // Column, accounting for tab size
          j      = 0    // Index in source line, and number of characters to remove

      for (; column < needed; j++) {
        const char = text[j]

        if (char === '\t') {
          column += tabSize
        } else if (char === ' ') {
          column++
        } else {
          break
        }
      }

      if (further && column === needed && j < text.length) {
        // TODO
      }

      if (j !== 0)
        builder.delete(line.range.with(undefined, line.range.start.translate(0, j)))
    }
  }).then(() => undefined)
}

registerCommand(Command.deindent       , CommandFlags.Edit, (editor, state) => deindent(editor, state.currentCount, false))
registerCommand(Command.deindentFurther, CommandFlags.Edit, (editor, state) => deindent(editor, state.currentCount, true))


registerCommand(Command.toLowerCase, CommandFlags.Edit, editor => editor.edit(builder => {
  const doc = editor.document

  for (const selection of editor.selections) {
    builder.replace(selection, doc.getText(selection).toLocaleLowerCase())
  }
}).then(() => undefined))

registerCommand(Command.toUpperCase, CommandFlags.Edit, editor => editor.edit(builder => {
  const doc = editor.document

  for (const selection of editor.selections) {
    builder.replace(selection, doc.getText(selection).toLocaleUpperCase())
  }
}).then(() => undefined))

registerCommand(Command.swapCase, CommandFlags.Edit, editor => editor.edit(builder => {
  const doc = editor.document

  for (const selection of editor.selections) {
    const text = doc.getText(selection)
    let builtText = ''

    for (let i = 0; i < text.length; i++) {
      const x = text[i],
            loCase = x.toLocaleLowerCase()

      builtText += loCase === x ? x.toLocaleUpperCase() : loCase
    }

    builder.replace(selection, builtText)
  }
}).then(() => undefined))
