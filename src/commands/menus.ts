import * as vscode from "vscode";
import { Menu, showMenu, validateMenu } from "../api/menu";
import { prompt } from "../utils/prompt";

/**
 * Open menu.
 */
export async function open(
  cancellationToken: vscode.CancellationToken,
  argument?: { items?: Menu.Items },
  input?: string,
) {
  if (typeof argument?.items === "object") {
    const errors = validateMenu(argument as Menu);

    if (errors.length > 0) {
      throw new Error(`invalid menu: ${errors.join(", ")}`);
    }

    return showMenu(argument as Menu, [], cancellationToken);
  }

  if (input === undefined) {
    input = await prompt({}, cancellationToken);
  }

  const additionalArgs = [];

  if (argument !== undefined && Object.keys(argument).length > 1) {
    additionalArgs.push(Object.assign({}, argument));
    delete (additionalArgs[0] as any).input;
  }

  return showMenu.byName(input, additionalArgs, cancellationToken);
}
