import type { Argument, InputOr, RegisterOr } from ".";
import { commands as apiCommands, run as apiRun, command, Context, findMenu, keypress, Menu, prompt, showLockedMenu, showMenu, validateMenu } from "../api";
import type { Extension } from "../state/extension";
import type { Register } from "../state/registers";
import { ArgumentError, CancellationError, InputError } from "../utils/errors";

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
  extension.cancelLastOperation(CancellationError.Reason.PressedEscape);
}

/**
 * Ignore key.
 */
export function ignore() {
  // Used to intercept and ignore key presses in a given mode.
}

const runHistory: string[] = [];

/**
 * Run code.
 *
 * There are two ways to invoke this command. The first one is to provide an
 * `input` string argument. This input must be a valid JavaScript string, and
 * will be executed with full access to the [Dance API](../api/README.md). For
 * instance,
 *
 * ```json
 * {
 *   "command": "dance.run",
 *   "args": {
 *     "input": "Selections.set(Selections.filter(text => text.includes('foo')))",
 *   },
 * },
 * ```
 *
 * If no argument is provided, a prompt will be shown asking for an input.
 * Furthermore, an array of strings can be passed to make longer functions
 * easier to read:
 *
 * ```json
 * {
 *   "command": "dance.run",
 *   "args": {
 *     "input": [
 *       "for (const selection of Selections.current) {",
 *       "  console.log(text(selection));",
 *       "}",
 *     ],
 *   },
 * },
 * ```
 *
 * The second way to use this command is with the `commands` argument. This
 * argument must be an array of "command-like" values. The simplest
 * "command-like" value is a string corresponding to the command itself:
 *
 * ```json
 * {
 *   "command": "dance.run",
 *   "args": {
 *     "commands": [
 *       "dance.modes.set.normal",
 *     ],
 *   },
 * },
 * ```
 *
 * But arguments can also be provided by passing an array:
 *
 * ```json
 * {
 *   "command": "dance.run",
 *   "args": {
 *     "commands": [
 *       ["dance.modes.set", { "input": "normal" }],
 *     ],
 *   },
 * },
 * ```
 *
 * Or by passing an object, like regular VS Code key bindings:
 *
 * ```json
 * {
 *   "command": "dance.run",
 *   "args": {
 *     "commands": [
 *       {
 *         "command": "dance.modes.set",
 *         "args": { "input": "normal" },
 *       },
 *     ],
 *   },
 * },
 * ```
 *
 * These values can be mixed:
 *
 * ```json
 * {
 *   "command": "dance.run",
 *   "args": {
 *     "commands": [
 *       ["dance.selections.saveText", { "register": "^" }],
 *       {
 *         "command": "dance.modes.set",
 *         "args": { "input": "normal" },
 *       },
 *       "hideSuggestWidget",
 *     ],
 *   },
 * },
 * ```
 */
export async function run(
  _: Context,
  inputOr: InputOr<string | readonly string[]>,

  commands?: Argument<command.Any[]>,
) {
  if (Array.isArray(commands)) {
    return apiCommands(...commands);
  }

  let code = await inputOr(() => prompt({
    prompt: "Code to run",
    validateInput(value) {
      try {
        apiRun.compileFunction(value);

        return;
      } catch (e) {
        if (e instanceof SyntaxError) {
          return `invalid syntax: ${e.message}`;
        }

        return e?.message ?? `${e}`;
      }
    },
    history: runHistory,
  }, _));

  if (Array.isArray(code)) {
    code = code.join("\n");
  } else if (typeof code !== "string") {
    return new InputError(`expected code to be a string or an array, but it was ${code}`);
  }

  return _.run(() => apiRun(code as string));
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
 * @noreplay
 */
export async function selectRegister(_: Context, inputOr: InputOr<string | Register>) {
  const input = await inputOr(() => keypress.forRegister(_));

  if (typeof input === "string") {
    if (input.length === 0) {
      return;
    }

    _.extension.currentRegister = _.extension.registers.getPossiblyScoped(input, _.document);
  } else {
    _.extension.currentRegister = input;
  }
}

let lastUpdateRegisterText: string | undefined;

/**
 * Update the contents of a register.
 *
 * @noreplay
 */
export async function updateRegister(
  _: Context,

  register: RegisterOr<"dquote", Register.Flags.CanWrite>,
  copyFrom: Argument<Register | string | undefined>,
  inputOr: InputOr<string>,
) {
  if (copyFrom !== undefined) {
    const copyFromRegister: Register = typeof copyFrom === "string"
      ? _.extension.registers.getPossiblyScoped(copyFrom, _.document)
      : copyFrom;

    copyFromRegister.ensureCanRead();

    await register.set(await copyFromRegister.get());

    return;
  }

  const input = await inputOr(() => prompt({
    prompt: "New register contents",
    value: lastUpdateRegisterText,
    validateInput(value) {
      lastUpdateRegisterText = value;

      return undefined;
    },
  }));

  await register.set([input]);
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
 *
 * @noreplay
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

const menuHistory: string[] = [];

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
 *
 * @noreplay
 */
export async function openMenu(
  _: Context.WithoutActiveEditor,

  inputOr: InputOr<string>,
  menu?: Argument<Menu>,
  prefix?: Argument<string>,
  pass: Argument<any[]> = [],
  locked: Argument<boolean> = false,
  delay: Argument<number> = 0,
) {
  if (typeof menu !== "object") {
    const menus = _.extension.menus;
    const input = await inputOr(() => prompt({
      prompt: "Menu name",
      validateInput(value) {
        if (menus.has(value)) {
          return;
        }

        return `menu ${JSON.stringify(value)} does not exist`;
      },
      placeHolder: [...menus.keys()].sort().join(", ") || "no menu defined",
      history: menuHistory,
    }, _));

    menu = findMenu(input, _);
  }

  const errors = validateMenu(menu);

  if (errors.length > 0) {
    throw new Error(`invalid menu: ${errors.join(", ")}`);
  }

  if (locked) {
    return showLockedMenu(menu, pass);
  }

  if (delay > 0) {
    return showMenu.withDelay(delay, menu, pass, prefix);
  }

  return showMenu(menu, pass, prefix);
}

/**
 * Change current input.
 *
 * When showing some menus, Dance can navigate their history:
 *
 * | Keybinding      | Command                                    |
 * | --------------- | ------------------------------------------ |
 * | `up` (prompt)   | `[".changeInput", { action: "previous" }]` |
 * | `down` (prompt) | `[".changeInput", { action: "next"     }]` |
 *
 * @noreplay
 */
export function changeInput(
  action: Argument<Parameters<typeof prompt.notifyActionRequested>[0]>,
) {
  ArgumentError.validate(
    "action",
    ["clear", "previous", "next"].includes(action),
    `must be "previous" or "next"`,
  );

  prompt.notifyActionRequested(action);
}
