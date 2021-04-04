import * as vscode from "vscode";
import { Command } from "../commands";
import { Context } from "./api";
import { CommandImplementation } from "./commands";
import { Register, Registers } from "./register";
import { EditorState } from "./state/editor";
import { Extension } from "./state/extension";
import { EditorRequiredError } from "./utils/errors";

const zeroPosition = new vscode.Position(0, 0),
      zeroSelection = new vscode.Selection(zeroPosition, zeroPosition);

/**
 * Defines a command's behavior, as well as its inputs.
 */
export class CommandDescriptor<A extends {} = {}> {
  private readonly _implementation: CommandImplementation<A>;

  /**
   * Whether the command requires an active `vscode.TextEditor` to run.
   */
  public readonly requiresActiveEditor: boolean;

  public constructor(
    /**
     * The identifier of the command.
     */
    public readonly command: Command,

    /**
     * The implementation of the command.
     */
    implementation: CommandImplementation<A>,
  ) {
    this._implementation = implementation;
    this.requiresActiveEditor = implementation.length === 2;

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

        delete argument.input;
      } else if (typeof argument === "object" && typeof argument.input === "string") {
        input = new RegExp(argument.input, this.inputDescr(editorState) as string) as any;
      } else {
        input = await promptRegex(this.inputDescr(editorState) as string, cancellationToken) as any;
      }
      break;
    case InputKind.ListOneItem:
      if (typeof argument === "object" && typeof argument.input === "string") {
        input = argument.input;

        delete argument.input;
      } else {
        input = await promptInList(
          false, this.inputDescr(editorState) as [string, string][], cancellationToken) as any;
      }
      break;
    case InputKind.ListOneItemOrCount:
      if (typeof argument === "object" && typeof argument.input === "string") {
        input = argument.input;

        delete argument.input;
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

        delete argument.input;
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

        delete argument.input;
      } else {
        input = await prompt(inputDescr, cancellationToken) as any;
      }
      break;
    case InputKind.Key:
      if (typeof argument === "object" && typeof argument.input === "string") {
        input = argument.input;

        delete argument.input;
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
   * Executes the command without an active text editor.
   */
  public async executeWithoutEditor(argument: any) {

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
      editor.selections = [zeroSelection];
    }

    const flags = this.flags;
    const cts = new vscode.CancellationTokenSource();

    extension.cancellationTokenSource?.cancel();
    extension.cancellationTokenSource = cts;

    if (
      this.flags & CommandFlags.ChangeSelections
      && !(this.flags & CommandFlags.DoNotResetPreferredColumns)
    ) {
      editorState.preferredColumns.length = 0;
    }

    const commandState = await CommandState.create(this, editorState, argument, cts.token);

    if (commandState === undefined) {
      return;
    }

    const context = new Context(editorState);

    if (!(this.flags & CommandFlags.DoNotResetCurrentState)) {
      extension.currentCount = 0;
      extension.currentRegister = undefined;
    }

    editorState.ignoreSelectionChanges = true;

    await extension.runPromiseSafely(
      async () => await this.implementation(editorState, commandState),
      () => undefined,
      (e) => `error executing command "${this.command}": ${e.message}`,
    );

    if (flags & CommandFlags.ChangeSelections) {
      // Scroll to cursor if needed
      const position = editor.selection.active;

      editor.revealRange(new vscode.Range(position, position));
    }

    editorState.ignoreSelectionChanges = false;
    editorState.recordCommand(commandState);
    editorState.normalizeSelections();
  }

  /**
   * Executes the given command using the given state.
   */
  public static async execute(
    editorState: EditorState,
    commandState: CommandState<I>,
  ) {
    const { editor } = editorState;
    let result: any = commandState.descriptor.action(editorState, commandState);

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
   * Executes the given commands together.
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

    const { editor } = editorState;

    for (let i = 0; i < commands.length; i++) {
      const commandState = commands[i],
            descriptor = commandState.descriptor;
      const undoStops = {
        undoStopBefore: i === firstEditIdx,
        undoStopAfter: i === lastEditIdx,
      };

      let result: any = descriptor.action(editorState, commandState);

      if (result !== undefined) {
        if (typeof result === "object" && typeof result.then === "function") {
          result = await result;
        }

        if (typeof result === "function") {
          await editor.edit(result, undoStops);
        }
      }
    }
  }

  /**
   * Registers the command in VS Code.
   */
  public register(extension: Extension) {
    if (!this.requiresActiveEditor) {
      return vscode.commands.registerCommand(this.command, (arg) => {
        const editor = vscode.window.activeTextEditor;

        if (editor === undefined) {
          return this.executeWithoutEditor(arg);
        }

        return this.execute(extension.getEditorState(editor).updateEditor(editor), arg);
      });
    }

    return vscode.commands.registerCommand(this.command, (arg) => {
      const editor = vscode.window.activeTextEditor;

      if (editor === undefined) {
        throw new EditorRequiredError();
      }

      return this.execute(extension.getEditorState(editor).updateEditor(editor), arg);
    });
  }
}

/**
 * A command that has finished executing and that can be inspected or replayed.
 */
export class RecordedCommand {
  public constructor(
    public readonly descriptor: CommandDescriptor,
    public readonly operations: readonly RecordedCommand.Operation[],

    public readonly argument: any,
    public readonly input: any,

    public readonly repetitions: number,
    public readonly register: Register | undefined,
  ) {
    Object.freeze(this);
  }
}

export namespace RecordedCommand {
  /**
   * The type of a recorded `Operation`.
   */
  export const enum OperationType {
    Command,
    ExternalCommand,
    SelectionChange,
    TextChange,
  }

  /**
   * A recorded operation.
   */
  export type Operation
    = readonly [t: OperationType.Command, command: RecordedCommand]
    | readonly [t: OperationType.ExternalCommand, commandId: string, commandArgs: any]
    | readonly [t: OperationType.SelectionChange, e: vscode.TextEditorSelectionChangeEvent]
    | readonly [t: OperationType.TextChange, e: vscode.TextDocumentContentChangeEvent];
}

const enum CommandContextFlags {
  None = 0,

  HasComputedInput = 1 << 0,
  IsIgnoredInHistory = 1 << 1,
}

export type Input<A extends {}> = A extends { readonly input: infer Input } ? Input : never;

/**
 * The context of execution of a command.
 */
export class CommandContext<A extends {} = {}> {
  private _flags = CommandContextFlags.None;

  private _count: number;
  private _input?: Input<A>;
  private _register?: Register;

  /**
   * The number of times that a command should be repeated, `> 0`.
   *
   * Equivalent to `count === 0 ? 1 : count`.
   */
  public get repetitions() {
    let count = this._count;

    if (count === 0) {
      this._count = count = 1;
    }

    return count;
  }

  /**
   * The specified count before executing the command, `>= 0`.
   */
  public get count() {
    return this._count;
  }

  public constructor(
    /**
     * The descriptor of the command being executed.
     */
    public readonly descriptor: CommandDescriptor,

    /**
     * The cancellation token used to cancel the command if needed.
     */
    public readonly cancellationToken: vscode.CancellationToken,

    /**
     * The state of the extension.
     */
    public readonly extensionState: Extension,

    /**
     * The user-given argument.
     */
    public readonly argument: A | undefined,
  ) {
    this._count = extensionState.currentCount;
    this._register = extensionState.currentRegister;
  }

  /**
   * Returns the input of the command if specified, or computes it using the
   * given function otherwise.
   */
  public inputOr(compute: (rawInput?: Input<A>) => Input<A> | Thenable<Input<A>>) {
    if (this._flags & CommandContextFlags.HasComputedInput) {
      return Promise.resolve(this._input!);
    }

    const value = compute((this.argument as any)?.input);

    if (typeof (value as Thenable<Input<A>>)?.then === "function") {
      return (value as Thenable<Input<A>>).then((value) => {
        this._input = value;
        this._flags |= CommandContextFlags.HasComputedInput;

        return value;
      });
    }

    this._input = value as Input<A>;
    this._flags |= CommandContextFlags.HasComputedInput;

    return Promise.resolve(value);
  }

  /**
   * Returns the user-chosen register or, if unspecified, the register returned
   * by `pickFallbackRegister`.
   */
  public registerOr<R extends Register | Thenable<Register>>(
    pickFallbackRegister: (registers: Registers) => R,
    requiredFlags: Register.Flags,
  ): R | Register {
    let register = this._register;

    if (register === undefined) {
      const registerOrPromise = pickFallbackRegister(this.extensionState.registers);

      if (registerOrPromise instanceof Register) {
        this._register = register = registerOrPromise;
      } else {
        return (registerOrPromise as Thenable<Register>).then((r) => this._register = r) as R;
      }
    } else {
      register.assertFlags(requiredFlags);
    }

    return register;
  }

  /**
   * Indicates that the command should not be recorded in the history.
   */
  public ignoreInHistory() {
    this._flags |= CommandContextFlags.IsIgnoredInHistory;
  }

  /**
   * Freezes the command, indicating that it is done executing and shouldn't
   * further be modified.
   */
  public record() {
    if (this._flags & CommandContextFlags.IsIgnoredInHistory) {
      return undefined;
    }

    const record = new RecordedCommand(
      this.descriptor, [], this.argument, this._input, this.repetitions, this._register);

    return record;
  }

  /**
   * Throws an exception indicating that this command is not implemented yet.
   */
  public notImplemented(): never {
    throw new Error(`command ${JSON.stringify(this.descriptor.command)} not implemented`);
  }
}
