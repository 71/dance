import * as vscode from "vscode";

import { Command, CommandDescriptor, CommandFlags, registerCommand } from ".";
import { SelectionBehavior } from "../state/extension";
import { SelectionHelper } from "../utils/selectionHelper";

registerCommand(
  Command.insertBefore,
  CommandFlags.ChangeSelections | CommandFlags.SwitchToInsertBefore,
  () => {
    // Nop.
  },
);

registerCommand(
  Command.insertAfter,
  CommandFlags.ChangeSelections | CommandFlags.SwitchToInsertAfter,
  () => {
    // Nop.
  },
);

registerCommand(
  Command.insertLineStart,
  CommandFlags.ChangeSelections | CommandFlags.SwitchToInsertBefore,
  ({ editor }) => {
    const selections = editor.selections,
          len = selections.length;

    for (let i = 0; i < len; i++) {
      const selection = selections[i],
            lineStart = editor.document.lineAt(selection.start.line)
              .firstNonWhitespaceCharacterIndex;

      selections[i] = new vscode.Selection(
        selection.anchor,
        new vscode.Position(selection.start.line, lineStart),
      );
    }

    editor.selections = selections;
  },
);

registerCommand(
  Command.insertLineEnd,
  CommandFlags.ChangeSelections | CommandFlags.SwitchToInsertAfter,
  ({ editor }) => {
    const selections = editor.selections,
          len = selections.length;

    for (let i = 0; i < len; i++) {
      const selection = selections[i];

      selections[i] = new vscode.Selection(
        selection.anchor,
        new vscode.Position(selection.end.line, Number.MAX_SAFE_INTEGER),
      );
    }

    editor.selections = selections;
  },
);

function normalizeSelectionsForLineInsertion(editor: vscode.TextEditor) {
  editor.selections = editor.selections.map((selection) => {
    let { active } = selection;

    if (active.character === 0 && !selection.isReversed && active.line > 0) {
      active = active.translate(-1);
    }

    return new vscode.Selection(active, active);
  });
}

registerCommand(
  Command.insertNewLineAbove,
  CommandFlags.Edit | CommandFlags.SwitchToInsertBefore,
  ({ editor }, { selectionBehavior }) => {
    if (selectionBehavior === SelectionBehavior.Character) {
      normalizeSelectionsForLineInsertion(editor);
    }

    return vscode.commands.executeCommand("editor.action.insertLineBefore");
  },
);

registerCommand(
  Command.insertNewLineBelow,
  CommandFlags.Edit | CommandFlags.SwitchToInsertBefore,
  ({ editor }, { selectionBehavior }) => {
    if (selectionBehavior === SelectionBehavior.Character) {
      normalizeSelectionsForLineInsertion(editor);
    }

    return vscode.commands.executeCommand("editor.action.insertLineAfter");
  },
);

registerCommand(Command.newLineAbove, CommandFlags.Edit, (editorState, state, undoStops) =>
  editorState.editor
    .edit((builder) => {
      const { editor } = editorState;
      const newLine = editor.document.eol === vscode.EndOfLine.LF ? "\n" : "\r\n";
      const processedLines = new Set<number>();

      const selections = editor.selections,
            len = selections.length,
            selectionHelper = SelectionHelper.for(editorState, state);

      for (let i = 0; i < len; i++) {
        const selection = selections[i],
              activeLine
            = selection.active === selection.end
              ? selectionHelper.endLine(selection)
              : selection.active.line;

        if (processedLines.size !== processedLines.add(activeLine).size) {
          builder.insert(new vscode.Position(activeLine, 0), newLine);
        }
      }
    }, undoStops)
    .then(() => void 0),
);

registerCommand(Command.newLineBelow, CommandFlags.Edit, (editorState, state, undoStops) =>
  editorState.editor
    .edit((builder) => {
      const { editor } = editorState;
      const newLine = editor.document.eol === vscode.EndOfLine.LF ? "\n" : "\r\n";
      const processedLines = new Set<number>();

      const selections = editor.selections,
            len = selections.length,
            selectionHelper = SelectionHelper.for(editorState, state);

      for (let i = 0; i < len; i++) {
        const selection = selections[i],
              activeLine
            = selection.active === selection.end
              ? selectionHelper.endLine(selection)
              : selection.active.line;

        if (processedLines.size !== processedLines.add(activeLine).size) {
          builder.insert(new vscode.Position(activeLine + 1, 0), newLine);
        }
      }
    }, undoStops)
    .then(() => void 0),
);

registerCommand(Command.repeatInsert, CommandFlags.Edit, async ({ editor }, state) => {
  const editorState = state.extension.getEditorState(editor);

  let switchToInsert: undefined | typeof editorState.recordedCommands[0];
  let i = editorState.recordedCommands.length - 1;

  for (; i >= 0; i--) {
    if (editorState.recordedCommands[i].descriptor.flags & CommandFlags.SwitchToInsertBefore) {
      switchToInsert = editorState.recordedCommands[i];
      break;
    }
  }

  if (switchToInsert === undefined) {
    return;
  }

  const start = i;
  let switchToNormal: undefined | typeof editorState.recordedCommands[0];

  for (i++; i < editorState.recordedCommands.length; i++) {
    if (editorState.recordedCommands[i].descriptor.flags & CommandFlags.SwitchToNormal) {
      switchToNormal = editorState.recordedCommands[i];
      break;
    }
  }

  if (switchToNormal === undefined) {
    return;
  }

  await CommandDescriptor.execute(editorState, editorState.recordedCommands[start]);

  const end = i;

  await editor.edit((builder) => {
    for (let i = state.currentCount || 1; i > 0; i--) {
      for (let j = start; j <= end; j++) {
        const commandState = editorState.recordedCommands[j],
              changes = commandState.followingChanges;

        if (changes === undefined) {
          continue;
        }

        for (const change of changes) {
          if (change.rangeLength === 0) {
            builder.insert(editor.selection.active, change.text);
          } else {
            builder.replace(editor.selection, change.text);
          }
        }
      }
    }
  });
});
