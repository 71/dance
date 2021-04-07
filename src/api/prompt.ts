import * as vscode from "vscode";
import { Context } from "../api";
import { CancellationError } from "./errors";

/**
 * Displays a prompt to the user.
 */
export function prompt(
  opts: vscode.InputBoxOptions,
  context = Context.WithoutActiveEditor.current,
) {
  return context.wrap(vscode.window.showInputBox(opts, context.cancellationToken)
    .then((v) => {
      if (v === undefined) {
        const reason = context.cancellationToken?.isCancellationRequested
          ? CancellationError.Reason.CancellationToken
          : CancellationError.Reason.PressedEscape;

        return Promise.reject(new CancellationError(reason));
      }

      return v;
    }));
}

export namespace prompt {
  type RegExpFlag = "m" | "u" | "s" | "y" | "i" | "g";
  type RegExpFlags = RegExpFlag
                   | `${RegExpFlag}${RegExpFlag}`
                   | `${RegExpFlag}${RegExpFlag}${RegExpFlag}`
                   | `${RegExpFlag}${RegExpFlag}${RegExpFlag}${RegExpFlag}`;

  /**
   * Returns `vscode.InputBoxOptions` that only validate if a number in a given
   * range is entered.
   */
  export function numberOpts(
    opts: { integer?: boolean; range?: [number, number] } = {},
  ): vscode.InputBoxOptions {
    return {
      validateInput(input) {
        const n = +input;

        if (isNaN(n)) {
          return "Invalid number.";
        }

        if (opts.range && (n < opts.range[0] || n > opts.range[1])) {
          return `Number out of range ${JSON.stringify(opts.range)}.`;
        }

        if (opts.integer && (n | 0) !== n) {
          return `Number must be an integer.`;
        }

        return;
      },
    };
  }

  /**
   * Equivalent to `+await prompt(numberOpts(), context)`.
   */
  export function number(
    opts: Parameters<typeof numberOpts>[0],
    context = Context.WithoutActiveEditor.current,
  ) {
    return prompt(numberOpts(opts), context).then((x) => +x);
  }

  /**
   * Returns `vscode.InputBoxOptions` that only validate if a valid ECMAScript
   * regular expression is entered.
   */
  export function regexpOpts(flags: RegExpFlags): vscode.InputBoxOptions {
    return {
      prompt: "Regular expression",
      validateInput(input) {
        try {
          new RegExp(input, flags);

          return undefined;
        } catch {
          return "Invalid ECMA RegExp.";
        }
      },
    };
  }

  /**
   * Equivalent to `new RegExp(await prompt(regexpOpts(flags), context), flags)`.
   */
  export function regexp(
    flags: RegExpFlags,
    context = Context.WithoutActiveEditor.current,
  ) {
    return prompt(regexpOpts(flags), context).then((x) => new RegExp(x, flags));
  }
}

/**
 * Awaits a keypress from the user and returns the entered key.
 */
export function keypress(cancellationToken: vscode.CancellationToken): Thenable<string> {
  return new Promise<string>((resolve, reject) => {
    try {
      let done = false;
      const subscription = vscode.commands.registerCommand("type", ({ text }: { text: string }) => {
        if (!done) {
          subscription.dispose();
          done = true;

          resolve(text);
        }
      });

      cancellationToken?.onCancellationRequested(() => {
        if (!done) {
          subscription.dispose();
          done = true;

          reject(new CancellationError(CancellationError.Reason.PressedEscape));
        }
      });
    } catch {
      reject(new Error("Unable to listen to keyboard events; is an extension "
                      + 'overriding the "type" command (e.g VSCodeVim)?'));
    }
  });
}

export namespace keypress {
  /**
   * Awaits a keypress describing a register and returns the specified register.
   */
  export async function forRegister(context = Context.current) {
    const firstKey = await keypress(context.cancellationToken);

    if (firstKey !== " ") {
      return context.extensionState.registers.get(firstKey);
    }

    const secondKey = await keypress(context.cancellationToken);

    return context.extensionState.registers.forDocument(context.document).get(secondKey);
  }
}

export function promptInList(
  canPickMany: true,
  items: readonly (readonly [string, string])[],
  cancellationToken: vscode.CancellationToken,
): Thenable<number[]>;
export function promptInList(
  canPickMany: false,
  items: readonly (readonly [string, string])[],
  cancellationToken: vscode.CancellationToken,
): Thenable<number>;

export function promptInList(
  canPickMany: boolean,
  items: readonly (readonly [string, string])[],
  cancellationToken: vscode.CancellationToken,
): Thenable<number | number[]> {
  const itemsKeys = items.map(([k, _]) => k.includes(", ") ? k.split(", ") : [...k]);

  return new Promise<number | number[]>((resolve, reject) => {
    const quickPick = vscode.window.createQuickPick(),
          quickPickItems = [] as vscode.QuickPickItem[];

    let isCaseSignificant = false;

    for (let i = 0; i < items.length; i++) {
      const [label, description] = items[i];

      quickPickItems.push({ label, description });
      isCaseSignificant = isCaseSignificant || label.toLowerCase() !== label;
    }

    quickPick.items = quickPickItems;
    quickPick.placeholder = "Press one of the below keys.";
    quickPick.onDidChangeValue((key) => {
      if (!isCaseSignificant) {
        key = key.toLowerCase();
      }

      const index = itemsKeys.findIndex((x) => x.includes(key));

      quickPick.dispose();

      if (index === -1) {
        return reject(new CancellationError(CancellationError.Reason.PressedEscape));
      }

      if (canPickMany) {
        resolve([index]);
      } else {
        resolve(index);
      }
    });

    quickPick.onDidAccept(() => {
      let picked = quickPick.selectedItems;

      if (picked !== undefined && picked.length === 0) {
        picked = quickPick.activeItems;
      }

      quickPick.dispose();

      if (picked === undefined) {
        return reject(new CancellationError(CancellationError.Reason.PressedEscape));
      }

      if (canPickMany) {
        resolve(picked.map((x) => items.findIndex((item) => item[1] === x.description)));
      } else {
        resolve(items.findIndex((x) => x[1] === picked[0].description));
      }
    });

    cancellationToken?.onCancellationRequested(() => {
      quickPick.dispose();

      reject(new CancellationError(CancellationError.Reason.CancellationToken));
    });

    quickPick.show();
  });
}
