import * as vscode from "vscode";

import { Command, CommandFlags, CommandState, InputKind, define } from ".";
import { Extension } from "../state/extension";
import { noUndoStops } from "../utils/misc";
import { SelectionHelper } from "../utils/selection-helper";

function getRegister(state: CommandState<any>, ctx: Extension) {
  return state.currentRegister ?? ctx.registers.dquote;
}

function deleteSelections(editor: vscode.TextEditor) {
  return editor.edit((builder) => {
    const selections = editor.selections,
          len = selections.length;

    for (let i = 0; i < len; i++) {
      builder.delete(selections[i]);
    }
  }, noUndoStops);
}

define(
  Command.deleteYank,
  CommandFlags.Edit,
  async ({ editor, extension }, state) => {
    const reg = getRegister(state, extension);

    if (reg.canWrite()) {
      await reg.set(editor, editor.selections.map(editor.document.getText));
    }

    await deleteSelections(editor);
  },
);

define(
  Command.deleteInsertYank,
  CommandFlags.Edit | CommandFlags.SwitchToInsertBefore,
  async ({ editor, extension }, state) => {
    const reg = getRegister(state, extension);

    if (reg.canWrite()) {
      await reg.set(editor, editor.selections.map(editor.document.getText));
    }

    await deleteSelections(editor);
  },
);

define(Command.deleteNoYank, CommandFlags.Edit, ({ editor }) => {
  return deleteSelections(editor).then(() => undefined);
});

define(
  Command.deleteInsertNoYank,
  CommandFlags.Edit | CommandFlags.SwitchToInsertBefore,
  ({ editor }) => {
    return deleteSelections(editor).then(() => undefined);
  },
);

define(Command.yank, CommandFlags.None, ({ editor, extension }, state) => {
  const reg = getRegister(state, extension);

  if (reg.canWrite()) {
    return reg.set(editor, editor.selections.map(editor.document.getText));
  }

  return undefined;
});

async function getContentsToPaste(
  editor: vscode.TextEditor,
  state: CommandState<any>,
  ctx: Extension,
) {
  const yanked = await getRegister(state, ctx).get(editor);
  const amount = editor.selections.length;

  if (yanked === undefined) {
    return undefined;
  }

  const results = [] as string[],
        yankedLength = yanked.length;

  let i = 0;

  for (; i < amount && i < yankedLength; i++) {
    results.push(yanked[i]);
  }

  for (; i < amount; i++) {
    results.push(yanked[yankedLength - 1]);
  }

  return results;
}

define(Command.pasteAfter, CommandFlags.Edit, async (editorState, state) => {
  const { editor, extension } = editorState,
        selections = editor.selections,
        selectionHelper = SelectionHelper.for(editorState, state);

  const contents = await getContentsToPaste(editor, state, extension);

  if (contents === undefined) {
    return;
  }

  const selectionLengths = [] as number[];

  await editor.edit((builder) => {
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i],
            selection = selections[i];

      if (content.endsWith("\n")) {
        builder.insert(new vscode.Position(selectionHelper.endLine(selection) + 1, 0), content);
      } else {
        builder.insert(selection.end, content);
      }

      selectionLengths.push(selectionHelper.selectionLength(selection));
    }
  }, noUndoStops);

  // Restore selections that were extended automatically.
  for (let i = 0; i < contents.length; i++) {
    selections[i] = selectionHelper.selectionFromLength(selections[i].anchor, selectionLengths[i]);
  }

  editor.selections = selections;
});

define(
  Command.pasteBefore,
  CommandFlags.Edit,
  async ({ editor, extension }, state) => {
    const contents = await getContentsToPaste(editor, state, extension);

    if (contents === undefined) {
      return;
    }

    await editor.edit((builder) => {
      for (let i = 0; i < contents.length; i++) {
        const content = contents[i],
              selection = editor.selections[i];

        if (content.endsWith("\n")) {
          builder.insert(selection.start.with(undefined, 0), content);
        } else {
          builder.insert(selection.start, content);
        }
      }
    }, noUndoStops);
  },
);

define(
  Command.pasteSelectAfter,
  CommandFlags.ChangeSelections | CommandFlags.Edit,
  async (editorState, state) => {
    const { editor, extension } = editorState,
          contents = await getContentsToPaste(editor, state, extension);

    if (contents === undefined) {
      return;
    }

    const reverseSelection = [] as boolean[],
          selectionHelper = SelectionHelper.for(editorState, state);

    await editor.edit((builder) => {
      for (let i = 0; i < contents.length; i++) {
        const content = contents[i],
              selection = editor.selections[i];

        if (content.endsWith("\n")) {
          builder.insert(selection.end.with(selectionHelper.endLine(selection) + 1, 0), content);
        } else {
          builder.insert(selection.end, content);
        }

        reverseSelection.push(selection.isEmpty);
      }
    }, noUndoStops);

    // Reverse selections that were empty, since they are now extended in the
    // wrong way.
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i];

      if (!content.endsWith("\n") && reverseSelection[i]) {
        editor.selections[i] = new vscode.Selection(
          editor.selections[i].active,
          editor.selections[i].anchor,
        );
      }
    }

    // eslint-disable-next-line no-self-assign
    editor.selections = editor.selections; // Force update.
  },
);

define(
  Command.pasteSelectBefore,
  CommandFlags.ChangeSelections | CommandFlags.Edit,
  async ({ editor, extension }, state) => {
    const contents = await getContentsToPaste(editor, state, extension);

    if (contents === undefined) {
      return;
    }

    await editor.edit((builder) => {
      for (let i = 0; i < contents.length; i++) {
        const content = contents[i],
              selection = editor.selections[i];

        if (content.endsWith("\n")) {
          builder.replace(selection.start.with(undefined, 0), content);
        } else {
          builder.replace(selection.start, content);
        }
      }
    }, noUndoStops);
  },
);

define(
  Command.pasteReplace,
  CommandFlags.Edit,
  async ({ editor, extension }, state) => {
    const contents = await getContentsToPaste(editor, state, extension);
    if (contents === undefined) {
      return;
    }

    const reg = getRegister(state, extension);
    if (reg.canWrite()) {
      await reg.set(editor, editor.selections.map(editor.document.getText));
    }

    await editor.edit((builder) => {
      for (let i = 0; i < contents.length; i++) {
        const content = contents[i],
              selection = editor.selections[i];

        builder.replace(selection, content);
      }
    }, noUndoStops);
  },
);

define(
  Command.pasteReplaceEvery,
  CommandFlags.Edit,
  async ({ editor, extension }, state) => {
    const selections = editor.selections;
    const contents = await getRegister(state, extension).get(editor);

    if (contents === undefined || contents.length !== selections.length) {
      return;
    }

    await editor.edit((builder) => {
      for (let i = 0; i < contents.length; i++) {
        builder.replace(selections[i], contents[i]);
      }
    }, noUndoStops);
  },
);
