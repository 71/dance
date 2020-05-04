import * as vscode from 'vscode'

import { Register } from '../registers'
import { EditorState } from '../state/editor'
import { Extension, Mode, SelectionBehavior } from '../state/extension'
import { keypress, prompt, promptInList, promptRegex } from '../utils/prompt'
import { Command } from '../../commands'

export import Command = Command

export const enum CommandFlags {
  /** No particular flags. */
  None = 0,

  /** Switch to normal mode after operation. */
  SwitchToNormal = 1 << 1,

  /** Switch to insert mode after operation before the cursor. */
  SwitchToInsertBefore = 1 << 2,

  /** Switch to insert mode after operation after the cursor. */
  SwitchToInsertAfter = 1 << 3,

  /** Restore previous mode after operation. */
  RestoreMode = 1 << 4,

  /** Ignores the command in history. */
  IgnoreInHistory = 1 << 5,

  /** Edits the content of the editor. */
  Edit = 1 << 6,

  /** Changes the current selections. */
  ChangeSelections = 1 << 7,

  /** Do not reset preferred columns for moving up and down. */
  DoNotResetPreferredColumns = 1 << 8,
}

export class CommandState<Input extends InputKind = any> {
  private readonly _followingChanges = [] as vscode.TextDocumentContentChangeEvent[]

  /**
   * The number of times that a command should be repeated.
   *
   * Equivalent to `currentCount === 0 ? 1 : currentCount`.
   */
  get repetitions() {
    const count = this.currentCount

    return count === 0 ? 1 : count
  }

  /**
   * The insert-mode changes that were recorded after invoking this command.
   */
  get followingChanges() {
    return this._followingChanges as readonly vscode.TextDocumentContentChangeEvent[]
  }

  readonly currentCount: number
  readonly currentRegister?: Register
  readonly selectionBehavior: SelectionBehavior

  constructor(
    readonly descriptor: CommandDescriptor<Input>,
    readonly input: InputTypeMap[Input],
    readonly extension: Extension,
    readonly argument: any,
  ) {
    this.currentCount = extension.currentCount
    this.currentRegister = extension.currentRegister
    this.selectionBehavior = extension.selectionBehavior
  }

  /**
   * Records the given changes as having happened after this command.
   */
  recordFollowingChanges(changes: readonly vscode.TextDocumentContentChangeEvent[]) {
    this._followingChanges.push(...changes)
  }
}

export interface UndoStops {
  readonly undoStopBefore: boolean
  readonly undoStopAfter: boolean
}

export type Action<Input extends InputKind> =
  //(editor: vscode.TextEditor, state: CommandState<Input>, undoStops: UndoStops, ctx: Extension) => void | Thenable<void | undefined>
  (editorState: EditorState, state: CommandState<Input>, undoStops: UndoStops) => void | Thenable<void | undefined>

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
  [InputKind.Text]: vscode.InputBoxOptions & {
    setup?: (editorState: EditorState) => void
    onDidCancel?: (editorState: EditorState) => void
  }
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
  async execute(editorState: EditorState, argument: any) {
    const { extension, editor } = editorState

    if (editor.selections.length === 0) {
      // Most commands won't work without any selection at all. So let's force
      // one. This mainly happens when document is empty.
      editor.selections = [new vscode.Selection(DocumentStart, DocumentStart)]
    }

    const flags = this.flags
    const cts = new vscode.CancellationTokenSource()

    extension.cancellationTokenSource?.cancel()
    extension.cancellationTokenSource = cts

    let input: InputTypeMap[Input] | undefined = undefined

    switch (this.input) {
      case InputKind.RegExp:
        if (typeof argument === 'object' && typeof argument.input === 'string')
          input = new RegExp(argument.input, this.inputDescr as string) as any
        else
          input = await promptRegex(this.inputDescr as string, cts.token) as any
        break
      case InputKind.ListOneItem:
        if (typeof argument === 'object' && typeof argument.input === 'string')
          input = argument.input
        else
          input = await promptInList(false, this.inputDescr as [string, string][], cts.token) as any
        break
      case InputKind.ListOneItemOrCount:
        if (typeof argument === 'object' && typeof argument.input === 'string')
          input = argument.input
        else if (extension.currentCount === 0)
          input = await promptInList(false, this.inputDescr as [string, string][], cts.token) as any
        else
          input = null as any
        break
      case InputKind.ListManyItems:
        if (typeof argument === 'object' && typeof argument.input === 'string')
          input = argument.input
        else
          input = await promptInList(true, this.inputDescr as [string, string][], cts.token) as any
        break
      case InputKind.Text:
        const inputDescr = this.inputDescr as InputDescrMap[InputKind.Text]

        if (inputDescr.setup !== undefined)
          inputDescr.setup(editorState)

        if (typeof argument === 'object' && typeof argument.input === 'string') {
          const error = await Promise.resolve(inputDescr.validateInput?.(argument.input))
          if (error) {
            vscode.window.showErrorMessage(error)
          }
          input = argument.input
        } else
          input = await prompt(inputDescr, cts.token) as any
        break
      case InputKind.Key:
        if (typeof argument === 'object' && typeof argument.input === 'string')
          input = argument.input
        else {
          const prevMode = editorState.mode

          editorState.setMode(Mode.Awaiting)
          input = await keypress(cts.token) as any
          editorState.setMode(prevMode)
        }
        break
    }

    if (this.input !== InputKind.None && input === undefined) {
      if ('onDidCancel' in this.inputDescr)
        this.inputDescr.onDidCancel?.(editorState)
      return
    }

    if ((this.flags & CommandFlags.ChangeSelections) && !(this.flags & (CommandFlags.DoNotResetPreferredColumns))) {
      editorState.preferredColumns.length = 0
    }

    const commandState = new CommandState<Input>(this, input as InputTypeMap[Input], extension, argument)

    editorState.ignoreSelectionChanges = true

    let result
    try {
      result = this.action(editorState, commandState, { undoStopBefore: true, undoStopAfter: true })
      if (result !== undefined) {
        if (typeof result === 'object' && typeof result.then === 'function')
          result = await result
      }
    } catch (e) {
      console.error(e.stack)
      throw e
    }

    if (flags & (CommandFlags.SwitchToInsertBefore | CommandFlags.SwitchToInsertAfter)) {
      // Ensure selections face the right way.
      const selections = editor.selections,
            len = selections.length,
            shouldBeReversed = (flags & CommandFlags.SwitchToInsertBefore) !== 0

      for (let i = 0; i < len; i++) {
        const selection = selections[i]

        selections[i] = selection.isReversed === shouldBeReversed
          ? selection
          : new vscode.Selection(selection.active, selection.anchor)
      }

      // Make selections empty.
      editorState.setMode(Mode.Insert)

      for (let i = 0; i < len; i++) {
        const position = flags & CommandFlags.SwitchToInsertBefore
          ? selections[i].start
          : selections[i].end

        selections[i] = new vscode.Selection(position, position)
      }

      editor.selections = selections
    } else if (flags & CommandFlags.SwitchToNormal) {
      editorState.setMode(Mode.Normal)
    }

    if (flags & CommandFlags.ChangeSelections) {
      // Scroll to cursor if needed
      const position = editor.selection.active

      editor.revealRange(new vscode.Range(position, position))
    }

    if (!this.command.startsWith('dance.count.'))
      extension.currentCount = 0

    if (remainingNormalCommands === 1) {
      remainingNormalCommands = 0

      editorState.setMode(Mode.Insert)
    } else if (remainingNormalCommands > 1) {
      remainingNormalCommands--
    }

    editorState.ignoreSelectionChanges = false
    editorState.recordCommand(commandState)
    editorState.normalizeSelections()
  }

  /**
   * Executes the given command using the given state.
   */
  static async execute<I extends InputKind>(editorState: EditorState, commandState: CommandState<I>) {
    const { editor } = editorState
    let result = commandState.descriptor.action(editorState, commandState, { undoStopBefore: true, undoStopAfter: true })

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
  static async executeMany(editorState: EditorState, commands: CommandState<any>[]) {
    // In a batch execution, we don't change modes, and some things are not prompted again.
    // Furthermore, a single entry is added to VS Code's history for the entire batch operation.
    let firstEditIdx = 0,
        lastEditIdx = commands.length - 1

    for (let i = 0; i < commands.length; i++)
      if (commands[i].descriptor.flags & CommandFlags.Edit) {
        firstEditIdx = i
        break
      }

    for (let i = commands.length - 1; i >= 0; i--)
      if (commands[i].descriptor.flags & CommandFlags.Edit) {
        lastEditIdx = i
        break
      }

    let currentMode = editorState.mode
    const { editor } = editorState

    for (let i = 0; i < commands.length; i++) {
      const commandState = commands[i],
            descriptor = commandState.descriptor
      const undoStops = { undoStopBefore: i === firstEditIdx, undoStopAfter: i === lastEditIdx }

      let result = descriptor.action(editorState, commandState, undoStops)

      if (result !== undefined) {
        if (typeof result === 'object' && typeof result.then === 'function')
          result = await result

        if (typeof result === 'function')
          await editor.edit(result, undoStops)
      }

      if (descriptor.flags & (CommandFlags.SwitchToInsertBefore | CommandFlags.SwitchToInsertAfter))
        currentMode = Mode.Insert
      else if (descriptor.flags & CommandFlags.SwitchToNormal)
        currentMode = Mode.Normal
    }

    editorState.setMode(currentMode)
  }

  register(extension: Extension) {
    return vscode.commands.registerCommand(this.command, (arg) => {
      const editor = vscode.window.activeTextEditor

      if (editor === undefined)
        return

      return this.execute(extension.getEditorState(editor).updateEditor(editor), arg)
    })
  }
}

export const commands: CommandDescriptor<any>[] = []

export const preferredColumnsPerEditor = new WeakMap<vscode.TextEditor, number[]>()
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
import './macros'
import './mark'
import './menus'
import './misc'
import './modes'
import './move'
import './pipe'
import './rotate'
import './search'
import './select'
import './selections'
import './selectObject'
import './yankPaste'import { DocumentStart } from '../utils/selectionHelper'

