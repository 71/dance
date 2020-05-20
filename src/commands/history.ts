import * as vscode from 'vscode'

import { registerCommand, Command, CommandDescriptor, CommandFlags } from '.'


registerCommand(Command.historyUndo, CommandFlags.ChangeSelections | CommandFlags.Edit | CommandFlags.IgnoreInHistory, () => {
  return vscode.commands.executeCommand('undo')
})

registerCommand(Command.historyRedo, CommandFlags.ChangeSelections | CommandFlags.Edit | CommandFlags.IgnoreInHistory, () => {
  return vscode.commands.executeCommand('redo')
})

registerCommand(Command.historyRepeat, CommandFlags.ChangeSelections | CommandFlags.Edit | CommandFlags.IgnoreInHistory, (editorState) => {
  const commands = editorState.recordedCommands

  if (commands.length === 0)
    return

  const lastCommandState = commands[commands.length - 1]

  return CommandDescriptor.execute(editorState, lastCommandState)
})

registerCommand(Command.historyRepeatSelection, CommandFlags.ChangeSelections | CommandFlags.IgnoreInHistory, (editorState) => {
  const commands = editorState.recordedCommands

  for (let i = commands.length - 1; i >= 0; i--) {
    const commandState = commands[i]

    if (commandState.descriptor.flags & CommandFlags.ChangeSelections && !(commandState.descriptor.flags & CommandFlags.Edit))
      return CommandDescriptor.execute(editorState, commandState)
  }

  return
})

registerCommand(Command.historyRepeatEdit, CommandFlags.Edit | CommandFlags.IgnoreInHistory, (editorState) => {
  const commands = editorState.recordedCommands

  for (let i = commands.length - 1; i >= 0; i--) {
    const commandState = commands[i]

    if (commandState.descriptor.flags & CommandFlags.Edit)
      return CommandDescriptor.execute(editorState, commandState)
  }

  return
})

const ObjectOrSelectToCommands = new Set([
  Command.objectsPerformSelection,
  Command.selectToExcluded,
  Command.selectToExcludedBackwards,
  Command.selectToExcludedExtend,
  Command.selectToExcludedExtendBackwards,
  Command.selectToIncluded,
  Command.selectToIncludedBackwards,
  Command.selectToIncludedExtend,
  Command.selectToIncludedExtendBackwards,
])

registerCommand(Command.repeatObjectOrSelectTo, CommandFlags.ChangeSelections, (editorState) => {
  const commands = editorState.recordedCommands

  for (let i = commands.length - 1; i >= 0; i--) {
    const commandState = commands[i]

    if (ObjectOrSelectToCommands.has(commandState.descriptor.command))
      return CommandDescriptor.execute(editorState, commandState)
  }

  return undefined
})
