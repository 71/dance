import * as vscode from "vscode";

import { Context, EditorRequiredError } from "../api";
import { Extension } from "../state/extension";
import { Register, Registers } from "../register";

/**
 * Indicates that a register is expected; if no register is given, the
 * specified default should be given instead.
 */
export type RegisterOr<_Default extends keyof Registers,
                       Flags extends Register.Flags = Register.Flags.None>
  = Register.WithFlags<Flags>;

/**
 * Indicates that an input is expected; if no input is given, the specified
 * function will be used to
 */
export interface InputOr<T> {
  (promptDefaultInput: () => T): T;
  (promptDefaultInput: () => Thenable<T>): Thenable<T>;
}

/**
 * Indicates that a value passed as a command argument is expected.
 */
export type Argument<T> = T;

/**
 * The type of a `Context` passed to a command, based on whether the command
 * requires an active text editor or not.
 */
export type ContextType<RequiresActiveEditor extends boolean = boolean>
  = RequiresActiveEditor extends true ? Context : Context.WithoutActiveEditor;

/**
 * The type of the handler of a `CommandDescriptor`.
 */
export interface Handler<RequiresActiveEditor extends boolean = boolean> {
  (_: ContextType<RequiresActiveEditor>,
   argument: Record<string, any>): unknown | Thenable<unknown>;
}

/**
 * The descriptor of a command.
 */
export class CommandDescriptor<RequiresActiveEditor extends boolean = boolean> {
  public constructor(
    /**
     * The unique identifier of the command.
     */
    public readonly identifier: string,

    /**
     * The handler of the command.
     */
    public readonly handler: Handler<RequiresActiveEditor>,

    /**
     * Whether the command requires an active `vscode.TextEditor` to run.
     */
    public readonly requiresActiveEditor: RequiresActiveEditor,
  ) {
    Object.freeze(this);
  }

  /**
   * Executes the command with the given argument.
   */
  public replay(context: ContextType<RequiresActiveEditor>, argument: Record<string, any>) {
    return this.handler(context, argument);
  }

  /**
   * Invokes the command with the given argument.
   */
  public async invokeSafely(extension: Extension, argument: unknown) {
    const result = await extension.runPromiseSafely(
      async () => {
        const context = Context.create(extension, this);

        if (this.requiresActiveEditor && !(context instanceof Context)) {
          throw new EditorRequiredError();
        }

        return await this.handler(context as any, Object.assign({}, argument));
      },
      () => undefined,
      (e) => `error executing command "${this.identifier}": ${e.message}`,
    );

    // TODO: reset current count and register; record history; restore preferred columns.

    return result;
  }

  /**
   * Registers the command for use by VS Code.
   */
  public register(extension: Extension): vscode.Disposable {
    return vscode.commands.registerCommand(
      this.identifier,
      (argument) => this.invokeSafely(extension, argument),
    );
  }
}

/**
 * A record from command identifier to command descriptor.
 */
export interface Commands {
  readonly [commandIdentifier: string]: CommandDescriptor;
}
