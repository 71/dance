import * as vscode from 'vscode'

import { registerCommand, Command, CommandDescriptor, CommandFlags } from '.'
import { MacroRegister, Register } from '../registers'


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

const recording = new WeakMap<vscode.TextEditor, {
  reg: MacroRegister, lastHistoryEntry: number, sbi: vscode.StatusBarItem
}>()

registerCommand(Command.macrosRecordStart, CommandFlags.IgnoreInHistory, (editorState, { currentRegister, extension }) => {
  const { editor } = editorState
  const reg = currentRegister as any as (MacroRegister & Register) ?? extension.registers.arobase

  if (typeof reg.setMacro === 'function') {
    if (recording.has(editor))
      return

    const sbi = vscode.window.createStatusBarItem()

    sbi.command = Command.macrosRecordStop
    sbi.text = 'Macro recording in ' + reg.name
    sbi.show()

    recording.set(editor, { reg, lastHistoryEntry: editorState.recordedCommands.length, sbi })
  }
})

registerCommand(Command.macrosRecordStop, CommandFlags.SwitchToNormal | CommandFlags.IgnoreInHistory, (editorState) => {
  const { editor } = editorState
  const macro = recording.get(editor)

  if (macro !== undefined) {
    // TODO: Fix that, since entries get removed after recording a small number of them.
    const commands = editorState.recordedCommands.slice(macro.lastHistoryEntry)

    macro.reg.setMacro(commands.filter(x => !(x.descriptor.flags & CommandFlags.IgnoreInHistory)))
    macro.sbi.dispose()

    recording.delete(editor)
  }
})

registerCommand(Command.macrosPlay, CommandFlags.ChangeSelections | CommandFlags.Edit, (editorState, { currentRegister, extension, repetitions }) => {
  const reg = currentRegister as any as MacroRegister ?? extension.registers.arobase

  if (typeof reg.getMacro === 'function') {
    const commands = reg.getMacro()

    if (commands !== undefined) {
      for (let i = repetitions; i > 0; i--)
        CommandDescriptor.executeMany(editorState, commands)
    }
  }
})
