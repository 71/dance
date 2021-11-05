import * as vscode from "vscode";

import { Context } from "./context";
import { keypress, prompt } from "./prompt";

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
 * Returns the menu with the given name. If no such menu exists, an exception
 * will be thrown.
 */
export function findMenu(menuName: string, context = Context.WithoutActiveEditor.current) {
  const menu = context.extension.menus.get(menuName);

  if (menu === undefined) {
    throw new Error(`menu ${JSON.stringify(menuName)} does not exist`);
  }

  return menu;
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
    return showMenu(findMenu(menuName), additionalArgs, prefix);
  }

  /**
   * Same as `showMenu`, but only displays the menu after a specified delay.
   */
  export async function withDelay(
    delayMs: number,
    menu: Menu,
    additionalArgs: readonly any[] = [],
    prefix?: string,
  ) {
    const cancellationTokenSource = new vscode.CancellationTokenSource(),
          currentContext = Context.current;

    currentContext.cancellationToken.onCancellationRequested(() =>
      cancellationTokenSource.cancel());

    const keypressContext = currentContext.withCancellationToken(cancellationTokenSource.token),
          timeout = setTimeout(() => cancellationTokenSource.cancel(), delayMs);

    try {
      const key = await keypress(keypressContext);

      clearTimeout(timeout);

      for (const itemKeys in menu.items) {
        if (!itemKeys.includes(key)) {
          continue;
        }

        const pickedItem = menu.items[itemKeys],
              args = mergeArgs(pickedItem.args, additionalArgs);

        return Context.WithoutActiveEditor.wrap(
          vscode.commands.executeCommand(pickedItem.command, ...args),
        );
      }

      if (prefix !== undefined) {
        await vscode.commands.executeCommand("default:type", { text: prefix + key });
      }
    } catch (e) {
      if (!currentContext.cancellationToken.isCancellationRequested) {
        return showMenu(menu, additionalArgs, prefix);
      }

      throw e;
    } finally {
      cancellationTokenSource.dispose();
    }
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
    return showLockedMenu(findMenu(menuName), additionalArgs);
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
