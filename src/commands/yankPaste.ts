import * as vscode from 'vscode'

import { Command, CommandFlags, CommandState, InputKind, registerCommand, UndoStops } from '.'
import { Extension }       from '../state/extension'
import { SelectionHelper } from '../utils/selectionHelper'


function getRegister(state: CommandState<any>, ctx: Extension) {
  return state.currentRegister || ctx.registers.dquote
}

function deleteSelections(editor: vscode.TextEditor, undoStops: UndoStops) {
  return editor.edit(builder => {
    const selections = editor.selections,
          len = selections.length

    for (let i = 0; i < len; i++)
      builder.delete(selections[i])
  }, undoStops)
}

registerCommand(Command.deleteYank, CommandFlags.Edit, async ({ editor, extension }, state, undoStops) => {
  const reg = getRegister(state, extension)

  if (reg.canWrite())
    await reg.set(editor, editor.selections.map(editor.document.getText))

  await deleteSelections(editor, undoStops)
})

registerCommand(Command.deleteInsertYank, CommandFlags.Edit | CommandFlags.SwitchToInsertBefore, async ({ editor, extension }, state, undoStops) => {
  const reg = getRegister(state, extension)

  if (reg.canWrite())
    await reg.set(editor, editor.selections.map(editor.document.getText))

  await deleteSelections(editor, undoStops)
})

registerCommand(Command.deleteNoYank, CommandFlags.Edit, ({ editor }, _, undoStops) => {
  return deleteSelections(editor, undoStops).then(() => undefined)
})

registerCommand(Command.deleteInsertNoYank, CommandFlags.Edit | CommandFlags.SwitchToInsertBefore, ({ editor }, _, undoStops) => {
  return deleteSelections(editor, undoStops).then(() => undefined)
})

registerCommand(Command.yank, CommandFlags.None, ({ editor, extension }, state) => {
  const reg = getRegister(state, extension)

  if (reg.canWrite())
    return reg.set(editor, editor.selections.map(editor.document.getText))

  return undefined
})


async function getContentsToPaste(editor: vscode.TextEditor, state: CommandState<any>, ctx: Extension) {
  const yanked = await getRegister(state, ctx).get(editor)
  const amount = editor.selections.length

  if (yanked === undefined)
    return undefined

  const results = [] as string[],
        yankedLength = yanked.length

  let i = 0

  for (; i < amount && i < yankedLength; i++) {
    results.push(yanked[i])
  }

  for (; i < amount; i++) {
    results.push(yanked[yankedLength - 1])
  }

  return results
}

registerCommand(Command.pasteAfter, CommandFlags.Edit, async (editorState, state, undoStops) => {
  const { editor, extension } = editorState,
        selections = editor.selections,
        selectionHelper = SelectionHelper.for(editorState, state)

  const contents = await getContentsToPaste(editor, state, extension)

  if (contents === undefined)
    return

  const selectionLengths = [] as number[]

  await editor.edit(builder => {
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i],
            selection = selections[i]

      if (content.endsWith('\n'))
        builder.insert(new vscode.Position(selectionHelper.endLine(selection) + 1, 0), content)
      else
        builder.insert(selection.end, content)

      selectionLengths.push(selectionHelper.selectionLength(selection))
    }
  }, undoStops)

  // Restore selections that were extended automatically.
  for (let i = 0; i < contents.length; i++) {
    selections[i] = selectionHelper.selectionFromLength(selections[i].anchor, selectionLengths[i])
  }

  editor.selections = selections
})

registerCommand(Command.pasteBefore, CommandFlags.Edit, async ({ editor, extension }, state, undoStops) => {
  const contents = await getContentsToPaste(editor, state, extension)

  if (contents === undefined)
    return

  await editor.edit(builder => {
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i],
            selection = editor.selections[i]

      if (content.endsWith('\n'))
        builder.insert(selection.start.with(undefined, 0), content)
      else
        builder.insert(selection.start, content)
    }
  }, undoStops)
})

registerCommand(Command.pasteSelectAfter, CommandFlags.ChangeSelections | CommandFlags.Edit, async (editorState, state, undoStops) => {
  const { editor, extension } = editorState,
        contents = await getContentsToPaste(editor, state, extension)

  if (contents === undefined)
    return

  const reverseSelection = [] as boolean[],
        selectionHelper = SelectionHelper.for(editorState, state)

  await editor.edit(builder => {
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i],
            selection = editor.selections[i]

      if (content.endsWith('\n'))
        builder.insert(selection.end.with(selectionHelper.endLine(selection) + 1, 0), content)
      else
        builder.insert(selection.end, content)

      reverseSelection.push(selection.isEmpty)
    }
  }, undoStops)

  // Reverse selections that were empty, since they are now extended in the wrong way.
  for (let i = 0; i < contents.length; i++) {
    const content = contents[i]

    if (!content.endsWith('\n') && reverseSelection[i]) {
      editor.selections[i] = new vscode.Selection(editor.selections[i].active, editor.selections[i].anchor)
    }
  }

  // eslint-disable-next-line no-self-assign
  editor.selections = editor.selections  // Force update.
})

registerCommand(Command.pasteSelectBefore, CommandFlags.ChangeSelections | CommandFlags.Edit, async ({ editor, extension }, state, undoStops) => {
  const contents = await getContentsToPaste(editor, state, extension)

  if (contents === undefined)
    return

  await editor.edit(builder => {
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i],
            selection = editor.selections[i]

      if (content.endsWith('\n'))
        builder.replace(selection.start.with(undefined, 0), content)
      else
        builder.replace(selection.start, content)
    }
  }, undoStops)
})

registerCommand(Command.pasteReplace, CommandFlags.Edit, async ({ editor, extension }, state, undoStops) => {
  const contents = await getContentsToPaste(editor, state, extension)
  if (contents === undefined)
    return

  const reg = getRegister(state, extension)
  if (reg.canWrite())
    await reg.set(editor, editor.selections.map(editor.document.getText))

  await editor.edit(builder => {
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i],
            selection = editor.selections[i]

      builder.replace(selection, content)
    }
  }, undoStops)
})

registerCommand(Command.pasteReplaceEvery, CommandFlags.Edit, async ({ editor, extension }, state, undoStops) => {
  const selections = editor.selections
  const contents = await getRegister(state, extension).get(editor)

  if (contents === undefined || contents.length !== selections.length)
    return

  await editor.edit(builder => {
    for (let i = 0; i < contents.length; i++)
      builder.replace(selections[i], contents[i])
  }, undoStops)
})


registerCommand(Command.replaceCharacters, CommandFlags.Edit, InputKind.Key, () => void 0, ({ editor }, { repetitions, input: key }, undoStops) => {
  const string = key.repeat(repetitions)

  return editor.edit(builder => {
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
      while (++i < selection.end.line) {
        const line = editor.document.lineAt(i)

        builder.replace(line.range, string.repeat(line.text.length))
      }

      // Replace in last line
      const lastLine = editor.document.lineAt(i).range.with(undefined, selection.end)

      builder.replace(lastLine, string.repeat(lastLine.end.character - lastLine.start.character))
    }
  }, undoStops).then(() => void 0)
})
