import { Context } from "./context";

/**
 * Switches to the mode with the given name.
 */
export function toMode(modeName: string): Thenable<void>;

/**
 * Temporarily switches to the mode with the given name.
 */
export function toMode(modeName: string, count: number): Thenable<void>;

export function toMode(modeName: string, count?: number) {
  const context = Context.current,
        mode = context.extensionState.modes.get(modeName);

  if (mode === undefined || mode.isPendingDeletion) {
    throw new Error(`mode ${JSON.stringify(modeName)} does not exist`);
  }

  if (count === undefined) {
    return context.editorState.setMode(mode);
  }

  context.editorState.setMode(mode, true);
  // TODO: watch document changes and command executions
}
