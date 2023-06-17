import * as vscode from "vscode";

import type { PerEditorState } from "../state/editors";

/**
 * Asserts that the given condition is true.
 */
export function assert(condition: boolean): asserts condition {
  if (!condition) {
    const error = new Error(
      "internal assertion failed; please report this error on https://github.com/71/dance/issues. "
      + "its stacktrace is available in the developer console (Command Palette > Open Developer "
      + "Tools).",
    );

    // Log error to ensure its stacktrace can be found.
    console.error(error);

    throw error;
  }
}

/**
 * An error thrown when no selections remain.
 */
export class EmptySelectionsError extends Error {
  public constructor(message = "no selections remain") {
    super(message);
  }

  /**
   * Throws if the given selections are empty.
   */
  public static throwIfEmpty(selections: readonly vscode.Selection[]) {
    if (selections.length === 0) {
      throw new EmptySelectionsError();
    }
  }

  /**
   * Throws if the selections of the given register are empty.
   */
  public static throwIfRegisterIsEmpty<T>(
    selections: readonly T[] | undefined,
    registerName: string,
  ): asserts selections is readonly T[] {
    if (selections === undefined || selections.length === 0) {
      throw new EmptySelectionsError(`no selections are saved in register "${registerName}"`);
    }
  }
}

/**
 * Error thrown when a given argument is not as expected.
 */
export class ArgumentError extends Error {
  public constructor(message: string, public readonly argumentName?: string) {
    super(message);
  }

  public static validate(
    argumentName: string,
    condition: boolean,
    message: string | (() => string),
  ): asserts condition {
    if (!condition) {
      if (typeof message === "function") {
        message = message();
      }

      throw new ArgumentError(message, argumentName);
    }
  }
}

/**
 * Error thrown when a user input is not as expected.
 */
export class InputError extends ArgumentError {
  public constructor(message: string) {
    super(message, "input");
  }

  public static validateInput(
    condition: boolean,
    message: string,
  ): asserts condition {
    if (!condition) {
      throw new this(message);
    }
  }
}

/**
 * Error thrown when a function that is expected to return a selection returns
 * something else.
 */
export class NotASelectionError extends ArgumentError {
  public constructor(public readonly value: unknown) {
    super("value is not a selection");
  }

  /**
   * Throws if the given value is not a `vscode.Selection`.
   */
  public static throwIfNotASelection(value: unknown): asserts value is vscode.Selection {
    if (!(value instanceof vscode.Selection)) {
      throw new NotASelectionError(value);
    }
  }

  /**
   * Throws if the given list contains a value that is not a `vscode.Selection`,
   * or if the list is empty.
   */
  public static throwIfNotASelectionArray(value: unknown): asserts value is vscode.Selection[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new EmptySelectionsError();
    }

    for (let i = 0, len = value.length; i < len; i++) {
      NotASelectionError.throwIfNotASelection(value[i]);
    }
  }
}

/**
 * Error thrown when an action requiring an editor is executed without an
 * active `vscode.TextEditor`.
 */
export class EditorRequiredError extends Error {
  public constructor() {
    super("active editor required");
  }

  public static throwUnlessAvailable<T extends PerEditorState | vscode.TextEditor>(
    editorState: T | undefined,
  ): asserts editorState is T {
    if (editorState === undefined) {
      throw new EditorRequiredError();
    }
  }
}

/**
 * Error thrown when a cancellation is requested.
 */
export class CancellationError extends Error {
  public constructor(
    public readonly reason: CancellationError.Reason,
  ) {
    super(reason);
  }

  public static throwIfCancellationRequested(token: vscode.CancellationToken) {
    if (token.isCancellationRequested) {
      throw new CancellationError(CancellationError.Reason.CancellationToken);
    }
  }
}

export /* enum */ namespace CancellationError {
  export const enum Reason {
    CancellationToken = "cancellation token was used",
    PressedEscape = "user pressed <escape>",
  }
}

/**
 * Error thrown when two arrays that are expected to have the same length have
 * different lengths
 */
export class LengthMismatchError extends Error {
  public constructor() {
    super("length mismatch");
  }

  public static throwIfLengthMismatch<A, B>(a: readonly A[], b: readonly B[]) {
    if (a.length !== b.length) {
      throw new LengthMismatchError();
    }
  }
}

/**
 * An error thrown when a `TextEditor.edit` call returns `false`.
 */
export class EditNotAppliedError extends Error {
  public constructor() {
    super("TextEditor edit failed");
  }

  /**
   * Throws if the given value is `false`.
   */
  public static throwIfNotApplied(editWasApplied: boolean): asserts editWasApplied {
    if (!editWasApplied) {
      throw new EditNotAppliedError();
    }
  }
}
