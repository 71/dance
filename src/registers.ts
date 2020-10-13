import * as vscode from "vscode";

import { CommandState } from "./commands";

export interface Register {
  readonly name: string;

  canWrite(): this is WritableRegister;
  get(editor: vscode.TextEditor): Thenable<string[] | undefined>;
}

export interface MacroRegister {
  getMacro(): CommandState<any>[] | undefined;
  setMacro(data: CommandState<any>[]): void;
}

export interface WritableRegister extends Register {
  set(editor: vscode.TextEditor, values: string[]): Thenable<void>;
}

export class GeneralPurposeRegister implements Register, WritableRegister, MacroRegister {
  public values: string[] | undefined;
  public macroCommands: CommandState<any>[] | undefined;

  public canWrite() {
    return !this.readonly;
  }

  public constructor(public readonly name: string, public readonly readonly = false) {}

  public set(_: vscode.TextEditor, values: string[]) {
    this.values = values;

    return Promise.resolve();
  }

  public get() {
    return Promise.resolve(this.values);
  }

  public getMacro() {
    return this.macroCommands;
  }

  public setMacro(data: CommandState<any>[]) {
    this.macroCommands = data;
  }
}

export class SpecialRegister implements Register {
  public canWrite() {
    return this.setter !== undefined;
  }

  public constructor(
    public readonly name: string,
    public readonly getter: (editor: vscode.TextEditor) => Thenable<string[]>,
    public readonly setter?: (editor: vscode.TextEditor, values: string[]) => Thenable<void>,
  ) {}

  public get(editor: vscode.TextEditor) {
    return this.getter(editor);
  }

  public set(editor: vscode.TextEditor, values: string[]) {
    if (this.setter === undefined) {
      throw new Error("Cannot set read-only register.");
    }

    return this.setter(editor, values);
  }
}

export class ClipboardRegister implements Register {
  private lastSelections!: string[];
  private lastText!: string;

  public readonly name = '"';

  public canWrite() {
    return true;
  }

  public async get() {
    const text = await vscode.env.clipboard.readText();

    return this.lastText === text ? this.lastSelections : [text];
  }

  public set(editor: vscode.TextEditor, values: string[]) {
    this.lastSelections = values;
    this.lastText = values.join(editor.document.eol === 1 ? "\n" : "\r\n");

    return vscode.env.clipboard.writeText(this.lastText);
  }
}

export class Registers {
  public readonly alpha: Record<string, GeneralPurposeRegister> = {};

  public readonly dquote = new ClipboardRegister();
  public readonly slash = new GeneralPurposeRegister("/");
  public readonly arobase = new GeneralPurposeRegister("@");
  public readonly caret = new GeneralPurposeRegister("^");
  public readonly pipe = new GeneralPurposeRegister("|");

  public readonly percent = new SpecialRegister("%", (editor) =>
    Promise.resolve([editor.document.fileName]),
  );
  public readonly dot = new SpecialRegister(".", (editor) =>
    Promise.resolve(editor.selections.map(editor.document.getText)),
  );
  public readonly hash = new SpecialRegister("#", (editor) =>
    Promise.resolve(editor.selections.map((_, i) => i.toString())),
  );
  public readonly underscore = new SpecialRegister("_", (______) => Promise.resolve([""]));
  public readonly colon = new GeneralPurposeRegister(":", true);

  public get(key: string) {
    switch (key) {
      case '"':
        return this.dquote;
      case "/":
        return this.slash;
      case "@":
        return this.arobase;
      case "^":
        return this.caret;
      case "|":
        return this.pipe;

      case "%":
        return this.percent;
      case ".":
        return this.dot;
      case "#":
        return this.hash;
      case "_":
        return this.underscore;
      case ":":
        return this.colon;

      default:
        return this.alpha[key] || (this.alpha[key] = new GeneralPurposeRegister(key));
    }
  }
}
