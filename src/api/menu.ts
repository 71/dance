import * as vscode from "vscode";
import { promptInList } from "../utils/prompt";
import { Context } from "./context";

export interface Menu {
  readonly items: Menu.Items;
}

export namespace Menu {
  export interface Items {
    readonly [keys: string]: Item;
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

  if (typeof menu.items !== "object" || Object.keys(menu.items ?? {}).length < 2) {
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
  cancellationToken?: vscode.CancellationToken,
) {
  const entries = Object.entries(menu.items);
  const items = entries.map((x) => [x[0], x[1].text] as const);
  const choice = await promptInList(false, items, cancellationToken);

  if (choice === undefined) {
    return;
  }

  const pickedItem = entries[choice][1];

  let args = pickedItem.args as readonly any[];

  if (args == null) {
    args = additionalArgs;
  } else if (additionalArgs.length > 0) {
    args = args.length > additionalArgs.length
      ? args.map((arg, i) =>
        i < additionalArgs.length && additionalArgs[i]
          ? Object.assign({}, additionalArgs[i], arg)
          : arg)
      : additionalArgs.map((arg, i) =>
        i < args.length ? Object.assign({}, arg, args[i]) : arg);
  }

  return await vscode.commands.executeCommand(pickedItem.command, ...args);
}

export namespace showMenu {
  /**
   * Shows the menu with the given name.
   */
  export function byName(
    menuName: string,
    additionalArgs: readonly any[] = [],
    cancellationToken = Context.current.extensionState.cancellationTokenSource?.token,
  ) {
    const menu = Context.current.extensionState.menus.get(menuName);

    if (menu === undefined) {
      return Promise.reject(new Error(`menu ${JSON.stringify(menuName)} does not exist`));
    }

    return showMenu(menu, additionalArgs, cancellationToken);
  }
}
