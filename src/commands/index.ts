import * as vscode from 'vscode'

import { Command }   from '../../commands'
import { Extension } from '../extension'
import { Register }  from '../registers'

import { SelectionSet }                          from '../utils/selections'
import { keypress, prompt, promptInList, promptRegex } from '../utils/prompt'

export import Command = Command

export const enum Mode {
  Disabled = 'disabled',

  Normal = 'normal',
  Insert = 'insert',

  Awaiting = 'awaiting',
}

export const enum CommandFlags {
  /** No particular flags. */
  None = 0,

  /** Switch to normal mode after operation. */
  SwitchToNormal = 1 << 1,

  /** Switch to insert mode after operation. */
  SwitchToInsert = 1 << 2,

  /** Restore previous mode after operation. */
  RestoreMode = 1 << 3,

  /** Ignores the command in history. */
  IgnoreInHistory = 1 << 4,

  /** Edits the content of the editor. */
  Edit = 1 << 5,

  /** Changes the current selections. */
  ChangeSelections = 1 << 6,
}

export class CommandState<Input extends InputKind = any> {
  /**
   * The number of times that a command should be repeated.
   *
   * Equivalent to `currentCount === 0 ? 1 : currentCount`.
   */
  get repetitions() {
    const count = this.currentCount

    return count === 0 ? 1 : count
  }

  constructor(
    readonly selectionSet: SelectionSet,
    readonly currentCount: number,
    readonly currentRegister: Register | undefined,
    readonly input: InputTypeMap[Input],
  ) {}
}

export type Action<Input extends InputKind> =
  (editor: vscode.TextEditor, state: CommandState<Input>, undoStops: { undoStopBefore: boolean, undoStopAfter: boolean }, ctx: Extension) => void | Thenable<void | undefined>

export const enum InputKind {
  None,

  RegExp,
  ListOneItem,
  ListManyItems,
  Text,
  Key,
  ListOneItemOrCount,
}

export interface InputTypeMap {
  [InputKind.None]: void
  [InputKind.RegExp]: RegExp
  [InputKind.ListOneItem]: number
  [InputKind.ListManyItems]: number[]
  [InputKind.Text]: string
  [InputKind.Key]: string
  [InputKind.ListOneItemOrCount]: number | null
}

export interface InputDescrMap {
  [InputKind.None]: undefined
  [InputKind.ListOneItem]: [string, string][]
  [InputKind.ListManyItems]: [string, string][]
  [InputKind.RegExp]: string
  [InputKind.Text]: vscode.InputBoxOptions & { setup?: (editor: vscode.TextEditor, selections: SelectionSet, extension: Extension) => void }
  [InputKind.Key]: undefined
  [InputKind.ListOneItemOrCount]: [string, string][]
}

/**
 * Defines a command's behavior, as well as its inputs.
 */
export class CommandDescriptor<Input extends InputKind = InputKind> {
  constructor(
    readonly command: Command,
    readonly flags  : CommandFlags,
    readonly input  : Input,
    readonly inputDescr: InputDescrMap[Input],
    readonly action : Action<Input>,
  ) {}

  /**
   * Executes the command completely, prompting the user for input and saving history entries if needed.
   */
  async execute(state: Extension, editor: vscode.TextEditor) {
    const history = state.history.for(editor.document)
    const flags = this.flags
    const selectionSet = state.getSelectionsForEditor(editor)

    let input: InputTypeMap[Input] | undefined = undefined

    switch (this.input) {
      case InputKind.RegExp:
        input = await promptRegex(this.inputDescr as string) as any
        break
      case InputKind.ListOneItem:
        input = await promptInList(false, this.inputDescr as [string, string][]) as any
        break
      case InputKind.ListOneItemOrCount:
        if (state.currentCount === 0)
          input = await promptInList(false, this.inputDescr as [string, string][]) as any
        else
          input = null as any
        break
      case InputKind.ListManyItems:
        input = await promptInList(true, this.inputDescr as [string, string][]) as any
        break
      case InputKind.Text:
        const inputDescr = this.inputDescr as InputDescrMap[InputKind.Text]

        if (inputDescr.setup !== undefined)
          inputDescr.setup(editor, selectionSet, state)

        input = await prompt(inputDescr) as any
        break
      case InputKind.Key:
        const prevMode = state.getMode()

        await state.setMode(Mode.Awaiting)
        input = await keypress() as any
        await state.setMode(prevMode)

        break
    }

    if (this.input !== InputKind.None && input === undefined)
      return

    const commandState = new CommandState<Input>(selectionSet, state.currentCount, state.currentRegister, input as any)

    if (!(flags & CommandFlags.IgnoreInHistory))
      history.addCommand(this, commandState)

    state.ignoreSelectionChanges = true

    let result = this.action(editor, commandState, { undoStopBefore: true, undoStopAfter: true }, state)

    if (result !== undefined) {
      if (typeof result === 'object' && typeof result.then === 'function')
        result = await result
    }

    if (flags & CommandFlags.SwitchToInsert) {
      await state.setMode(Mode.Insert)
    } else if (flags & CommandFlags.SwitchToNormal) {
      await state.setMode(Mode.Normal)
    }

    if (flags & CommandFlags.ChangeSelections) {
      // Scroll to cursor if needed
      const position = editor.selection.active
      editor.revealRange(new vscode.Range(position, position))
    }

    if (!this.command.startsWith('dance.count.'))
      state.currentCount = 0

    if (remainingNormalCommands === 1) {
      remainingNormalCommands = 0

      await state.setMode(Mode.Insert)
    } else if (remainingNormalCommands > 1) {
      remainingNormalCommands--
    }

    state.ignoreSelectionChanges = false
    state.normalizeSelections(editor)
  }

  /**
   * Executes the given command using the given state.
   */
  static async execute<I extends InputKind>(state: Extension, editor: vscode.TextEditor, descr: CommandDescriptor<I>, commandState: CommandState<I>) {
    let result = descr.action(editor, commandState, { undoStopBefore: true, undoStopAfter: true }, state)

    if (result !== undefined) {
      if (typeof result === 'object' && typeof result.then === 'function')
        result = await result

      if (typeof result === 'function')
        await editor.edit(result)
    }
  }

  /**
   * Executes the given commands as part of a batch operation started by a macro, for example.
   */
  static async executeMany(state: Extension, editor: vscode.TextEditor, commands: [CommandDescriptor, CommandState<any>][]) {
    // In a batch execution, we don't change modes, and some things are not prompted again.
    // Furthermore, a single entry is added to VS Code's history for the entire batch operation.
    let firstEditIdx = 0,
        lastEditIdx = commands.length - 1

    for (let i = 0; i < commands.length; i++)
      if (commands[i][0].flags & CommandFlags.Edit) {
        firstEditIdx = i
        break
      }

    for (let i = commands.length - 1; i >= 0; i--)
      if (commands[i][0].flags & CommandFlags.Edit) {
        lastEditIdx = i
        break
      }

    let currentMode = state.modeMap.get(editor.document) || Mode.Normal

    for (let i = 0; i < commands.length; i++) {
      const [descr, commandState] = commands[i]
      const undoStops = { undoStopBefore: i === firstEditIdx, undoStopAfter: i === lastEditIdx }

      let result = descr.action(editor, commandState, undoStops, state)

      if (result !== undefined) {
        if (typeof result === 'object' && typeof result.then === 'function')
          result = await result

        if (typeof result === 'function')
          await editor.edit(result, undoStops)
      }

      if (descr.flags & CommandFlags.SwitchToInsert)
        currentMode = Mode.Insert
      else if (descr.flags & CommandFlags.SwitchToNormal)
        currentMode = Mode.Normal
    }

    await state.setMode(currentMode)
  }

  register(state: Extension) {
    return vscode.commands.registerCommand(this.command, () => {
      const editor = vscode.window.activeTextEditor

      if (editor === undefined)
        return

      return this.execute(state, editor)
    })
  }
}

export const commands: CommandDescriptor<any>[] = []

export let remainingNormalCommands = 0

export function registerCommand(command: Command, flags: CommandFlags, action: Action<InputKind.None>): void
export function registerCommand<Input extends InputKind>(command: Command, flags: CommandFlags, input: Input, inputDescr: InputDescrMap[Input], action: Action<Input>): void

export function registerCommand() {
  if (arguments.length === 3) {
    commands.push(new CommandDescriptor(arguments[0], arguments[1], InputKind.None, undefined, arguments[2]))
  } else {
    commands.push(new CommandDescriptor(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4]))
  }
}

export function setRemainingNormalCommands(remaining: number) {
  remainingNormalCommands = remaining + 1 // Gotta add 1 to account for the currently executing command
}


import './changes'
import './count'
import './goto'
import './history'
import './insert'
import './mark'
import './modes'
import './move'
import './pipe'
import './rotate'
import './search'
import './select'
import './selectObject'
import './yankPaste'
