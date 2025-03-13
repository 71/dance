import type { InputOr } from ".";
import { Context, prompt, toMode } from "../api";

/**
 * Set modes.
 */
declare module "./modes";

/**
 * Set Dance mode.
 *
 * #### Variants
 *
 * | Title              | Identifier   | Keybinding                                                  | Command                                                     |
 * | ------------------ | ------------ | ----------------------------------------------------------- | ----------------------------------------------------------- |
 * | Set mode to Normal | `set.normal` | `escape` (core: insert; helix: select), `v` (helix: select) | `[".modes.set", { mode: "normal" }], ["hideSuggestWidget"]` |
 * | Set mode to Insert | `set.insert` |                                                             | `[".modes.set", { mode: "insert" }]`                        |
 * | Set mode to Select | `set.select` | `v` (helix: normal)                                         | `[".modes.set", { mode: "select" }]`                        |
 *
 * Other variants are provided to switch to insert mode:
 *
 * | Title                | Identifier         | Keybinding                          | Commands                                                                                                                                                                            |
 * | -------------------- | ------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
 * | Insert before        | `insert.before`    | `i` (core: normal; helix: select)   | `[".selections.faceBackward", { record: false }],           [".modes.set", { mode: "insert", +mode }], [".selections.reduce", { where: "start", record: false, empty: true, ... }]` |
 * | Insert after         | `insert.after`     | `a` (core: normal; helix: select)   | `[".selections.faceForward" , { record: false }],           [".modes.set", { mode: "insert", +mode }], [".selections.reduce", { where: "end"  , record: false, empty: true, ... }]` |
 * | Insert at line start | `insert.lineStart` | `s-i` (core: normal; helix: select) | `[".select.lineStart", { shift: "jump", skipBlank: true }], [".modes.set", { mode: "insert", +mode }], [".selections.reduce", { where: "start", record: false, empty: true, ... }]` |
 * | Insert at line end   | `insert.lineEnd`   | `s-a` (core: normal; helix: select) | `[".select.lineEnd"  , { shift: "jump"                  }], [".modes.set", { mode: "insert", +mode }], [".selections.reduce", { where: "end"  , record: false, empty: true, ... }]` |
 *
 * @noreplay
 */
export async function set(_: Context, modeOr: InputOr<"mode", string>) {
  await toMode(await modeOr(() => prompt(validateModeName())));
}

/**
 * Set Dance mode temporarily.
 *
 * #### Variants
 *
 * | Title                 | Identifier               | Keybindings             | Commands                                         |
 * | --------------------- | ------------------------ | ----------------------- | ------------------------------------------------ |
 * | Temporary Normal mode | `set.temporarily.normal` | `c-v` (kakoune: insert) | `[".modes.set.temporarily", { mode: "normal" }]` |
 * | Temporary Insert mode | `set.temporarily.insert` | `c-v` (kakoune: normal) | `[".modes.set.temporarily", { mode: "insert" }]` |
 *
 * @noreplay
 */
export async function set_temporarily(_: Context, modeOr: InputOr<"mode", string>, repetitions: number) {
  await toMode(await modeOr(() => prompt(validateModeName())), repetitions);
}

const modeHistory: string[] = [];

function validateModeName(ctx = Context.WithoutActiveEditor.current) {
  const modes = ctx.extension.modes;

  return {
    prompt: "Mode name",
    validateInput(value) {
      if (modes.get(value) !== undefined) {
        return;
      }

      return `mode ${JSON.stringify(value)} does not exist`;
    },
    placeHolder: [...modes.userModes()].map((m) => m.name).sort().join(", "),
    history: modeHistory,
  } as prompt.Options;
}
