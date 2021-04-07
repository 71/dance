import { Argument, InputOr } from ".";
import { Context } from "../api";
import { Menu, showMenu, validateMenu } from "../api/menu";
import { prompt } from "../api/prompt";

/**
 * Open menus.
 */
declare module "./menus";

let lastPickedMenu: string | undefined;

/**
 * Open menu.
 */
export async function open(
  context: Context.WithoutActiveEditor,
  inputOr: InputOr<string>,

  menu?: Argument<Menu>,
  additionalArgs: Argument<any[]> = [],
) {
  if (typeof menu === "object") {
    const errors = validateMenu(menu);

    if (errors.length > 0) {
      throw new Error(`invalid menu: ${errors.join(", ")}`);
    }

    return showMenu(menu, [], context.cancellationToken);
  }

  const menus = context.extensionState.menus;
  const input = await inputOr(() => prompt({
    prompt: "Menu name",
    validateInput(value) {
      if (menus.has(value)) {
        lastPickedMenu = value;
        return;
      }

      return `menu ${JSON.stringify(value)} does not exist`;
    },
    placeHolder: [...menus.keys()].join(", ") || "no menu defined",
    value: lastPickedMenu,
    valueSelection: lastPickedMenu === undefined ? undefined : [0, lastPickedMenu.length],
  }, context));

  return showMenu.byName(input, additionalArgs, context.cancellationToken);
}
