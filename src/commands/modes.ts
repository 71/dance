import * as vscode from "vscode";

import { Context, toMode } from "../api";
import { prompt } from "../utils/prompt";

/**
 * Dance editing modes.
 */
declare module "./modes";

/**
 * Set Dance mode.
 *
 * #### Additional commands
 *
 * | Title              | Identifier   | Keybindings       | Commands                                |
 * | ------------------ | ------------ | ----------------- | --------------------------------------- |
 * | Set mode to Normal | `set.normal` | `escape` (insert) | `[".modes.set", { "input": "normal" }]` |
 * | Set mode to Insert | `set.insert` |                   | `[".modes.set", { "input": "insert" }]` |
 */
export async function set(_: Context, cancellationToken: vscode.CancellationToken, input: string) {
  if (input === undefined) {
    input = await prompt(validateModeName(_), cancellationToken);
  }

  return toMode(input);
}

/**
 * Set Dance mode temporarily.
 *
 * #### Additional commands
 *
 * | Title                 | Identifier               | Keybindings    | Commands                                            |
 * | --------------------- | ------------------------ | -------------- | --------------------------------------------------- |
 * | Temporary Normal mode | `set.temporarily.normal` | `c-v` (insert) | `[".modes.set.temporarily", { "input": "normal" }]` |
 * | Temporart Insert mode | `set.temporarily.insert` | `c-v` (normal) | `[".modes.set.temporarily", { "input": "insert" }]` |
 */
export async function set_temporarily(
  _: Context,
  cancellationToken: vscode.CancellationToken,
  input: string,
  repetitions: number,
) {
  if (input === undefined) {
    input = await prompt(validateModeName(_), cancellationToken);
  }

  return toMode(input, repetitions);
}

function validateModeName(ctx: Context) {
  const modes = ctx.extensionState.modes;

  return {
    validateInput(value) {
      if (modes.get(value) !== undefined) {
        return undefined;
      }

      return `Mode "${value}" does not exist`;
    },
  } as vscode.InputBoxOptions;
}
