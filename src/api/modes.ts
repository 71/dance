import { Context } from ".";

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
        mode = context.extension.modes.get(modeName);

  if (mode === undefined || mode.isPendingDeletion) {
    throw new Error(`mode ${JSON.stringify(modeName)} does not exist`);
  }

  if (!count) {
    return context.switchToMode(mode);
  }

  const editorState = context.getState();

  const disposable = context.extension
    .createAutoDisposable()
    .addDisposable(context.extension.editors.onModeDidChange((editorState) => {
      if (editorState.editor === context.editor && editorState.mode !== mode) {
        disposable.dispose();
      }
    }))
    .disposeOnEvent(editorState.onVisibilityDidChange);

  // TODO: watch document changes and command executions
  return context.switchToMode(mode);
}
