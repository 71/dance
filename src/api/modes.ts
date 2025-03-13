import { Context } from "./context";

/**
 * Switches to the mode with the given name.
 */
export function toMode(modeName: string): Thenable<void>;

/**
 * Temporarily switches to the mode with the given name.
 */
export function toMode(modeName: string, count: number): Thenable<void>;

export async function toMode(modeName: string, count?: number) {
  const context = Context.current,
        extension = context.extension,
        mode = findMode(modeName, context);
  if (mode === undefined || mode.isPendingDeletion) {
    throw new Error(`mode ${JSON.stringify(modeName)} does not exist`);
  }

  if (!count) {
    return context.switchToMode(mode);
  }

  const editorState = context.getState(),
        initialMode = editorState.mode,
        disposable = extension
          .createAutoDisposable()
          .disposeOnEvent(editorState.onVisibilityDidChange)
          .addDisposable({
            dispose() {
              context.switchToMode(initialMode);
            },
          });

  await context.switchToMode(mode);

  // We must start listening for events after a short delay, otherwise we will
  // be notified of the mode change above, immediately returning to the
  // previous mode.
  setTimeout(() => {
    const { Entry } = extension.recorder;

    disposable
      .addDisposable(extension.recorder.onDidAddEntry((entry) => {
        if (entry instanceof Entry.ExecuteCommand
          && entry.descriptor().identifier.endsWith("updateCount")) {
          // Ignore number inputs.
          return;
        }

        if (entry instanceof Entry.ChangeTextEditor
          || entry instanceof Entry.ChangeTextEditorMode) {
          // Immediately dispose.
          return disposable.dispose();
        }

        if (--count! === 0) {
          disposable.dispose();
        }
      }));
  }, 0);
}

/**
 * Returns the {@link Mode} with the given name, prioritizing one that's within the name "namespace"
 * as the current mode.
 */
function findMode(modeName: string, context?: Context) {
  context = context ?? Context.current;

  const currentMode = context.mode,
        split = currentMode.name.split("/");
  if (split.length === 2) {
    const namespacedMode = context.extension.modes.get(`${split[0]}/${modeName}`);
    if (namespacedMode !== undefined) {
      return namespacedMode;
    }
  }

  return context.extension.modes.get(modeName);
}
