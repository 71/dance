import * as vscode from "vscode";

import { Context, prompt } from ".";

export interface Menu {
  readonly items: Menu.Items;
}

export namespace Menu {
  export interface Items {
    [keys: string]: Item;
  }

  export interface Item {
    readonly text: string;
    readonly command: string;
    readonly args?: any[];
  }
}

/**
 * Validates the given menu and returns a list of strings representing errors
 * with the given menu. If that list is empty, the menu is valid and can be
 * used.
 */
export function validateMenu(menu: Menu) {
  if (typeof menu !== "object" || menu === null) {
    return ["menu must be an object"];
  }

  if (typeof menu.items !== "object" || Object.keys(menu.items ?? {}).length === 0) {
    return ['menu must have an subobject "items" with at least two entries.'];
  }

  const seenKeyCodes = new Map<number, string>(),
        errors = [] as string[];

  for (const key in menu.items) {
    const item = menu.items[key],
          itemDisplay = JSON.stringify(key);

    if (typeof item !== "object" || item === null) {
      errors.push(`item ${itemDisplay} must be an object.`);
      continue;
    }

    if (typeof item.text !== "string" || item.text.length === 0) {
      errors.push(`item ${itemDisplay} must have a non-empty "text" property.`);
      continue;
    }

    if (typeof item.command !== "string" || item.command.length === 0) {
      errors.push(`item ${itemDisplay} must have a non-empty "command" property.`);
      continue;
    }

    if (key.length === 0) {
      errors.push(`item ${itemDisplay} must be a non-empty string key.`);
      continue;
    }

    for (let i = 0; i < key.length; i++) {
      const keyCode = key.charCodeAt(i),
            prevKey = seenKeyCodes.get(keyCode);

      if (prevKey) {
        errors.push(`menu has duplicate key '${key[i]}' (specified by '${prevKey}' and '${key}').`);
        continue;
      }

      seenKeyCodes.set(keyCode, key);
    }
  }

  return errors;
}

/**
 * Shows the given menu to the user, awaiting a choice.
 */
export async function showMenu(
  menu: Menu,
  additionalArgs: readonly any[] = [],
  prefix?: string,
) {
  const entries = Object.entries(menu.items);
  const items = entries.map((x) => [x[0], x[1].text] as const);
  const choice = await prompt.one(items);

  if (typeof choice === "string") {
    if (prefix !== undefined) {
      await vscode.commands.executeCommand("default:type", { text: prefix + choice });
    }

    return;
  }

  const pickedItem = entries[choice][1],
        args = mergeArgs(pickedItem.args, additionalArgs);

  return Context.WithoutActiveEditor.wrap(
    vscode.commands.executeCommand(pickedItem.command, ...args),
  );
}

export namespace showMenu {
  /**
   * Shows the menu with the given name.
   */
  export function byName(
    menuName: string,
    additionalArgs: readonly any[] = [],
    prefix?: string,
  ) {
    const menu = Context.WithoutActiveEditor.current.extension.menus.get(menuName);

    if (menu === undefined) {
      return Promise.reject(new Error(`menu ${JSON.stringify(menuName)} does not exist`));
    }

    return showMenu(menu, additionalArgs, prefix);
  }
}

/**
 * Shows the given menu to the user, not dismissing it when a key is pressed.
 */
export async function showLockedMenu(
  menu: Menu,
  additionalArgs: readonly any[] = [],
) {
  const entries = Object.entries(menu.items),
        items = entries.map(([keys, item]) =>
          [keys, item.text, () =>
            vscode.commands.executeCommand(
              item.command, ...mergeArgs(item.args, additionalArgs))] as const);

  await prompt.one.locked(items);
}

export namespace showLockedMenu {
  /**
   * Shows the menu with the given name.
   */
  export function byName(
    menuName: string,
    additionalArgs: readonly any[] = [],
  ) {
    const menu = Context.WithoutActiveEditor.current.extension.menus.get(menuName);

    if (menu === undefined) {
      return Promise.reject(new Error(`menu ${JSON.stringify(menuName)} does not exist`));
    }

    return showLockedMenu(menu, additionalArgs);
  }
}

function mergeArgs(args: readonly any[] | undefined, additionalArgs: readonly any[]) {
  if (args == null) {
    return additionalArgs;
  }

  if (!Array.isArray(args)) {
    args = [args];
  }

  if (additionalArgs.length > 0) {
    return args.length > additionalArgs.length
      ? args.map((arg, i) =>
        i < additionalArgs.length && additionalArgs[i]
          ? Object.assign({}, additionalArgs[i], arg)
          : arg)
      : additionalArgs.map((arg, i) =>
        i < args!.length ? Object.assign({}, arg, args![i]) : arg);
  } else {
    return args;
  }
}
