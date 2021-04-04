import * as vscode from "vscode";
import * as api from "../api";
import { Context } from "../api";
import { CommandContext } from "../command";
import { Extension } from "../state/extension";
import { keypress, prompt } from "../utils/prompt";

/**
 * Miscellaneous commands that don't deserve their own category.
 *
 * By default, Dance also exports the following keybindings for existing
 * commands:
 *
 * | Keybinding     | Command                             |
 * | -------------- | ----------------------------------- |
 * | `s-;` (normal) | `["workbench.action.showCommands"]` |
 */
declare module "./misc";

/**
 * Toggle default key bindings.
 */
export function toggle(extension: Extension) {
  extension.setEnabled(!extension.enabled, false);
}

/**
 * Cancel Dance operation.
 */
export function cancel(command: CommandContext) {
  // Calling a new command resets pending operations, so we don't need to do
  // anything special here.
  command.ignoreInHistory();
}

/**
 * Select register for next command.
 *
 * @keys `"` (normal)
 */
export async function selectRegister(
  extension: Extension,
  cancellationToken: vscode.CancellationToken,
  input?: string,
) {
  if (input === undefined) {
    input = await keypress(cancellationToken);
  }

  extension.currentRegister = extension.registers.get(input);
}

/**
 * Update Dance count.
 *
 * Update the current counter used to repeat the next command.
 *
 * #### Additional keybindings
 *
 * | Title                          | Keybinding   | Command                                |
 * | ------------------------------ | ------------ | -------------------------------------- |
 * | Add the digit 0 to the counter | `0` (normal) | `[".updateCount", { "addDigits": 0 }]` |
 * | Add the digit 1 to the counter | `1` (normal) | `[".updateCount", { "addDigits": 1 }]` |
 * | Add the digit 2 to the counter | `2` (normal) | `[".updateCount", { "addDigits": 2 }]` |
 * | Add the digit 3 to the counter | `3` (normal) | `[".updateCount", { "addDigits": 3 }]` |
 * | Add the digit 4 to the counter | `4` (normal) | `[".updateCount", { "addDigits": 4 }]` |
 * | Add the digit 5 to the counter | `5` (normal) | `[".updateCount", { "addDigits": 5 }]` |
 * | Add the digit 6 to the counter | `6` (normal) | `[".updateCount", { "addDigits": 6 }]` |
 * | Add the digit 7 to the counter | `7` (normal) | `[".updateCount", { "addDigits": 7 }]` |
 * | Add the digit 8 to the counter | `8` (normal) | `[".updateCount", { "addDigits": 8 }]` |
 * | Add the digit 9 to the counter | `9` (normal) | `[".updateCount", { "addDigits": 9 }]` |
 */
export async function updateCount(
  extension: Extension,
  cancellationToken: vscode.CancellationToken,
  argument?: { addDigits?: number },
  input?: number,
) {
  if (argument != null) {
    if (typeof argument.addDigits === "number") {
      let digits = argument.addDigits,
          nextPowerOfTen = 1;

      if (digits <= 0) {
        digits = 0;
        nextPowerOfTen = 10;
      }

      while (nextPowerOfTen <= digits) {
        nextPowerOfTen *= 10;
      }

      extension.currentCount = extension.currentCount * nextPowerOfTen + digits;
    }
  }

  if (input === undefined) {
    input = +await prompt(prompt.numberOpts({ range: [0, 1_000_000] }), cancellationToken);
  } else {
    input = +input;

    if (isNaN(input)) {
      throw new Error("value is not a number");
    }

    if (input < 0) {
      throw new Error("value is negative");
    }
  }

  extension.currentCount = input | 0;
}

/**
 * Run code.
 */
export async function run(
  context: Context,
  argument?: { commands?: api.command.Any[] },
  input?: string | readonly string[],
) {
  const commands = argument?.commands;

  if (Array.isArray(commands)) {
    return api.commands(...commands);
  }

  let code = input;

  if (code === undefined) {
    code = await prompt({}, context.cancellationToken);
  } else if (Array.isArray(code)) {
    code = code.join("\n");
  } else if (typeof code !== "string") {
    return new Error(`expected code to be a string or an array, but it was ${code}`);
  }

  return context.run(() => api.run(code as string));
}
