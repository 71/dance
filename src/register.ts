import * as vscode from "vscode";

import { EditorState } from "./state/editor";
import { TrackedSelectionSet } from "./utils/tracked-selection";

/**
 * The base class for all registers.
 */
export abstract class Register {
  /**
   * The name of the register.
   */
  public readonly abstract name: string;

  /**
   * The flags of the register, which define what a register can do.
   */
  public readonly abstract flags: Register.Flags;

  /**
   * Returns whether the register is readable.
   */
  public canRead(): this is Register.Readable {
    return (this.flags & Register.Flags.CanRead) === Register.Flags.CanRead;
  }

  /**
   * Returns whether the register is writeable.
   */
  public canWrite(): this is Register.Writeable {
    return (this.flags & Register.Flags.CanWrite) === Register.Flags.CanWrite;
  }

  /**
   * Returns whether the register is selections-readeable.
   */
  public canReadSelections(): this is Register.ReadableSelections {
    return (this.flags & Register.Flags.CanReadSelections) === Register.Flags.CanReadSelections;
  }

  /**
   * Returns whether the register is selections-writeable.
   */
  public canWriteSelections(): this is Register.WriteableSelections {
    return (this.flags & Register.Flags.CanWriteSelections) === Register.Flags.CanWriteSelections;
  }

  /**
   * Returns whether the register can be used to replay recorded commands.
   */
  public canReadRecordedCommands(): this is Register.ReadableWriteableMacros {
    return (this.flags & Register.Flags.CanReadWriteMacros) === Register.Flags.CanReadWriteMacros;
  }

  /**
   * Returns whether the register can be used to record commands.
   */
  public canWriteRecordedCommands(): this is Register.ReadableWriteableMacros {
    return (this.flags & Register.Flags.CanReadWriteMacros) === Register.Flags.CanReadWriteMacros;
  }

  /**
   * Returns whether the current register has the given flags.
   */
  public hasFlags<F extends Register.Flags>(flags: F): this is Register.WithFlags<F> {
    return (this.flags & flags) === flags;
  }

  /**
   * Returns the current register if it has the given flags, or throws an
   * exception otherwise.
   */
  public withFlags<F extends Register.Flags>(
    flags: F,
  ): this extends Register.WithFlags<F> ? this : never {
    Register.assertFlags(this, flags);

    return this;
  }
}

export namespace Register {
  /**
   * Flags describing the capabilities of a `Register`.
   */
  export const enum Flags {
    /** Strings can be read from the register. */
    CanRead = 1,
    /** Strings can be written to the register. */
    CanWrite = 2,

    /** Selections can be read from the register. */
    CanReadSelections = 4,
    /** Selections can be written to the register. */
    CanWriteSelections = 8,

    /** Command histories can be read from or written to the register. */
    CanReadWriteMacros = 16,
  }

  /**
   * Given a set of `Flags`, returns what interfaces correspond to these flags.
   */
  export type InterfaceFromFlags<F extends Flags>
    = (F extends Flags.CanRead ? Readable : never)
    | (F extends Flags.CanReadSelections ? ReadableSelections : never)
    | (F extends Flags.CanReadWriteMacros ? ReadableWriteableMacros : never)
    | (F extends Flags.CanWrite ? Writeable : never)
    | (F extends Flags.CanWriteSelections ? WriteableSelections : never)
  ;

  /**
   * Given a set of `Flags`, returns the `Register` type augmented with the
   * interfaces that correspond to these flags.
   */
  export type WithFlags<F extends Flags> = Register & InterfaceFromFlags<F>;

  export interface Readable {
    get(document?: vscode.TextDocument): Thenable<readonly string[] | undefined>;
  }

  export interface Writeable {
    set(values: readonly string[], document?: vscode.TextDocument): Thenable<void>;
  }

  export interface ReadableSelections {
    getSelections(document?: vscode.TextDocument): vscode.Selection[] | undefined;
    getSelectionSet(document?: vscode.TextDocument): TrackedSelectionSet | undefined;

    getSharedSelectionsEditor(): EditorState | undefined;
  }

  export interface WriteableSelections {
    setSelectionSet(selections: TrackedSelectionSet, document: vscode.TextDocument): void;
    setSelectionSet(selections: TrackedSelectionSet, editor: EditorState): void;
  }

  export interface ReadableWriteableMacros {
    getRecordedCommands(document?: vscode.TextDocument): readonly RecordedCommand[] | undefined;
    setRecordedCommands(commands: readonly RecordedCommand[], document?: vscode.TextDocument): void;
  }

  /**
   * Throws an error if the given register does not satisfy the specified
   * flags.
   */
  export function assertFlags<F extends Register.Flags>(
    register: Register,
    flags: F,
  ): asserts register is Register.WithFlags<F> {
    // Note: we cannot make this a member of `Register` because of
    //       https://github.com/microsoft/TypeScript/issues/34596.
    const f = (register as Register).flags;

    if ((flags & Register.Flags.CanRead) && !(f & Register.Flags.CanRead)) {
      throw new Error(`register "${register.name}" cannot be used to read text`);
    }
    if ((flags & Register.Flags.CanReadSelections) && !(f & Register.Flags.CanReadSelections)) {
      throw new Error(`register "${register.name}" cannot be used to read selections`);
    }
    if ((flags & Register.Flags.CanReadWriteMacros) && !(f & Register.Flags.CanReadWriteMacros)) {
      throw new Error(`register "${register.name}" cannot be used to play or create recordings`);
    }
    if ((flags & Register.Flags.CanWrite) && !(f & Register.Flags.CanWrite)) {
      throw new Error(`register "${register.name}" cannot be used to save text`);
    }
    if ((flags & Register.Flags.CanWriteSelections) && !(f & Register.Flags.CanWriteSelections)) {
      throw new Error(`register "${register.name}" cannot be used to save selections`);
    }
  }
}

/**
 * A general-purpose register, which supports all operations on registers.
 */
class GeneralPurposeRegister extends Register implements Register.Readable,
                                                         Register.Writeable,
                                                         Register.ReadableSelections,
                                                         Register.WriteableSelections,
                                                         Register.ReadableWriteableMacros {
  private readonly _selectionsPerDocument = new WeakMap<vscode.TextDocument, TrackedSelectionSet>();

  public readonly flags: Register.Flags;

  public values: readonly string[] | undefined;
  public macroCommands: CommandState<any>[] | undefined;

  public constructor(
    public readonly name: string,
  ) {
    super();

    this.flags = Register.Flags.CanRead
               | Register.Flags.CanReadSelections
               | Register.Flags.CanReadWriteMacros
               | Register.Flags.CanWrite
               | Register.Flags.CanWriteSelections;
  }

  public set(_: vscode.TextEditor, values: readonly string[]) {
    this.values = values;

    return Promise.resolve();
  }

  public get() {
    return Promise.resolve(this.values);
  }

  public getRecordedCommands(document?: vscode.TextDocument) {
  }

  public setRecordedCommands(commands: readonly RecordedCommand[], document?: vscode.TextDocument) {

  }

  public getMacro() {
    return this.macroCommands;
  }

  public setMacro(data: CommandState<any>[]) {
    this.macroCommands = data;
  }

  public getSelections(document: vscode.TextDocument) {
    const trackedSelectionSet = this._selectionsPerDocument.get(document);

    if (trackedSelectionSet === undefined) {
      return undefined;
    }

    return trackedSelectionSet.restore(document);
  }

  public getSelectionSet(document: vscode.TextDocument) {
    return this._selectionsPerDocument.get(document);
  }

  public setSelectionSet(document: vscode.TextDocument, trackedSelections: TrackedSelectionSet) {
    this._selectionsPerDocument.set(document, trackedSelections);
  }
}

/**
 * A special register whose behavior is defined by the functions given to it.
 */
class SpecialRegister extends Register implements Register.Readable,
                                                  Register.Writeable {
  public readonly flags = this.setter === undefined
    ? Register.Flags.CanRead
    : Register.Flags.CanRead | Register.Flags.CanWrite;

  public constructor(
    public readonly name: string,
    public readonly getter: (editor: vscode.TextEditor) => Thenable<readonly string[]>,
    public readonly setter?: (editor: vscode.TextEditor,
                              values: readonly string[]) => Thenable<void>,
  ) {
    super();
  }

  public get(editor: vscode.TextEditor) {
    return this.getter(editor);
  }

  public set(editor: vscode.TextEditor, values: readonly string[]) {
    if (this.setter === undefined) {
      throw new Error("Cannot set read-only register.");
    }

    return this.setter(editor, values);
  }
}

/**
 * A special register that forwards operations to the system clipboard.
 */
class ClipboardRegister extends Register implements Register.Readable,
                                                    Register.Writeable {
  private lastSelections?: readonly string[];
  private lastText?: string;

  public readonly name = '"';
  public readonly flags = Register.Flags.CanRead | Register.Flags.CanWrite;

  public async get() {
    const text = await vscode.env.clipboard.readText();

    return this.lastText === text ? this.lastSelections : [text];
  }

  public set(editor: vscode.TextEditor, values: readonly string[]) {
    this.lastSelections = values;
    this.lastText = values.join(editor.document.eol === 1 ? "\n" : "\r\n");

    return vscode.env.clipboard.writeText(this.lastText);
  }
}

/**
 * The set of all registers.
 */
export class Registers {
  private readonly _named = new Map<string, Register>();
  private readonly _letters = Array.from(
    { length: 26 },
    (_, i) => new GeneralPurposeRegister(String.fromCharCode(97 + i)) as Register,
  );
  private readonly _digits = Array.from(
    { length: 10 },
    (_, i) => new SpecialRegister((i + 1).toString(), () => Promise.resolve(this._lastMatches[i])),
  );

  private _lastMatches: readonly (readonly string[])[] = [];

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
  public readonly underscore = new SpecialRegister("_", (_) => Promise.resolve([""]));
  public readonly colon = new GeneralPurposeRegister(":");

  public constructor() {
    for (const [longName, register] of [
      ["dquote", this.dquote] as const,
      ["slash", this.slash] as const,
      ["arobase", this.arobase] as const,
      ["caret", this.caret] as const,
      ["pipe", this.pipe] as const,
      ["percent", this.percent] as const,
      ["dot", this.dot] as const,
      ["hash", this.hash] as const,
      ["underscore", this.underscore] as const,
      ["colon", this.colon] as const,
    ]) {
      this._letters[longName.charCodeAt(0) - 97 /* a */] = register;
      this._named.set(longName, register);
    }
  }

  public get(key: string) {
    if (key.length === 1) {
      const charCode = key.charCodeAt(0);

      switch (charCode) {
      case 34:  // "
        return this.dquote;
      case 47:  // /
        return this.slash;
      case 64:  // @
        return this.arobase;
      case 94:  // ^
        return this.caret;
      case 124:  // |
        return this.pipe;

      case 37:  // %
        return this.percent;
      case 46:  // .
        return this.dot;
      case 35:  // #
        return this.hash;
      case 95:  // _
        return this.underscore;
      case 58:  // :
        return this.colon;

      default:
        if (charCode >= 97 /* a */ && charCode <= 122 /* z */) {
          return this._letters[charCode - 97];
        }

        if (charCode >= 65 /* A */ && charCode <= 90 /* Z */) {
          return this._letters[charCode - 65];
        }

        if (charCode >= 49 /* 1 */ && charCode <= 57 /* 9 */) {
          return this._digits[charCode - 49];
        }
      }
    }

    key = key.toLowerCase();

    let register = this._named.get(key.toLowerCase());

    if (register === undefined) {
      this._named.set(key, register = new GeneralPurposeRegister(key));
    }

    return register;
  }

  public updateRegExpMatches(matches: RegExpExecArray[]) {
    this._lastMatches = matches.map((m) => m.slice(1));
  }
}
