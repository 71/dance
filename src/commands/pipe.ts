// Pipes: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#changes-through-external-programs
import * as vscode from 'vscode'
import * as execa  from 'execa'

import { Extension } from '../extension'
import { prompt }    from '../utils/prompt'

import { registerCommand, Command } from '.'


function execWithInput(command: string, input: string) {
  return execa(command, { input, shell: true, stripEof: true })
}

const promptCommand = (state: Extension) => prompt(state, {
  validateInput(input) {
    if (input.trim().length === 0)
      return 'The given command cannot be empty.'

    return undefined
  },

  prompt: 'Enter a command',
}) as Thenable<string | undefined>

const promptExecSelections = (state: Extension, editor: vscode.TextEditor) =>
  promptCommand(state).then(cmd =>
    cmd === undefined
      ? undefined
      : Promise.all(editor.selections.map(editor.document.getText).map(x => execWithInput(cmd, x.trim()))))

registerCommand(Command.pipeFilter, async (editor, state) => {
  const outputs = await promptExecSelections(state, editor)

  if (outputs === undefined)
    return

  // TODO: Handle stderr
  editor.selections = editor.selections.filter((_, i) => outputs[i].code === 0)
})

registerCommand(Command.pipeIgnore, async (editor, state) => {
  const outputs = await promptExecSelections(state, editor)

  if (outputs === undefined)
    return

  // TODO: Handle stderr
})

registerCommand(Command.pipeReplace, async (editor, state) => {
  const outputs = await promptExecSelections(state, editor)

  if (outputs === undefined)
    return

  // TODO: Handle stderr
  editor.edit(builder => {
    for (let i = 0; i < outputs.length; i++)
      builder.replace(editor.selections[i], outputs[i].stdout)
  })
})

registerCommand(Command.pipeAppend, async (editor, state) => {
  const outputs = await promptExecSelections(state, editor)

  if (outputs === undefined)
    return

  // TODO: Handle stderr
  editor.edit(builder => {
    for (let i = 0; i < outputs.length; i++)
      builder.insert(editor.selections[i].end, outputs[i].stdout)
  })
})

registerCommand(Command.pipePrepend, async (editor, state) => {
  const outputs = await promptExecSelections(state, editor)

  if (outputs === undefined)
    return

  // TODO: Handle stderr
  editor.edit(builder => {
    for (let i = 0; i < outputs.length; i++)
      builder.insert(editor.selections[i].start, outputs[i].stdout)
  })
})
