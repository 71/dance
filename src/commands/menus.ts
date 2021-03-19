import * as vscode from "vscode";

import { CommandFlags, registerCommand } from ".";
import { Extension } from "../state/extension";
import { promptInList } from "../utils/prompt";
import { Command } from "../../commands";

registerCommand(
  Command.openMenu,
  CommandFlags.CanRunWithoutEditor,
  (_, { argument, extension }) => {
    if (typeof argument !== "object" || argument === null || typeof argument.menu !== "string") {
      throw new Error(`invalid argument`);
    }

    const menuName = argument.menu;

    if (Object.keys(argument).length > 1) {
      const argFields = Object.assign({}, argument);
      delete argFields.menu;
      openMenu(menuName, extension, argFields);
    } else {
      openMenu(menuName, extension);
    }
  },
);

export async function openMenu(
  menuName: string,
  extension: Extension,
  argFields?: Record<string, any>,
) {
  const menu = extension.menus.get(menuName);

  if (menu === undefined) {
    throw new Error(`menu ${JSON.stringify(menuName)} does not exist`);
  }

  const entries = Object.entries(menu.items);
  const items = entries.map((x) => [x[0], x[1].text]) as [string, string][];
  const choice = await promptInList(false, items, extension.cancellationTokenSource?.token);

  if (choice === undefined) {
    return;
  }

  const pickedItem = entries[choice][1];

  let args = pickedItem.args ?? [];
  if (argFields) {
    args = [Object.assign({}, argFields, args[0]), ...args.slice(1)];
  }

  await vscode.commands.executeCommand(pickedItem.command, ...args);
}
