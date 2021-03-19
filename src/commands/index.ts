import * as vscode from "vscode";

import { Register } from "../registers";
import { EditorState } from "../state/editor";
import { Extension, Mode, SelectionBehavior } from "../state/extension";
import { keypress, prompt, promptInList, promptRegex } from "../utils/prompt";
import { Command } from "../../commands";
import { DocumentStart } from "../utils/selectionHelper";

export import Command = Command;

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

  /** Allow the command to be run without an active editor. */
  CanRunWithoutEditor = 1 << 9,
}

export class CommandState<Input extends InputKind = any> {
  private readonly _followingChanges = [] as vscode.TextDocumentContentChangeEvent[];

  /**
   * The number of times that a command should be repeated.
   *
   * Equivalent to `currentCount === 0 ? 1 : currentCount`.
   */
  public get repetitions() {
    const count = this.currentCount;

    return count === 0 ? 1 : count;
  }

  /**
   * The insert-mode changes that were recorded after invoking this command.
   */
  public get followingChanges() {
    return this._followingChanges as readonly vscode.TextDocumentContentChangeEvent[];
  }

  public readonly currentCount: number;
  public readonly currentRegister?: Register;
  public readonly selectionBehavior: SelectionBehavior;

  public constructor(
    public readonly descriptor: CommandDescriptor<Input>,
    public readonly input: InputTypeMap[Input],
    public readonly extension: Extension,
    public readonly argument: any,
  ) {
    this.currentCount = extension.currentCount;
    this.currentRegister = extension.currentRegister;
    this.selectionBehavior = extension.selectionBehavior;
  }

  /**
   * Records the given changes as having happened after this command.
   */
  public recordFollowingChanges(changes: readonly vscode.TextDocumentContentChangeEvent[]) {
    this._followingChanges.push(...changes);
  }
}

export interface UndoStops {
  readonly undoStopBefore: boolean;
  readonly undoStopAfter: boolean;
}

export type Action<Input extends InputKind> = (
  editorState: EditorState,
  state: CommandState<Input>,
  undoStops: UndoStops,
) => void | Thenable<void | undefined>;

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
  readonly [InputKind.None]: void;
  readonly [InputKind.RegExp]: RegExp;
  readonly [InputKind.ListOneItem]: number;
  readonly [InputKind.ListManyItems]: number[];
  readonly [InputKind.Text]: string;
  readonly [InputKind.Key]: string;
  readonly [InputKind.ListOneItemOrCount]: number | null;
}

export interface InputDescrMap {
  readonly [InputKind.None]: undefined;
  readonly [InputKind.ListOneItem]: [string, string][];
  readonly [InputKind.ListManyItems]: [string, string][];
  readonly [InputKind.RegExp]: string;
  readonly [InputKind.Text]: vscode.InputBoxOptions & {
    readonly setup?: (editorState: EditorState) => void;
    readonly onDidCancel?: (editorState: EditorState) => void;
  };
  readonly [InputKind.Key]: undefined;
  readonly [InputKind.ListOneItemOrCount]: [string, string][];
}

/**
 * Defines a command's behavior, as well as its inputs.
 */
export class CommandDescriptor<Input extends InputKind = InputKind> {
  public constructor(
    public readonly command: Command,
    public readonly flags: CommandFlags,
    public readonly input: Input,
    public readonly inputDescr: (editorState: EditorState) => InputDescrMap[Input],
    public readonly action: Action<Input>,
  ) {
    Object.freeze(this);
  }

  /**
   * Returns the the input for the current command, after requesting it from the
   * user if the given argument does not already specify it.
   */
  public async getInput(
    editorState: EditorState,
    argument: any,
    cancellationToken?: vscode.CancellationToken,
  ): Promise<InputTypeMap[Input] | undefined> {
    let input: InputTypeMap[Input] | undefined;

    switch (this.input) {
    case InputKind.RegExp:
      if (typeof argument === "object" && argument?.input instanceof RegExp) {
        input = argument.input;
      } else if (typeof argument === "object" && typeof argument.input === "string") {
        input = new RegExp(argument.input, this.inputDescr(editorState) as string) as any;
      } else {
        input = await promptRegex(this.inputDescr(editorState) as string, cancellationToken) as any;
      }
      break;
    case InputKind.ListOneItem:
      if (typeof argument === "object" && typeof argument.input === "string") {
        input = argument.input;
      } else {
        input = await promptInList(
          false, this.inputDescr(editorState) as [string, string][], cancellationToken) as any;
      }
      break;
    case InputKind.ListOneItemOrCount:
      if (typeof argument === "object" && typeof argument.input === "string") {
        input = argument.input;
      } else if (editorState.extension.currentCount === 0) {
        input = await promptInList(
          false, this.inputDescr(editorState) as [string, string][], cancellationToken) as any;
      } else {
        input = null as any;
      }
      break;
    case InputKind.ListManyItems:
      if (typeof argument === "object" && typeof argument.input === "string") {
        input = argument.input;
      } else {
        input = await promptInList(
          true, this.inputDescr(editorState) as [string, string][], cancellationToken) as any;
      }
      break;
    case InputKind.Text:
      const inputDescr = this.inputDescr(editorState) as InputDescrMap[InputKind.Text];

      if (inputDescr.setup !== undefined) {
        inputDescr.setup(editorState);
      }

      if (typeof argument === "object" && typeof argument.input === "string") {
        const error = await Promise.resolve(inputDescr.validateInput?.(argument.input));
        if (error) {
          throw new Error(`invalid text input: ${error}`);
        }
        input = argument.input;
      } else {
        input = await prompt(inputDescr, cancellationToken) as any;
      }
      break;
    case InputKind.Key:
      if (typeof argument === "object" && typeof argument.input === "string") {
        input = argument.input;
      } else {
        const prevMode = editorState.mode;

        editorState.setMode(Mode.Awaiting);
        input = await keypress(cancellationToken) as any;
        editorState.setMode(prevMode);
      }
      break;
    }

    return input;
  }

  /**
   * Executes the command completely, prompting the user for input and saving
   * history entries if needed.
   */
  public async execute(editorState: EditorState, argument: any) {
    const { extension, editor } = editorState;

    if (editor.selections.length === 0) {
      // Most commands won't work without any selection at all. So let's force
      // one. This mainly happens when document is empty.
      editor.selections = [new vscode.Selection(DocumentStart, DocumentStart)];
    }

    const flags = this.flags;
    const cts = new vscode.CancellationTokenSource();

    extension.cancellationTokenSource?.cancel();
    extension.cancellationTokenSource = cts;

    const input = await this.getInput(editorState, argument, cts.token);

    if (this.input !== InputKind.None && input === undefined) {
      const inputDescr = this.inputDescr?.(editorState);

      if (typeof inputDescr === "object" && "onDidCancel" in inputDescr) {
        inputDescr.onDidCancel?.(editorState);
      }

      return;
    }

    if (
      this.flags & CommandFlags.ChangeSelections
      && !(this.flags & CommandFlags.DoNotResetPreferredColumns)
    ) {
      editorState.preferredColumns.length = 0;
    }

    const commandState = new CommandState<Input>(
      this,
      input as InputTypeMap[Input],
      extension,
      argument,
    );

    editorState.ignoreSelectionChanges = true;

    let result;
    try {
      result = this.action(editorState, commandState, {
        undoStopBefore: true,
        undoStopAfter: true,
      });
      if (result !== undefined) {
        if (typeof result === "object" && typeof result.then === "function") {
          result = await result;
        }
      }
    } catch (e) {
      let message = e;

      if (typeof e === "object" && e !== null && e.constructor === Error) {
        // Note that we purposedly do not use `instanceof` above to keep
        // prefixes like "SyntaxError:".
        message = e.message;
      }

      // Or show error in the status bar? VSCode does not have a way to dismiss
      // messages, but they recommend setting the status bar instead.
      // See: https://github.com/Microsoft/vscode/issues/2732
      vscode.window.showErrorMessage(`Error executing command "${this.command}": ${message}`);
      return;
    }

    if (flags & (CommandFlags.SwitchToInsertBefore | CommandFlags.SwitchToInsertAfter)) {
      // Ensure selections face the right way.
      const selections = editor.selections,
            len = selections.length,
            shouldBeReversed = (flags & CommandFlags.SwitchToInsertBefore) !== 0;

      for (let i = 0; i < len; i++) {
        const selection = selections[i];

        selections[i]
          = selection.isReversed === shouldBeReversed
            ? selection
            : new vscode.Selection(selection.active, selection.anchor);
      }

      // Make selections empty.
      editorState.setMode(Mode.Insert);

      for (let i = 0; i < len; i++) {
        const position = flags & CommandFlags.SwitchToInsertBefore
          ? selections[i].start
          : selections[i].end;

        selections[i] = new vscode.Selection(position, position);
      }

      editor.selections = selections;
    } else if (flags & CommandFlags.SwitchToNormal) {
      editorState.setMode(Mode.Normal);
    }

    if (flags & CommandFlags.ChangeSelections) {
      // Scroll to cursor if needed
      const position = editor.selection.active;

      editor.revealRange(new vscode.Range(position, position));
    }

    if (!this.command.startsWith("dance.count.")) {
      extension.currentCount = 0;
    }

    if (remainingNormalCommands === 1) {
      remainingNormalCommands = 0;

      editorState.setMode(Mode.Insert);
    } else if (remainingNormalCommands > 1) {
      remainingNormalCommands--;
    }

    editorState.ignoreSelectionChanges = false;
    editorState.recordCommand(commandState);
    editorState.normalizeSelections();
  }

  /**
   * Executes the given command using the given state.
   */
  public static async execute<I extends InputKind>(
    editorState: EditorState,
    commandState: CommandState<I>,
  ) {
    const { editor } = editorState;
    let result = commandState.descriptor.action(editorState, commandState, {
      undoStopBefore: true,
      undoStopAfter: true,
    });

    if (result !== undefined) {
      if (typeof result === "object" && typeof result.then === "function") {
        result = await result;
      }

      if (typeof result === "function") {
        await editor.edit(result);
      }
    }
  }

  /**
   * Executes the given commands as part of a batch operation started by a
   * macro, for example.
   */
  public static async executeMany(
    editorState: EditorState,
    commands: readonly CommandState<any>[],
  ) {
    // In a batch execution, we don't change modes, and some things are not
    // prompted again.
    // Furthermore, a single entry is added to VS Code's history for the entire
    // batch operation.
    let firstEditIdx = 0,
        lastEditIdx = commands.length - 1;

    for (let i = 0; i < commands.length; i++) {
      if (commands[i].descriptor.flags & CommandFlags.Edit) {
        firstEditIdx = i;
        break;
      }
    }

    for (let i = commands.length - 1; i >= 0; i--) {
      if (commands[i].descriptor.flags & CommandFlags.Edit) {
        lastEditIdx = i;
        break;
      }
    }

    let currentMode = editorState.mode;
    const { editor } = editorState;

    for (let i = 0; i < commands.length; i++) {
      const commandState = commands[i],
            descriptor = commandState.descriptor;
      const undoStops = {
        undoStopBefore: i === firstEditIdx,
        undoStopAfter: i === lastEditIdx,
      };

      let result = descriptor.action(editorState, commandState, undoStops);

      if (result !== undefined) {
        if (typeof result === "object" && typeof result.then === "function") {
          result = await result;
        }

        if (typeof result === "function") {
          await editor.edit(result, undoStops);
        }
      }

      if (
        descriptor.flags
        & (CommandFlags.SwitchToInsertBefore | CommandFlags.SwitchToInsertAfter)
      ) {
        currentMode = Mode.Insert;
      } else if (descriptor.flags & CommandFlags.SwitchToNormal) {
        currentMode = Mode.Normal;
      }
    }

    editorState.setMode(currentMode);
  }

  public register(extension: Extension) {
    if (this.flags & CommandFlags.CanRunWithoutEditor) {
      return vscode.commands.registerCommand(this.command, (arg) => {
        const editor = vscode.window.activeTextEditor;

        if (editor === undefined) {
          // @ts-ignore
          return this.action(undefined, new CommandState(this, undefined, extension, arg));
        }

        return this.execute(extension.getEditorState(editor).updateEditor(editor), arg);
      });
    }

    return vscode.commands.registerCommand(this.command, (arg) => {
      const editor = vscode.window.activeTextEditor;

      if (editor === undefined) {
        return;
      }

      return this.execute(extension.getEditorState(editor).updateEditor(editor), arg);
    });
  }
}

export const commands: CommandDescriptor<any>[] = [];
export const commandsByName: Record<Command, CommandDescriptor<any>> = {} as any;

export const preferredColumnsPerEditor = new WeakMap<vscode.TextEditor, number[]>();
export let remainingNormalCommands = 0;

export function registerCommand(
  command: Command,
  flags: CommandFlags,
  action: Action<InputKind.None>,
): void;
export function registerCommand<Input extends InputKind>(
  command: Command,
  flags: CommandFlags,
  input: Input,
  inputDescr: (editorState: EditorState) => InputDescrMap[Input],
  action: Action<Input>,
): void;

export function registerCommand(...args: readonly any[]) {
  const descriptor = args.length === 3
    ? new CommandDescriptor(args[0], args[1], InputKind.None, () => void 0, args[2])
    : new CommandDescriptor(args[0], args[1], args[2], args[3], args[4]);

  commands.push(descriptor);
  commandsByName[args[0] as Command] = descriptor;
}

export function setRemainingNormalCommands(remaining: number) {
  remainingNormalCommands = remaining + 1;
  //                                  ^^^ to account for the currently
  //                                      executing command.
}

import "./changes";
import "./count";
import "./goto";
import "./history";
import "./insert";
import "./macros";
import "./mark";
import "./menus";
import "./misc";
import "./modes";
import "./move";
import "./pipe";
import "./rotate";
import "./search";
import "./select";
import "./selections";
import "./selectObject";
import "./yankPaste";

Object.freeze(commandsByName);
