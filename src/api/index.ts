import * as vscode from "vscode";

export * from "./clipboard";
export * from "./context";
export * from "./edit";
export * from "./edit/linewise";
export * from "./errors";
export * from "./functional";
export * from "./history";
export * from "./keybindings";
export * from "./lines";
export * from "./menu";
export * from "./modes";
export * from "./positions";
export * from "./prompt";
export * from "./registers";
export * from "./run";
export * from "./search";
export * from "./search/lines";
export * from "./search/move";
export * from "./search/move-to";
export * from "./search/pairs";
export * from "./search/range";
export * from "./search/word";
export * from "./selections";

/**
 * Direction of an operation.
 */
export const enum Direction {
  /**
   * Forward direction (`1`).
   */
  Forward = 1,

  /**
   * Backward direction (`-1`).
   */
  Backward = -1,
}

/**
 * Behavior of a shift.
 */
export const enum Shift {
  /**
   * Jump to the position.
   */
  Jump,

  /**
   * Select to the position.
   */
  Select,

  /**
   * Extend to the position.
   */
  Extend,
}

/**
 * Selection behavior of an operation.
 */
export const enum SelectionBehavior {
  /**
   * VS Code-like caret selections.
   */
  Caret = 1,
  /**
   * Kakoune-like character selections.
   */
  Character = 2,
}

export const Forward = Direction.Forward,
             Backward = Direction.Backward,
             Jump = Shift.Jump,
             Select = Shift.Select,
             Extend = Shift.Extend;

/**
 * Returns the module exported by the extension with the given identifier.
 */
export function extension<T>(extensionId: string) {
  return vscode.extensions.getExtension<T>(extensionId)?.exports;
}
