import * as vscode from "vscode";

import { InputOr } from ".";
import { Context, prompt, toMode } from "../api";

/**
 * Set modes.
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
export async function set(_: Context, inputOr: InputOr<string>) {
  return toMode(await inputOr(() => prompt(validateModeName(_), _)));
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
  inputOr: InputOr<string>,
  repetitions: number,
) {
  return toMode(await inputOr(() => prompt(validateModeName(_), _)), repetitions);
}

function validateModeName(ctx: Context) {
  const modes = ctx.extensionState.modes;

  return {
    validateInput(value) {
      if (modes.get(value) !== undefined) {
        return undefined;
      }

      return `mode ${JSON.stringify(value)} does not exist`;
    },
  } as vscode.InputBoxOptions;
}
