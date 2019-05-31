import * as vscode from 'vscode'

import { registerCommand, Command, CommandDescriptor, CommandFlags } from '.'
import { MacroRegister, Register } from '../registers'


registerCommand(Command.historyUndo, CommandFlags.ChangeSelections | CommandFlags.Edit | CommandFlags.IgnoreInHistory, () => {
  return vscode.commands.executeCommand('undo')
})

registerCommand(Command.historyRedo, CommandFlags.ChangeSelections | CommandFlags.Edit | CommandFlags.IgnoreInHistory, () => {
  return vscode.commands.executeCommand('redo')
})

registerCommand(Command.historyRepeat, CommandFlags.ChangeSelections | CommandFlags.Edit | CommandFlags.IgnoreInHistory, (editor, _, __, ctx) => {
  const history = ctx.history.for(editor.document)
  const commandPair = history.commands[history.commands.length - 1]

  if (commandPair === undefined)
    return

  return CommandDescriptor.execute(ctx, editor, ...commandPair)
})

registerCommand(Command.historyRepeatSelection, CommandFlags.ChangeSelections | CommandFlags.IgnoreInHistory, (editor, _, __, ctx) => {
  const history = ctx.history.for(editor.document)

  for (let i = history.commands.length - 1; i >= 0; i--) {
    const [descr, state] = history.commands[i]

    if (descr.flags & CommandFlags.ChangeSelections && !(descr.flags & CommandFlags.Edit))
      return CommandDescriptor.execute(ctx, editor, descr, state)
  }

  return undefined
})

registerCommand(Command.historyRepeatEdit, CommandFlags.Edit | CommandFlags.IgnoreInHistory, (editor, _, __, ctx) => {
  const history = ctx.history.for(editor.document)

  for (let i = history.commands.length - 1; i >= 0; i--) {
    const [descr, state] = history.commands[i]

    if (descr.flags & CommandFlags.Edit)
      return CommandDescriptor.execute(ctx, editor, descr, state)
  }

  return undefined
})

// registerCommand(Command.historyBackward, (editor, state) => {

// })

// registerCommand(Command.historyForward, (editor, state) => {

// })

const recording = new WeakMap<vscode.TextEditor, {
  reg: MacroRegister, lastHistoryEntry: number, sbi: vscode.StatusBarItem
}>()

registerCommand(Command.macrosRecordStart, CommandFlags.IgnoreInHistory, (editor, _, __, ctx) => {
  const reg = ctx.currentRegister as any as (MacroRegister & Register) || ctx.registers.arobase

  if (typeof reg.setMacro === 'function') {
    if (recording.has(editor))
      return

    const history = ctx.history.for(editor.document)
    const sbi = vscode.window.createStatusBarItem()

    sbi.command = Command.macrosRecordStop
    sbi.text = 'Macro recording in ' + reg.name
    sbi.show()

    recording.set(editor, { reg, lastHistoryEntry: history.commands.length, sbi })
  }
})

registerCommand(Command.macrosRecordStop, CommandFlags.IgnoreInHistory, (editor, _, __, ctx) => {
  const macro = recording.get(editor)

  if (macro !== undefined) {
    const history = ctx.history.for(editor.document)
    const commands = history.commands.slice(macro.lastHistoryEntry)

    macro.reg.setMacro(commands)
    macro.sbi.dispose()

    recording.delete(editor)
  }
})

registerCommand(Command.macrosPlay, CommandFlags.ChangeSelections | CommandFlags.Edit, (editor, state, _, ctx) => {
  const reg = ctx.currentRegister as any as MacroRegister || ctx.registers.arobase

  if (typeof reg.getMacro === 'function') {
    const commands = reg.getMacro()

    if (commands !== undefined) {
      for (let i = state.currentCount || 1; i > 0; i--)
        CommandDescriptor.executeMany(ctx, editor, commands)
    }
  }
})
