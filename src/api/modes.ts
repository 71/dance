import { Context } from "./context";
import { todo } from "./errors";

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

  if (!count) {
    return context.editorState.setMode(mode);
  }

  const disposable = context.extensionState
    .createAutoDisposable()
    .addDisposable(context.extensionState.onModeDidChange((editorState) => {
      if (editorState !== context.editorState) {
        return;
      }

      if (editorState.mode !== mode) {
        disposable.dispose();
      }
    }))
    .disposeOnEvent(context.editorState.onEditorWasClosed);

  // TODO: watch document changes and command executions
  return context.editorState.setMode(mode);
}
