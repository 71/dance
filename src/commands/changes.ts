// Changes: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#changes
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, CommandState, InputKind } from '.'

import { Extension }                                  from '../extension'
import { keypress }                                   from '../utils/prompt'
import { getSelectionFromStart, getSelectionFromEnd } from '../utils/textInDocument'


function getRegister(state: CommandState<any>, ctx: Extension) {
  return state.currentRegister || ctx.registers.dquote
}

registerCommand(Command.deleteYank, CommandFlags.Edit, async (editor, state, _, ctx) => {
  const reg = getRegister(state, ctx)

  if (reg.canWrite())
    await reg.set(editor, editor.selections.map(x => editor.document.getText(x)))

  return (builder: vscode.TextEditorEdit) => {
    for (const selection of editor.selections)
      builder.delete(selection)
  }
})

registerCommand(Command.deleteInsertYank, CommandFlags.Edit | CommandFlags.SwitchToInsert, async (editor, state, _, ctx) => {
  const reg = getRegister(state, ctx)

  if (reg.canWrite())
    await reg.set(editor, editor.selections.map(x => editor.document.getText(x)))

  return (builder: vscode.TextEditorEdit) => {
    for (const selection of editor.selections)
      builder.delete(selection)
  }
})

registerCommand(Command.deleteNoYank, CommandFlags.Edit, editor => builder => {
  for (const selection of editor.selections)
    builder.delete(selection)
})

registerCommand(Command.deleteInsertNoYank, CommandFlags.Edit | CommandFlags.SwitchToInsert, editor => builder => {
  for (const selection of editor.selections)
    builder.delete(selection)
})

registerCommand(Command.yank, CommandFlags.None, (editor, state, _, ctx) => {
  const reg = getRegister(state, ctx)

  if (reg.canWrite())
    return reg.set(editor, editor.selections.map(x => editor.document.getText(x)))

  return undefined
})


function getContentToPaste(editor: vscode.TextEditor, state: CommandState<any>, ctx: Extension) {
  return getRegister(state, ctx)
    .get(editor)
    .then(reg => reg && reg[0] ? reg[0] : undefined)
}

registerCommand(Command.pasteAfter, CommandFlags.Edit, async (editor, state, _, ctx) => {
  const content = await getContentToPaste(editor, state, ctx)

  if (content === undefined)
    return undefined

  return (builder: vscode.TextEditorEdit) => {
    for (const selection of editor.selections)
      builder.insert(selection.end, content)
  }
})

registerCommand(Command.pasteBefore, CommandFlags.Edit, async (editor, state, _, ctx) => {
  const content = await getContentToPaste(editor, state, ctx)

  if (content === undefined)
    return

  return (builder: vscode.TextEditorEdit) => {
    for (const selection of editor.selections)
      builder.insert(selection.start, content)
  }
})

registerCommand(Command.pasteSelectAfter, CommandFlags.ChangeSelections | CommandFlags.Edit, async (editor, state, undoStops, ctx) => {
  const content = await getContentToPaste(editor, state, ctx)

  if (content === undefined)
    return

  const newSelections = [] as vscode.Selection[]

  await editor.edit(builder => {
    for (const selection of editor.selections) {
      builder.insert(selection.end, content)
      newSelections.push(getSelectionFromStart(editor.document, content, selection.end))
    }
  }, undoStops)

  editor.selections = newSelections
})

registerCommand(Command.pasteSelectBefore, CommandFlags.ChangeSelections | CommandFlags.Edit, async (editor, state, undoStops, ctx) => {
  const content = await getContentToPaste(editor, state, ctx)

  if (content === undefined)
    return

  const newSelections = [] as vscode.Selection[]

  await editor.edit(builder => {
    for (const selection of editor.selections) {
      builder.insert(selection.start, content)
      newSelections.push(getSelectionFromEnd(editor.document, content, selection.start))
    }
  }, undoStops)

  editor.selections = newSelections
})

registerCommand(Command.pasteReplace, CommandFlags.Edit, async (editor, state, _, ctx) => {
  const content = await getContentToPaste(editor, state, ctx)

  if (content === undefined)
    return

  return (builder: vscode.TextEditorEdit) => {
    for (const selection of editor.selections)
      builder.replace(selection, content)
  }
})

registerCommand(Command.pasteReplaceEvery, CommandFlags.Edit, async (editor, state, _, ctx) => {
  const contents = await getRegister(state, ctx).get(editor)

  if (contents === undefined || contents.length !== editor.selections.length)
    return

  return (builder: vscode.TextEditorEdit) => {
    for (let i = 0; i < contents.length; i++)
      builder.replace(editor.selections[i], contents[i])
  }
})


registerCommand(Command.replaceCharacters, CommandFlags.Edit, InputKind.Key, undefined, async (editor, { currentCount, input: key }) => {
  const string = key.repeat(currentCount || 1)

  return (builder: vscode.TextEditorEdit) => {
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
  }
})


registerCommand(Command.join, CommandFlags.Edit, () => {
  return vscode.commands.executeCommand('editor.action.joinLines')
})

registerCommand(Command.joinSelect, CommandFlags.ChangeSelections | CommandFlags.Edit, async (editor, _, undoStops) => {
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
  }, undoStops)

  editor.selections = newSelections
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
  return (builder: vscode.TextEditorEdit) => {
    const indent = editor.options.insertSpaces === true
                    ? ' '.repeat(editor.options.tabSize as number)
                    : '\t'

    for (const i of getSelectionsLines(editor.selections)) {
      if (ignoreEmpty && editor.document.lineAt(i).isEmptyOrWhitespace)
        continue

      builder.insert(new vscode.Position(i, 0), indent)
    }
  }
}

registerCommand(Command.indent         , CommandFlags.Edit, editor => indent(editor, true))
registerCommand(Command.indentWithEmpty, CommandFlags.Edit, editor => indent(editor, false))

function deindent(editor: vscode.TextEditor, currentCount: number, further: boolean) {
  return (builder: vscode.TextEditorEdit) => {
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
  }
}

registerCommand(Command.deindent       , CommandFlags.Edit, (editor, state) => deindent(editor, state.currentCount, false))
registerCommand(Command.deindentFurther, CommandFlags.Edit, (editor, state) => deindent(editor, state.currentCount, true))


registerCommand(Command.toLowerCase, CommandFlags.Edit, editor => builder => {
  const doc = editor.document

  for (const selection of editor.selections)
    builder.replace(selection, doc.getText(selection).toLocaleLowerCase())
})

registerCommand(Command.toUpperCase, CommandFlags.Edit, editor => builder => {
  const doc = editor.document

  for (const selection of editor.selections)
    builder.replace(selection, doc.getText(selection).toLocaleUpperCase())
})

registerCommand(Command.swapCase, CommandFlags.Edit, editor => builder => {
  const doc = editor.document

  for (const selection of editor.selections) {
    const text = doc
      .getText(selection)
      .split('')
      .map(x => {
        const loCase = x.toLocaleLowerCase()

        return loCase === x ? x.toLocaleUpperCase() : loCase
      })
      .join('')

    builder.replace(selection, text)
  }
})
