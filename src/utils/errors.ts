import * as vscode from "vscode";
import { EditorState } from "../state/editor";

export function assert(condition: boolean): asserts condition {
  console.assert(condition);
}

export class EditorRequiredError extends Error {
  public static throwUnlessAvailable(
    editorState: EditorState | undefined,
  ): asserts editorState is EditorState {
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

export namespace CancellationError {
  export const enum Reason {
    CancellationToken = "cancellation token was used",
    PressedEscape = "user pressed <escape>",
  }
}
