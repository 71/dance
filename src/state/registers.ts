import * as vscode from "vscode";

import type { Extension } from "./extension";
import type { Recording } from "./recorder";
import { Context, prompt, SelectionBehavior, Selections } from "../api";
import { availableClipboardRegisters } from "../utils/constants";
import { ArgumentError, assert, EditNotAppliedError, EditorRequiredError } from "../utils/errors";
import { noUndoStops } from "../utils/misc";
import type * as TrackedSelection from "../utils/tracked-selection";

/**
 * The base class for all registers.
 */
export abstract class Register {
  private readonly _onChangeEvent = new vscode.EventEmitter<Register.ChangeKind>();

  /**
   * The name of the register.
   */
  public readonly abstract name: string;

  /**
   * The name of the icon of the register, as seen in the [VS Code product icon
   * reference](https://code.visualstudio.com/api/references/icons-in-labels#icon-listing).
   *
   * `undefined` if the register shouldn't be displayed.
   */
  public readonly abstract iconName: string | undefined;

  /**
   * The flags of the register, which define what a register can do.
   */
  public readonly abstract flags: Register.Flags;

  /**
   * Event fired when the contents, selections or recording of the register
   * change.
   */
  public get onChange() {
    return this._onChangeEvent.event;
  }

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
   * Ensures that the register is readable.
   */
  public ensureCanRead(): asserts this is Register.Readable {
    this.checkFlags(Register.Flags.CanRead);
  }

  /**
   * Ensures that the register is writeable.
   */
  public ensureCanWrite(): asserts this is Register.Writeable {
    this.checkFlags(Register.Flags.CanWrite);
  }

  /**
   * Ensures that the register is selections-readeable.
   */
  public ensureCanReadSelections(): asserts this is Register.ReadableSelections {
    this.checkFlags(Register.Flags.CanReadSelections);
  }

  /**
   * Ensures that the register is selections-writeable.
   */
  public ensureCanWriteSelections(): asserts this is Register.WriteableSelections {
    this.checkFlags(Register.Flags.CanWriteSelections);
  }

  /**
   * Ensures that the register can be used to replay recorded commands.
   */
  public ensureCanReadRecordedCommands(): asserts this is Register.ReadableWriteableMacros {
    this.checkFlags(Register.Flags.CanReadWriteMacros);
  }

  /**
   * Ensures that the register can be used to record commands.
   */
  public ensureCanWriteRecordedCommands(): asserts this is Register.ReadableWriteableMacros {
    this.checkFlags(Register.Flags.CanReadWriteMacros);
  }

  /**
   * Returns whether the current register has the given flags.
   */
  public hasFlags<F extends Register.Flags>(flags: F): this is Register.WithFlags<F> {
    return (this.flags & flags) === flags;
  }

  /**
   * @deprecated Use `Register.ensure*` instead.
   */
  public checkFlags(flags: Register.Flags) {
    const f = this.flags;

    if ((flags & Register.Flags.CanRead) && !(f & Register.Flags.CanRead)) {
      throw new Error(`register "${this.name}" cannot be used to read text`);
    }
    if ((flags & Register.Flags.CanReadSelections) && !(f & Register.Flags.CanReadSelections)) {
      throw new Error(`register "${this.name}" cannot be used to read selections`);
    }
    if ((flags & Register.Flags.CanReadWriteMacros) && !(f & Register.Flags.CanReadWriteMacros)) {
      throw new Error(`register "${this.name}" cannot be used to play or create recordings`);
    }
    if ((flags & Register.Flags.CanWrite) && !(f & Register.Flags.CanWrite)) {
      throw new Error(`register "${this.name}" cannot be used to save text`);
    }
    if ((flags & Register.Flags.CanWriteSelections) && !(f & Register.Flags.CanWriteSelections)) {
      throw new Error(`register "${this.name}" cannot be used to save selections`);
    }
  }

  /**
   * Returns the current register if it has the given flags, or throws an
   * exception otherwise.
   */
  public withFlags<F extends Register.Flags>(
    flags: F,
  ): this extends Register.WithFlags<F> ? this : never {
    // Note: using `ensureFlags` below throws an exception.
    this.checkFlags(flags);

    return this as any;
  }

  /**
   * Notifies listeners that a {@link onChange change} occured to the register.
   */
  protected notifyChange(kind: Register.ChangeKind) {
    this._onChangeEvent.fire(kind);
  }
}

export /* enum */ namespace Register {
  /**
   * Flags describing the capabilities of a `Register`.
   */
  export const enum Flags {
    /** Register does not have any capability. */
    None = 0,

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

  export const enum ChangeKind {
    Contents,
    Selections,
    Recording,
  }
}

export declare namespace Register {
  /**
   * Given an array of `Flags` types, returns what interfaces correspond to
   * these flags.
   */
  export type InterfacesFromFlags<F extends readonly any[]> =
    F extends [Flags.CanRead,            ...infer Rest] ? Readable                & InterfacesFromFlags<Rest> :
    F extends [Flags.CanReadSelections,  ...infer Rest] ? ReadableSelections      & InterfacesFromFlags<Rest> :
    F extends [Flags.CanReadWriteMacros, ...infer Rest] ? ReadableWriteableMacros & InterfacesFromFlags<Rest> :
    F extends [Flags.CanWrite,           ...infer Rest] ? Writeable               & InterfacesFromFlags<Rest> :
    F extends [Flags.CanWriteSelections, ...infer Rest] ? WriteableSelections     & InterfacesFromFlags<Rest> :
    Register;

  /**
   * Given a set of `Flags`, returns the `Register` type augmented with the
   * interfaces that correspond to these flags.
   */
  export type WithFlags<F extends Flags | readonly Flags[]> =
    InterfacesFromFlags<F extends Flags ? [F] : F>;

  export interface Readable {
    get(): Thenable<readonly string[] | undefined>;
  }

  export interface Writeable {
    set(values: readonly string[] | undefined): Thenable<void>;
  }

  export interface ReadableSelections {
    getSelections(): readonly vscode.Selection[] | undefined;
    getSelectionSet(): TrackedSelection.Set | undefined;
  }

  export interface WriteableSelections {
    replaceSelectionSet(selections?: TrackedSelection.Set): TrackedSelection.Set | undefined;
  }

  export interface ReadableWriteableMacros {
    getRecording(): Recording | undefined;
    setRecording(recording: Recording): void;
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
  public readonly flags = Register.Flags.CanRead
                        | Register.Flags.CanReadSelections
                        | Register.Flags.CanReadWriteMacros
                        | Register.Flags.CanWrite
                        | Register.Flags.CanWriteSelections;

  private _values?: readonly string[];
  private _recording?: Recording;
  private _selections?: TrackedSelection.Set;

  public constructor(
    public readonly name: string,
    public readonly iconName: string,
  ) {
    super();
  }

  public set(values: readonly string[]) {
    this._values = values;
    this.notifyChange(Register.ChangeKind.Contents);

    return Promise.resolve();
  }

  public get() {
    return Promise.resolve(this._values);
  }

  public getSelections() {
    return this._selections?.restore();
  }

  public getSelectionSet() {
    return this._selections;
  }

  public replaceSelectionSet(trackedSelections?: TrackedSelection.Set) {
    const previousSelectionSet = this._selections;

    this._selections = trackedSelections;
    this.notifyChange(Register.ChangeKind.Selections);

    return previousSelectionSet;
  }

  public getRecording() {
    return this._recording;
  }

  public setRecording(recording: Recording) {
    this._recording = recording;
    this.notifyChange(Register.ChangeKind.Recording);
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

  public override get onChange(): vscode.Event<Register.ChangeKind> {
    if (this._listenToChanges === undefined) {
      return super.onChange;
    }

    return (listener) => this._listenToChanges!(() => listener(Register.ChangeKind.Contents));
  }

  public constructor(
    public readonly name: string,
    public readonly iconName: string | undefined,
    public readonly getter: () => Thenable<readonly string[]>,
    public readonly setter?: (values: readonly string[]) => Thenable<void>,
    private readonly _listenToChanges?: (fire: () => void) => vscode.Disposable,
  ) {
    super();
  }

  public get() {
    return this.getter();
  }

  public async set(values: readonly string[]) {
    if (this.setter === undefined) {
      throw new Error("cannot set read-only register");
    }

    await this.setter(values);

    this.notifyChange(Register.ChangeKind.Contents);
  }
}

/**
 * A special register that forwards operations to the system clipboard.
 */
class ClipboardRegister extends Register implements Register.Readable,
                                                    Register.Writeable {
  private _lastStrings?: readonly string[];
  private _lastRawText?: string;

  public readonly name = '"';
  public readonly iconName = "clippy";
  public readonly flags = Register.Flags.CanRead | Register.Flags.CanWrite;

  public async get() {
    const text = await vscode.env.clipboard.readText();

    return text === this._lastRawText ? this._lastStrings : [text];
  }

  public set(values: readonly string[]) {
    let newline = "\n";

    if (Context.currentOrUndefined?.document?.eol === vscode.EndOfLine.CRLF) {
      newline = "\r\n";
    }

    this._lastStrings = values;
    this._lastRawText = values.join(newline);
    this.notifyChange(Register.ChangeKind.Contents);

    return vscode.env.clipboard.writeText(this._lastRawText);
  }
}

function activeEditor() {
  const activeEditor = vscode.window.activeTextEditor;

  EditorRequiredError.throwUnlessAvailable(activeEditor);

  return activeEditor;
}

/**
 * A set of registers.
 */
export abstract class RegisterSet implements vscode.Disposable {
  private readonly _onRegisterChange =
    new vscode.EventEmitter<{ register: Register; kind: "added" | "removed"; }>();
  private readonly _onLastMatchesChange = new vscode.EventEmitter<void>();

  private readonly _named = new Map<string, Register>();
  private readonly _letters = Array.from(
    { length: 26 },
    (_, i) => new GeneralPurposeRegister(String.fromCharCode(97 + i), "symbol-text") as Register,
  );
  private readonly _digits = Array.from(
    { length: 9 },
    (_, i) => new SpecialRegister(
      (i + 1).toString(),
      "regex",
      () => Promise.resolve(this._lastMatches[i]),
      undefined,
      (fire) => this._onLastMatchesChange.event(fire),
    ),
  );

  private _lastMatches: readonly (readonly string[])[] = [];

  /*
   * The system clipboard register set with the
   * `dance.systemClipboardRegister` setting.
   */
  private _systemClipboardRegister: string | undefined = undefined;

  /**
   * The set of registers.
   */
  public get registers() {
    return new Set(this._named.values());
  }

  /**
   * Event fired when a change to the set occurs.
   */
  public get onRegisterChange() {
    return this._onRegisterChange.event;
  }

  /**
   * The '"' (`dquote`) register, default register for edit operations and
   * mapped to the system clipboard by default.
   */
  public get dquote(): Register {
    return this._named.get("dquote")!;
  }
  /**
   * The "/" (`slash`) register, default register for search / regex operations.
   */
  public readonly slash = new GeneralPurposeRegister("/", "search-view-icon");

  /**
   * The "@" (`arobase`) register, default register for recordings (aka macros).
   */
  public readonly arobase = new GeneralPurposeRegister("@", "record");

  /**
   * The "^" (`caret`) register, default register for saving selections.
   */
  public readonly caret = new GeneralPurposeRegister("^", "save");

  /**
   * The "|" (`pipe`) register, default register for outputs of external
   * commands.
   */
  public readonly pipe = new GeneralPurposeRegister("|", "console");

  /**
   * The "%" (`percent`) register, mapped to the name of the current document.
   */
  public readonly percent = new SpecialRegister(
    "%",
    "file",
    () => Promise.resolve([activeEditor().document.fileName]),
    async (values) => {
      if (values.length !== 1) {
        throw new ArgumentError("a single file name must be selected");
      }

      await vscode.workspace.openTextDocument(values[0]);
    },
    (fire) => vscode.window.onDidChangeActiveTextEditor(fire),
  );

  /**
   * The "." (`dot`) register, mapped to the contents of the current selections.
   */
  public readonly dot = new SpecialRegister(
    ".",
    "selection",
    () => {
      const editor = activeEditor(),
            document = editor.document,
            selectionBehavior = Context.currentOrUndefined?.mode?.selectionBehavior,
            selections = selectionBehavior === SelectionBehavior.Character
              ? Selections.fromCharacterMode(editor.selections, document)
              : editor.selections;

      return Promise.resolve(selections.map(document.getText.bind(document)));
    },
    async (values) => {
      const editor = activeEditor();

      if (values.length !== editor.selections.length) {
        throw new ArgumentError("as many selections as values must be given");
      }

      const succeeded = await editor.edit((editBuilder) => {
        const document = editor.document,
              selectionBehavior = Context.currentOrUndefined?.mode?.selectionBehavior,
              selections = selectionBehavior === SelectionBehavior.Character
                ? Selections.fromCharacterMode(editor.selections, document)
                : editor.selections;

        for (let i = 0; i < selections.length; i++) {
          editBuilder.replace(selections[i], values[i]);
        }
      }, noUndoStops);

      EditNotAppliedError.throwIfNotApplied(succeeded);
    },
    (fire) => vscode.window.onDidChangeTextEditorSelection(fire),
  );

  /**
   * The read-only "#" (`hash`) register, mapped to the indices of the current
   * selections.
   */
  public readonly hash = new SpecialRegister(
    "#",
    "symbol-numeric",
    () => Promise.resolve(activeEditor().selections.map((_, i) => i.toString())),
    undefined,
    (fire) => vscode.window.onDidChangeTextEditorSelection(fire),
  );

  /**
   * The read-only "_" (`underscore`) register, mapped to an empty string.
   */
  public readonly underscore = new SpecialRegister("_", undefined, () =>
    Promise.resolve([""]),
  );

  /**
   * The ":" (`colon`) register.
   *
   * In Kakoune it is mapped to the last entered command, but since we don't
   * have access to that information in Dance, we map it to a prompt.
   */
  public readonly colon = new SpecialRegister(":", undefined, async () =>
    [await prompt({ prompt: ":" })],
  );

  /**
   * The `null` register, which forgets selections written to it and always
   * returns no strings.
   */
  public readonly null = new SpecialRegister(
    "null",
    undefined,
    () => Promise.resolve([]),
    () => Promise.resolve(),
  );

  public constructor(extension?: Extension) {
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

    for (let i = 0; i < this._digits.length; i++) {
      this._named.set(`${i + 1}`, this._digits[i]);
    }

    for (let i = 0; i < this._letters.length; i++) {
      const letter = this._letters[i];

      this._named.set(String.fromCharCode(i + 65), letter);
      this._named.set(String.fromCharCode(i + 97), letter);
    }

    this._named.set("", this.null);
    this._named.set("null", this.null);

    // Watch systemClipboardRegister setting and update binding
    if (extension !== undefined) {
      extension.observePreference<string | null>(
        ".systemClipboardRegister",
        (value, validator) => {
          if (!["dquote", null, ...availableClipboardRegisters].includes(value)) {
            value = null;
            validator.reportInvalidSetting(`Invalid systemClipboardRegister value: ${value}`);
          }

          // Reset old value to be a GeneralRegister
          if (this._systemClipboardRegister !== undefined) {
            const icon = this._systemClipboardRegister === "dquote" ? "copy" : "clippy";
            this._named.set(this._systemClipboardRegister, new GeneralPurposeRegister(this._systemClipboardRegister, icon));
          }

          // Set new value to be a ClipboardRegister
          if (value !== null) {
            this._named.set(value, new ClipboardRegister());
          }

          this._systemClipboardRegister = value ?? undefined;
        },
        true,
      );
    }
  }

  public dispose() {
    this._onRegisterChange.dispose();
  }

  /**
   * Returns the register with the given name or identified by the given key if
   * the input is one-character long.
   */
  public get(key: string): Register {
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
        if (charCode >= 49 /* 1 */ && charCode <= 57 /* 9 */) {
          return this._digits[charCode - 49];
        }
      }
    }

    key = key.toLowerCase();

    let register = this._named.get(key);

    if (register === undefined) {
      this._named.set(key, register = new GeneralPurposeRegister(key, "symbol-text"));
    }

    return register;
  }

  /**
   * Updates the contents of the numeric registers to hold the groups matched by
   * the last `RegExp` search operation.
   *
   * @deprecated Do not call -- internal implementation detail.
   */
  public updateRegExpMatches(matches: RegExpMatchArray[]) {
    assert(matches.length > 0);

    const transposed = [] as string[][],
          groupsCount = matches[0].length;

    for (let i = 1; i < groupsCount; i++) {
      const strings = [] as string[];

      for (const match of matches) {
        strings.push(match[i]);
      }

      transposed.push(strings);
    }

    this._lastMatches = transposed;
    this._onLastMatchesChange.fire();
  }
}

/**
 * The set of all registers linked to a specific document.
 */
export class DocumentRegisters extends RegisterSet {
  public constructor(
    /**
     * The document to which the registers are linked.
     */
    public readonly document: vscode.TextDocument,
  ) {
    super();
  }
}

/**
 * The set of all registers.
 */
export class Registers extends RegisterSet {
  private readonly _perDocument = new WeakMap<vscode.TextDocument, DocumentRegisters>();

  /**
   * Returns the registers linked to the given document.
   */
  public forDocument(document: vscode.TextDocument) {
    let registers = this._perDocument.get(document);

    if (registers === undefined) {
      this._perDocument.set(document, registers = new DocumentRegisters(document));
    }

    return registers;
  }

  /**
   * Returns the register with the given name. If the name starts with a space
   * character, the register scoped to the given document will be returned.
   */
  public getPossiblyScoped(name: string, document: vscode.TextDocument) {
    return name.startsWith(" ")
      ? this.forDocument(document).get(name.slice(1))
      : this.get(name);
  }
}
