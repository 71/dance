// Changes: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#changes
import * as vscode from 'vscode'

import { keypress, registerCommand, Command, Mode }   from '.'
import { Extension }                                  from '../extension'
import { getSelectionFromStart, getSelectionFromEnd } from '../utils/textInDocument'


function getRegister(state: Extension) {
  return state.currentRegister || state.registers.dquote
}

registerCommand(Command.deleteYank, (editor, state) => {
  editor.edit(builder => {
    const reg = getRegister(state)

    if (reg.canWrite())
      reg.set(editor.selections.map(x => editor.document.getText(x)))

    for (const selection of editor.selections)
      builder.delete(selection)
  })
})

registerCommand(Command.deleteInsertYank, (editor, state) => {
  editor.edit(builder => {
    const reg = getRegister(state)

    if (reg.canWrite())
      reg.set(editor.selections.map(x => editor.document.getText(x)))

    for (const selection of editor.selections)
      builder.delete(selection)
  }).then(() => state.setEditorMode(editor, Mode.Insert))
})

registerCommand(Command.deleteNoYank, editor => {
  editor.edit(builder => {
    for (const selection of editor.selections)
      builder.delete(selection)
  })
})

registerCommand(Command.deleteInsertNoYank, (editor, state) => {
  editor.edit(builder => {
    for (const selection of editor.selections)
      builder.delete(selection)
  }).then(() => state.setEditorMode(editor, Mode.Insert))
})

registerCommand(Command.yank, (editor, state) => {
  const reg = getRegister(state)

  if (reg.canWrite())
    reg.set(editor.selections.map(x => editor.document.getText(x)))
})


function getContentToPaste(editor: vscode.TextEditor, state: Extension) {
  const reg = getRegister(state).get(editor)

  return reg && reg[0] ? reg[0] : undefined
}

registerCommand(Command.pasteAfter, (editor, state) => {
  const content = getContentToPaste(editor, state)

  if (content === undefined)
    return

  editor.edit(builder => {
    for (const selection of editor.selections)
      builder.insert(selection.end, content)
  })
})

registerCommand(Command.pasteBefore, (editor, state) => {
  const content = getContentToPaste(editor, state)

  if (content === undefined)
    return

  editor.edit(builder => {
    for (const selection of editor.selections)
      builder.insert(selection.start, content)
  })
})

registerCommand(Command.pasteSelectAfter, async (editor, state) => {
  const content = getContentToPaste(editor, state)

  if (content === undefined)
    return

  const newSelections = [] as vscode.Selection[]

  await editor.edit(builder => {
    for (const selection of editor.selections) {
      builder.insert(selection.end, content)
      newSelections.push(getSelectionFromStart(editor.document, content, selection.end))
    }
  })

  editor.selections = newSelections
})

registerCommand(Command.pasteSelectBefore, async (editor, state) => {
  const content = getContentToPaste(editor, state)

  if (content === undefined)
    return

  const newSelections = [] as vscode.Selection[]

  await editor.edit(builder => {
    for (const selection of editor.selections) {
      builder.insert(selection.start, content)
      newSelections.push(getSelectionFromEnd(editor.document, content, selection.start))
    }
  })

  editor.selections = newSelections
})

registerCommand(Command.pasteReplace, (editor, state) => {
  const content = getContentToPaste(editor, state)

  if (content === undefined)
    return

  editor.edit(builder => {
    for (const selection of editor.selections)
      builder.replace(selection, content)
  })
})

registerCommand(Command.pasteReplaceEvery, (editor, state) => {
  const contents = getRegister(state).get(editor)

  if (contents === undefined || contents.length !== editor.selections.length)
    return

  editor.edit(builder => {
    for (let i = 0; i < contents.length; i++)
      builder.replace(editor.selections[i], contents[i])
  })
})


registerCommand(Command.replaceCharacters, async (editor, state) => {
  const key = await keypress()
  const string = key.repeat(state.currentCount || 1)

  editor.edit(builder => {
    for (const selection of editor.selections) {
      let i = selection.start.line

      if (selection.end.line === i) {
        // A single line-selection; replace the selection directly
        builder.replace(selection, string.repeat(selection.end.character - selection.start.character))

        continue
      }

      // Replace in first line
      const firstLine = editor.document.lineAt(i).range.with(selection.start)

      builder.replace(firstLine, string.repeat(firstLine.end.character - firstLine.start.character))

      // Replace in intermediate lines
      while (i < selection.end.line) {
        const line = editor.document.lineAt(i)

        builder.replace(line.range, string.repeat(line.text.length))
      }

      // Replace in last line
      const lastLine = editor.document.lineAt(i).range.with(undefined, selection.end)

      builder.replace(lastLine, string.repeat(lastLine.end.character - lastLine.start.character))
    }
  })
})


registerCommand(Command.join, () => {
  return vscode.commands.executeCommand('editor.action.joinLines')
})

registerCommand(Command.joinSelect, async editor => {
  const newSelections = [] as vscode.Selection[]

  await editor.edit(builder => {
    for (const selection of editor.selections) {
      let startLine = editor.document.lineAt(selection.start.line)
      let startPosition = startLine.range.start

      for (let i = selection.start.line; i <= selection.end.line; i++) {
        const line = editor.document.lineAt(i)
        const eol = new vscode.Range(line.range.end, line.rangeIncludingLineBreak.end)

        startPosition = startPosition.translate(0, line.range.end.character + (i === selection.start.line ? 0 : 1))

        builder.replace(eol, ' ')
        newSelections.push(new vscode.Selection(startPosition, startPosition.translate(0, 1)))
      }
    }
  })

  editor.selections = newSelections
})


registerCommand(Command.indent, (editor, state) => {
  editor.edit(builder => {
    const indent = editor.options.insertSpaces === true ? ' '.repeat(editor.options.tabSize as number) : '\t'

    for (const selection of editor.selections) {
      for (let i = selection.start.line; i <= selection.end.line; i++) {
        if (editor.document.lineAt(i).isEmptyOrWhitespace)
          continue

        builder.insert(new vscode.Position(i, 0), indent)
      }
    }
  })
})

registerCommand(Command.indentWithEmpty, (editor, state) => {
  editor.edit(builder => {
    const indent = editor.options.insertSpaces === true ? ' '.repeat(editor.options.tabSize as number) : '\t'

    for (const selection of editor.selections)
      for (let i = selection.start.line; i <= selection.end.line; i++)
        builder.insert(new vscode.Position(i, 0), indent)
  })
})

// registerCommand(Command.deindent, (editor, state) => {

// })

// registerCommand(Command.deindentWithEmpty, (editor, state) => {

// })
