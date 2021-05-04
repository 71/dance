import * as api from "../api";

import { Argument, InputOr } from ".";
import { Context, InputError, keypress, Menu, prompt, showLockedMenu, showMenu, validateMenu } from "../api";
import { Extension } from "../state/extension";
import { Register } from "../state/registers";

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
 * Cancel Dance operation.
 *
 * @keys `escape` (normal), `escape` (input)
 */
export function cancel(extension: Extension) {
  // Calling a new command resets pending operations, so we don't need to do
  // anything special here.
  extension.cancelLastOperation();
}

/**
 * Ignore key.
 */
export function ignore() {
  // Used to intercept and ignore key presses in a given mode.
}

let lastRunCode: string | undefined;

/**
 * Run code.
 */
export async function run(
  _: Context,
  inputOr: InputOr<string | readonly string[]>,

  commands?: Argument<api.command.Any[]>,
) {
  if (Array.isArray(commands)) {
    return api.commands(...commands);
  }

  let code = await inputOr(() => prompt({
    prompt: "Code to run",
    validateInput(value) {
      try {
        api.run.compileFunction(value);

        return;
      } catch (e) {
        if (e instanceof SyntaxError) {
          return `invalid syntax: ${e.message}`;
        }

        return e?.message ?? `${e}`;
      }
    },
    value: lastRunCode,
    valueSelection: lastRunCode === undefined ? undefined : [0, lastRunCode.length],
  }, _));

  if (Array.isArray(code)) {
    code = code.join("\n");
  } else if (typeof code !== "string") {
    return new InputError(`expected code to be a string or an array, but it was ${code}`);
  }

  return _.run(() => api.run(code as string));
}

/**
 * Select register for next command.
 *
 * When selecting a register, the next key press is used to determine what
 * register is selected. If this key is a `space` character, then a new key
 * press is awaited again and the returned register will be specific to the
 * current document.
 *
 * @keys `"` (normal)
 */
export async function selectRegister(_: Context, inputOr: InputOr<string | Register>) {
  const input = await inputOr(() => keypress.forRegister(_));

  if (typeof input === "string") {
    if (input.length === 0) {
      return;
    }

    const extension = _.extension,
          registers = extension.registers;

    extension.currentRegister = input.startsWith(" ")
      ? registers.forDocument(_.document).get(input.slice(1))
      : registers.get(input);
  } else {
    _.extension.currentRegister = input;
  }
}

/**
 * Update Dance count.
 *
 * Update the current counter used to repeat the next command.
 *
 * #### Additional keybindings
 *
 * | Title                          | Keybinding   | Command                              |
 * | ------------------------------ | ------------ | ------------------------------------ |
 * | Add the digit 0 to the counter | `0` (normal) | `[".updateCount", { addDigits: 0 }]` |
 * | Add the digit 1 to the counter | `1` (normal) | `[".updateCount", { addDigits: 1 }]` |
 * | Add the digit 2 to the counter | `2` (normal) | `[".updateCount", { addDigits: 2 }]` |
 * | Add the digit 3 to the counter | `3` (normal) | `[".updateCount", { addDigits: 3 }]` |
 * | Add the digit 4 to the counter | `4` (normal) | `[".updateCount", { addDigits: 4 }]` |
 * | Add the digit 5 to the counter | `5` (normal) | `[".updateCount", { addDigits: 5 }]` |
 * | Add the digit 6 to the counter | `6` (normal) | `[".updateCount", { addDigits: 6 }]` |
 * | Add the digit 7 to the counter | `7` (normal) | `[".updateCount", { addDigits: 7 }]` |
 * | Add the digit 8 to the counter | `8` (normal) | `[".updateCount", { addDigits: 8 }]` |
 * | Add the digit 9 to the counter | `9` (normal) | `[".updateCount", { addDigits: 9 }]` |
 */
export async function updateCount(
  _: Context,
  count: number,
  extension: Extension,
  inputOr: InputOr<number>,

  addDigits?: Argument<number>,
) {
  if (typeof addDigits === "number") {
    let nextPowerOfTen = 1;

    if (addDigits <= 0) {
      addDigits = 0;
      nextPowerOfTen = 10;
    }

    while (nextPowerOfTen <= addDigits) {
      nextPowerOfTen *= 10;
    }

    extension.currentCount = count * nextPowerOfTen + addDigits;

    return;
  }

  const input = +await inputOr(() => prompt.number({ integer: true, range: [0, 1_000_000] }, _));

  InputError.validateInput(!isNaN(input), "value is not a number");
  InputError.validateInput(input >= 0, "value is negative");

  extension.currentCount = input;
}

let lastPickedMenu: string | undefined;

/**
 * Open menu.
 *
 * If no input is specified, a prompt will ask for the name of the menu to open.
 *
 * Alternatively, a `menu` can be inlined in the arguments.
 *
 * Pass a `prefix` argument to insert the prefix string followed by the typed
 * key if it does not match any menu entry. This can be used to implement chords
 * like `jj`.
 */
export async function openMenu(
  _: Context.WithoutActiveEditor,

  inputOr: InputOr<string>,
  menu?: Argument<Menu>,
  prefix?: Argument<string>,
  pass: Argument<any[]> = [],
  locked: Argument<boolean> = false,
) {
  if (typeof menu === "object") {
    const errors = validateMenu(menu);

    if (errors.length > 0) {
      throw new Error(`invalid menu: ${errors.join(", ")}`);
    }

    if (locked) {
      return showLockedMenu(menu, pass);
    }

    return showMenu(menu, pass, prefix);
  }

  const menus = _.extension.menus;
  const input = await inputOr(() => prompt({
    prompt: "Menu name",
    validateInput(value) {
      if (menus.has(value)) {
        lastPickedMenu = value;
        return;
      }

      return `menu ${JSON.stringify(value)} does not exist`;
    },
    placeHolder: [...menus.keys()].sort().join(", ") || "no menu defined",
    value: lastPickedMenu,
  }, _));

  if (locked) {
    return showLockedMenu.byName(input, pass);
  }

  return showMenu.byName(input, pass, prefix);
}
