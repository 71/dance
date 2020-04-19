import * as vscode from 'vscode'

import { CommandState, registerCommand, Command, CommandFlags, InputKind } from '.'
import { Extension } from '../extension'
import { SelectionSet } from '../utils/selectionSet'

function getRegister(state: CommandState<any>, ctx: Extension) {
  return state.currentRegister || ctx.registers.dquote
}

function deleteSelections(builder: vscode.TextEditorEdit, { selections }: SelectionSet) {
  for (let i = 0; i < selections.length; i++)
    builder.delete(selections[i].asRange())
}

registerCommand(Command.deleteYank, CommandFlags.Edit, async (editor, state, undoStops, ctx) => {
  const reg = getRegister(state, ctx)
  const selections = state.selectionSet

  if (reg.canWrite())
    await reg.set(editor, selections.map(selection => selection.getText()))

  await editor.edit(builder => deleteSelections(builder, selections), undoStops)
})

registerCommand(Command.deleteInsertYank, CommandFlags.Edit | CommandFlags.SwitchToInsertBefore, async (editor, state, undoStops, ctx) => {
  const reg = getRegister(state, ctx)
  const selections = state.selectionSet

  if (reg.canWrite())
    await reg.set(editor, selections.map(selection => selection.getText()))

  await editor.edit(builder => deleteSelections(builder, selections), undoStops)
})

registerCommand(Command.deleteNoYank, CommandFlags.Edit, (editor, { selectionSet: selections }, undoStops) => {
  return editor.edit(builder => deleteSelections(builder, selections), undoStops).then(() => undefined)
})

registerCommand(Command.deleteInsertNoYank, CommandFlags.Edit | CommandFlags.SwitchToInsertBefore, (editor, { selectionSet: selections }, undoStops) => {
  return editor.edit(builder => deleteSelections(builder, selections), undoStops).then(() => undefined)
})

registerCommand(Command.yank, CommandFlags.None, (editor, state, _, ctx) => {
  const reg = getRegister(state, ctx)

  if (reg.canWrite())
    return reg.set(editor, state.selectionSet.map(selection => selection.getText()))

  return undefined
})


async function getContentsToPaste(editor: vscode.TextEditor, state: CommandState<any>, ctx: Extension) {
  const yanked = await getRegister(state, ctx).get(editor)
  const amount = state.selectionSet.selections.length

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

registerCommand(Command.pasteAfter, CommandFlags.Edit, async (editor, state, undoStops, ctx) => {
  const selections = state.selectionSet.selections
  const contents = await getContentsToPaste(editor, state, ctx)

  if (contents === undefined)
    return

  const selectionLengths = [] as number[]

  await editor.edit(builder => {
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i],
            selection = selections[i]

      if (content.endsWith('\n'))
        builder.insert(new vscode.Position(selection.endLine + 1, 0), content)
      else
        builder.insert(selection.end.afterPosition() ?? selection.end.beforePosition(), content)

      selectionLengths.push(selection.length)
    }
  }, undoStops)

  // Restore selections that were extended automatically.
  for (let i = 0; i < contents.length; i++) {
    selections[i].length = selectionLengths[i]
  }

  state.selectionSet.commit(editor)
})

registerCommand(Command.pasteBefore, CommandFlags.Edit, async (editor, state, undoStops, ctx) => {
  const contents = await getContentsToPaste(editor, state, ctx)

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

registerCommand(Command.pasteSelectAfter, CommandFlags.ChangeSelections | CommandFlags.Edit, async (editor, state, undoStops, ctx) => {
  const contents = await getContentsToPaste(editor, state, ctx)

  if (contents === undefined)
    return

  const reverseSelection = [] as boolean[]

  await editor.edit(builder => {
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i],
            selection = editor.selections[i]

      if (content.endsWith('\n'))
        builder.insert(selection.end.with(selection.end.line + 1, 0), content)
      else
        builder.insert(selection.end, content)

      reverseSelection.push(selection.isEmpty)
    }
  }, undoStops)

  // Reverse selections that were empty, since they are now extended in the wrong way.
  for (let i = 0; i < contents.length; i++) {
    const content = contents[i]

    if (!content.endsWith('\n') && reverseSelection[i]) {
      state.selectionSet.selections[i].reverse()
    }
  }
})

registerCommand(Command.pasteSelectBefore, CommandFlags.ChangeSelections | CommandFlags.Edit, async (editor, state, undoStops, ctx) => {
  const contents = await getContentsToPaste(editor, state, ctx)

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

registerCommand(Command.pasteReplace, CommandFlags.Edit, async (editor, state, undoStops, ctx) => {
  const contents = await getContentsToPaste(editor, state, ctx)

  if (contents === undefined)
    return

  await editor.edit(builder => {
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i],
            selection = editor.selections[i]

      builder.replace(selection, content)
    }
  }, undoStops)
})

registerCommand(Command.pasteReplaceEvery, CommandFlags.Edit, async (editor, state, undoStops, ctx) => {
  const selections = state.selectionSet.selections
  const contents = await getRegister(state, ctx).get(editor)

  if (contents === undefined || contents.length !== selections.length)
    return

  await editor.edit(builder => {
    for (let i = 0; i < contents.length; i++)
      builder.replace(selections[i].asRange(), contents[i])
  }, undoStops)
})


registerCommand(Command.replaceCharacters, CommandFlags.Edit, InputKind.Key, undefined, async (editor, { currentCount, input: key }, undoStops) => {
  const string = key.repeat(currentCount || 1)

  await editor.edit(builder => {
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
  }, undoStops)
})
