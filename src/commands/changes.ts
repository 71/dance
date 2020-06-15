// Changes: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#changes
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags } from '.'


registerCommand(Command.join, CommandFlags.Edit, () => {
  return vscode.commands.executeCommand('editor.action.joinLines').then(() => void 0)
})

registerCommand(Command.joinSelect, CommandFlags.ChangeSelections | CommandFlags.Edit, ({ editor }, _, undoStops) => {
  // Select all line endings.
  const selections = editor.selections,
        len = selections.length,
        newSelections = [] as vscode.Selection[],
        document = editor.document

  for (let i = 0; i < len; i++) {
    const selection = selections[i],
          startLine = selection.start.line,
          endLine = selection.end.line,
          startAnchor = new vscode.Position(startLine, Number.MAX_SAFE_INTEGER),
          startActive = new vscode.Position(startLine + 1, document.lineAt(startLine + 1).firstNonWhitespaceCharacterIndex)

    newSelections.push(new vscode.Selection(startAnchor, startActive))

    for (let line = startLine + 1; line < endLine; line++) {
      const anchor = new vscode.Position(line, Number.MAX_SAFE_INTEGER),
            active = new vscode.Position(line + 1, document.lineAt(line + 1).firstNonWhitespaceCharacterIndex)

      newSelections.push(new vscode.Selection(anchor, active))
    }
  }

  editor.selections = newSelections

  // Replace all line endings by spaces.
  return editor.edit(builder => {
    for (const selection of editor.selections) {
      builder.replace(selection, ' ')
    }
  }, undoStops).then(() => void 0)
})


function getSelectionsLines(selections: vscode.Selection[]) {
  const lines: number[] = []

  for (const selection of selections) {
    let startLine = selection.start.line,
        endLine = selection.end.line

    if (startLine !== endLine && selection.end.character === 0) {
      // If the selection ends after a line break, do not consider the next line
      // selected. This is because a selection has to end on the very first
      // caret position of the next line in order to select the last line break.
      // For example, `vscode.TextLine.rangeIncludingLineBreak` does this:
      // https://github.com/microsoft/vscode/blob/c8b27b9db6afc26cf82cf07a9653c89cdd930f6a/src/vs/workbench/api/common/extHostDocumentData.ts#L273
      endLine--
    }

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
  }).then(() => void 0)
}

registerCommand(Command.indent         , CommandFlags.Edit, ({ editor }) => indent(editor, true))
registerCommand(Command.indentWithEmpty, CommandFlags.Edit, ({ editor }) => indent(editor, false))

function deindent(editor: vscode.TextEditor, repetitions: number, further: boolean) {
  return editor.edit(builder => {
    const doc = editor.document
    const tabSize = editor.options.tabSize as number

    // Number of blank characters needed to deindent:
    const needed = repetitions * tabSize

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
  }).then(() => void 0)
}

registerCommand(Command.deindent       , CommandFlags.Edit, ({ editor }, { repetitions }) => deindent(editor, repetitions, false))
registerCommand(Command.deindentFurther, CommandFlags.Edit, ({ editor }, { repetitions }) => deindent(editor, repetitions, true))


registerCommand(Command.toLowerCase, CommandFlags.Edit, ({ editor }) => editor.edit(builder => {
  const doc = editor.document

  for (const selection of editor.selections) {
    builder.replace(selection, doc.getText(selection).toLocaleLowerCase())
  }
}).then(() => void 0))

registerCommand(Command.toUpperCase, CommandFlags.Edit, ({ editor }) => editor.edit(builder => {
  const doc = editor.document

  for (const selection of editor.selections) {
    builder.replace(selection, doc.getText(selection).toLocaleUpperCase())
  }
}).then(() => void 0))

registerCommand(Command.swapCase, CommandFlags.Edit, ({ editor }) => editor.edit(builder => {
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
}).then(() => void 0))
