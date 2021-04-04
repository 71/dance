import * as vscode from "vscode";
import { Context } from "../api";
import { CancellationError } from "./errors";

export function prompt(opts: vscode.InputBoxOptions, cancellationToken: vscode.CancellationToken) {
  return Context.wrap(vscode.window.showInputBox(opts, cancellationToken)
    .then((v) => {
      if (v === undefined) {
        const reason = cancellationToken?.isCancellationRequested
          ? CancellationError.Reason.CancellationToken
          : CancellationError.Reason.PressedEscape;

        return Promise.reject(new CancellationError(reason));
      }

      return v;
    }));
}

export namespace prompt {
  export function numberOpts(opts: { range?: [number, number] } = {}): vscode.InputBoxOptions {
    return {
      validateInput(value) {
        const n = +value;

        if (isNaN(n)) {
          return "Invalid number.";
        }

        if (opts.range && (n < opts.range[0] || n > opts.range[1])) {
          return `Number out of range ${JSON.stringify(opts.range)}.`;
        }

        return;
      },
    };
  }

  export function number(
    opts: Parameters<typeof numberOpts>[0],
    cancellationToken: vscode.CancellationToken,
  ) {
    return prompt(numberOpts(opts), cancellationToken).then((x) => +x);
  }

  export function regexpOpts(flags: string): vscode.InputBoxOptions {
    return {
      prompt: "Regular expression",
      validateInput(input: string) {
        try {
          new RegExp(input, flags);

          return undefined;
        } catch {
          return "Invalid ECMA RegExp.";
        }
      },
    };
  }

  export function regexp(flags: string, cancellationToken: vscode.CancellationToken) {
    return prompt(regexpOpts(flags), cancellationToken).then((x) => new RegExp(x, flags));
  }
}

export function keypress(
  cancellationToken: vscode.CancellationToken,
): Thenable<string> {
  return new Promise((resolve, reject) => {
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
