import * as vscode from "vscode";
import { Command, CommandDescriptor, CommandFlags, CommandState, InputKind, commandsByName, registerCommand } from ".";

registerCommand(Command.cancel, CommandFlags.IgnoreInHistory, () => {
  // Nop, because the caller cancels everything before calling us.
});

type RunFunction = (vscodeObj: typeof vscode, danceObj: object, args: any) => Promise<any> | any;
type RunFunctionConstructor = (vscodeObj: "vscode", danceObj: "dance", args: "args", code: string) => RunFunction;

const AsyncFunction = async function () {}.constructor as RunFunctionConstructor;

registerCommand(Command.run, CommandFlags.IgnoreInHistory, async (editorState, state) => {
  let code = state.argument?.code;

  if (Array.isArray(code)) {
    code = code.join("\n");
  } else if (typeof code !== "string") {
    throw new Error(`expected code to be a string or an array, but it was ${code}`);
  }

  let func: RunFunction;

  try {
    func = AsyncFunction("vscode", "dance", "args", code) as any;
  } catch (e) {
    throw new Error(`cannot parse function body: ${code}: ${e}`);
  }

  const danceInterface = Object.freeze({
    async execute(...commands: any[]) {
      const batches = [] as (readonly CommandState[] | [string, any])[],
            currentBatch = [] as CommandState[],
            extension = editorState.extension;

      if (commands.length === 2 && typeof commands[0] === "string") {
        commands = [commands];
      }

      // Build and validate commands.
      for (let i = 0, len = commands.length; i < len; i++) {
        let commandName: string,
            commandArgument: any;

        const command = commands[i];

        if (typeof command === "string") {
          commandName = command;
          commandArgument = undefined;
        } else if (Array.isArray(command) && command.length === 1) {
          if (typeof command[0] !== "string") {
            throw new Error("the first element of an execute tuple must be a command name");
          }

          commandName = command[0];
          commandArgument = undefined;
        } else if (Array.isArray(command) && command.length === 2) {
          if (typeof command[0] !== "string") {
            throw new Error("the first element of an execute tuple must be a command name");
          }

          commandName = command[0];
          commandArgument = command[1];
        } else {
          throw new Error("execute arguments must be command names or [command name, argument] tuples");
        }

        if (commandName.startsWith(".")) {
          commandName = `dance${commandName}`;
        }

        if (commandName in commandsByName) {
          const descriptor = commandsByName[commandName as Command],
                input = await descriptor.getInput(editorState, commandArgument, extension.cancellationTokenSource?.token);

          if (descriptor.input !== InputKind.None && input === undefined) {
            return;
          }

          currentBatch.push(new CommandState(descriptor, input, extension, commandArgument));
        } else {
          if (commandName.startsWith("dance.")) {
            throw new Error(`Dance command ${JSON.stringify(commandName)} does not exist`);
          }

          if (currentBatch.length > 0) {
            batches.push(currentBatch.splice(0));
          }

          batches.push([commandName, commandArgument]);
        }
      }

      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }

      // Execute all commands.
      for (const batch of batches) {
        if (typeof batch[0] === "string") {
          await vscode.commands.executeCommand(batch[0], batch[1]);
        } else {
          await CommandDescriptor.executeMany(editorState, batch);
        }
      }
    },
  });

  try {
    await func(vscode, danceInterface, state.argument);
  } catch (e) {
    throw new Error(`code threw an exception: ${e}`);
  }
});
