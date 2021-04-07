import * as vscode from "vscode";

import { Argument, InputOr, RegisterOr } from ".";
import { Context, Direction, prompt, todo } from "../api";
import { Register } from "../register";

/**
 * Search for patterns and replace or add selections.
 */
declare module "./search";

/**
 * Search.
 *
 * @keys `/` (normal)
 *
 * | Title                 | Identifier     | Keybinding     | Command                                         |
 * | --------------------- | -------------- | -------------- | ----------------------------------------------- |
 * | Search (add)          | `add`          | `?` (normal)   | `[".search", { "add": true }]`                  |
 * | Search backward       | `backward`     | `a-/` (normal) | `[".search", { "direction": -1 }]`              |
 * | Search backward (add) | `backward.add` | `a-?` (normal) | `[".search", { "direction": -1, "add": true }]` |
 */
export async function search(
  _: Context,

  add: Argument<boolean> = false,
  direction: Direction = Direction.Forward,
  inputOr: InputOr<string>,
) {
  const input = await inputOr(async () => {
    const result = await prompt({
      prompt: "Search RegExp",

      validateInput(input) {
        todo();
      },
    });

    return result;
  });
}

/**
 * Search current selection.
 *
 * @keys `a-*` (normal)
 *
 * | Title                            | Identifier        | Keybinding   | Command                                    |
 * | -------------------------------- | ----------------- | ------------ | ------------------------------------------ |
 * | Search current selection (smart) | `selection.smart` | `*` (normal) | `[".search.selection", { "smart": true }]` |
 */
export function selection(
  smart: Argument<boolean> = false,
) {
  todo!();
}

/**
 * Select next match.
 *
 * @keys `n` (normal)
 *
 * | Title                 | Identifier     | Keybinding       | Command                                         |
 * | --------------------- | -------------- | ---------------- | ----------------------------------------------- |
 * | Add next match        | `next.add`     | `s-n` (normal)   | `[".search.next", { "add": true }]`             |
 * | Select previous match | `previous`     | `a-n` (normal)   | `[".search", { "direction": -1 }]`              |
 * | Add previous match    | `previous.add` | `s-a-n` (normal) | `[".search", { "direction": -1, "add": true }]` |
 */
export async function next(
  selections: readonly vscode.Selection[],
  register: RegisterOr<"slash", Register.Flags.CanRead>,
  repetitions: number,

  add: Argument<boolean> = false,
  direction: Direction = Direction.Forward,
) {
  const reStrs = await register.get();

  if (reStrs === undefined || reStrs.length === 0) {
    return;
  }

  const re = new RegExp(reStrs[0], "gu");

  for (let i = 0; i < repetitions; i++) {
    todo();
  }
}
