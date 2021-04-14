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
        if (input.length === 0) {
          return "RegExp cannot be empty";
        }

        try {
          new RegExp(input, flags);

          return undefined;
        } catch {
          return "invalid RegExp";
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

  /**
   * Prompts the user for a result interactively.
   */
  export function interactive<T>(
    compute: (input: string) => T | Thenable<T>,
    reset: () => void,
    options: vscode.InputBoxOptions = {},
    interactive: boolean = true,
  ): Thenable<T> {
    let result: T;
    const validateInput = options.validateInput;

    if (!interactive) {
      return prompt(options).then((value) => compute(value));
    }

    return prompt({
      ...options,
      async validateInput(input) {
        const validationError = await validateInput?.(input);

        if (validationError) {
          return validationError;
        }

        try {
          result = await compute(input);
          return;
        } catch (e) {
          return `${e}`;
        }
      },
    }).then(
      () => result,
      (err) => {
        reset();
        throw err;
      },
    );
  }

  export type ListPair = readonly [string, string];

  /**
   * Prompts the user to choose one item among a list of items, and returns the
   * index of the item that was picked.
   */
  export function one(
    items: readonly ListPair[],
    init?: (quickPick: vscode.QuickPick<vscode.QuickPickItem>) => void,
    context = Context.WithoutActiveEditor.current,
  ) {
    return promptInList(false, items, init ?? (() => {}), context.cancellationToken);
  }

  /**
   * Prompts the user to choose many items among a list of items, and returns a
   * list of indices of picked items.
   */
  export function many(
    items: readonly ListPair[],
    init?: (quickPick: vscode.QuickPick<vscode.QuickPickItem>) => void,
    context = Context.WithoutActiveEditor.current,
  ) {
    return promptInList(true, items, init ?? (() => {}), context.cancellationToken);
  }
}

/**
 * Awaits a keypress from the user and returns the entered key.
 */
export function keypress(context = Context.current): Promise<string> {
  if (context.cancellationToken.isCancellationRequested) {
    return Promise.reject(new CancellationError(CancellationError.Reason.CancellationToken));
  }

  const previousMode = context.editorState.mode;

  return context.editorState.setMode(context.extensionState.modes.inputMode).then(() =>
    new Promise<string>((resolve, reject) => {
      try {
        const subscriptions = [
          vscode.commands.registerCommand("type", ({ text }: { text: string }) => {
            if (subscriptions.length > 0) {
              subscriptions.splice(0).forEach((s) => s.dispose());
              context.editorState.setMode(previousMode).then(() => resolve(text));
            }
          }),

          context.cancellationToken.onCancellationRequested(() => {
            if (subscriptions.length > 0) {
              subscriptions.splice(0).forEach((s) => s.dispose());
              context.editorState.setMode(previousMode)
                .then(() => reject(new CancellationError(CancellationError.Reason.PressedEscape)));
            }
          }),
        ];
      } catch {
        reject(new Error("unable to listen to keyboard events; is an extension "
                        + 'overriding the "type" command (e.g VSCodeVim)?'));
      }
    }),
  );
}

export namespace keypress {
  /**
   * Awaits a keypress describing a register and returns the specified register.
   */
  export async function forRegister(context = Context.current) {
    const firstKey = await keypress(context);

    if (firstKey !== " ") {
      return context.extensionState.registers.get(firstKey);
    }

    const secondKey = await keypress(context);

    return context.extensionState.registers.forDocument(context.document).get(secondKey);
  }
}

function promptInList(
  canPickMany: true,
  items: readonly (readonly [string, string])[],
  init: (quickPick: vscode.QuickPick<vscode.QuickPickItem>) => void,
  cancellationToken: vscode.CancellationToken,
): Thenable<number[]>;
function promptInList(
  canPickMany: false,
  items: readonly (readonly [string, string])[],
  init: (quickPick: vscode.QuickPick<vscode.QuickPickItem>) => void,
  cancellationToken: vscode.CancellationToken,
): Thenable<number>;

function promptInList(
  canPickMany: boolean,
  items: readonly (readonly [string, string])[],
  init: (quickPick: vscode.QuickPick<vscode.QuickPickItem>) => void,
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

    const subscriptions = [
      quickPick.onDidChangeValue((key) => {
        if (subscriptions.length === 0) {
          return;
        }

        if (!isCaseSignificant) {
          key = key.toLowerCase();
        }

        const index = itemsKeys.findIndex((x) => x.includes(key));

        subscriptions.splice(0).forEach((s) => s.dispose());

        if (index === -1) {
          return reject(new CancellationError(CancellationError.Reason.PressedEscape));
        }

        if (canPickMany) {
          resolve([index]);
        } else {
          resolve(index);
        }
      }),

      quickPick.onDidAccept(() => {
        if (subscriptions.length === 0) {
          return;
        }

        let picked = quickPick.selectedItems;

        if (picked !== undefined && picked.length === 0) {
          picked = quickPick.activeItems;
        }

        subscriptions.splice(0).forEach((s) => s.dispose());

        if (picked === undefined) {
          return reject(new CancellationError(CancellationError.Reason.PressedEscape));
        }

        if (canPickMany) {
          resolve(picked.map((x) => items.findIndex((item) => item[1] === x.description)));
        } else {
          resolve(items.findIndex((x) => x[1] === picked[0].description));
        }
      }),

      cancellationToken?.onCancellationRequested(() => {
        if (subscriptions.length === 0) {
          return;
        }

        subscriptions.splice(0).forEach((s) => s.dispose());

        reject(new CancellationError(CancellationError.Reason.CancellationToken));
      }),

      quickPick,
    ];

    init(quickPick);

    quickPick.show();
  });
}
