import * as vscode from "vscode";
import { Command, CommandFlags, registerCommand } from ".";

registerCommand(Command.cancel, CommandFlags.IgnoreInHistory, () => {
  // Nop, because the caller cancels everything before calling us.
});

const AsyncFunction = async function () {}.constructor as typeof Function;

registerCommand(Command.run, CommandFlags.IgnoreInHistory, async (_, state) => {
  let code = state.argument?.code;

  if (Array.isArray(code)) {
    code = code.join("\n");
  } else if (typeof code !== "string") {
    throw new Error(`expected code to be a string or an array, but it was ${code}`);
  }

  let func: (_vscode: typeof vscode, _args: any) => Promise<any> | any;

  try {
    func = AsyncFunction("vscode", "args", code) as any;
  } catch (e) {
    throw new Error(`cannot parse function body: ${code}: ${e}`);
  }

  try {
    await func(vscode, state.argument);
  } catch (e) {
    throw new Error(`code threw an exception: ${e}`);
  }
});
