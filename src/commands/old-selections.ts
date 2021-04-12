// Manipulate existing selections.
import * as vscode from "vscode";

import { Command, CommandFlags, CommandState, InputKind, define } from ".";
import {
  Backward,
  Direction,
  DoNotExtend,
  Forward,
  SelectionHelper,
  SelectionMapper,
  jumpTo,
} from "../utils/selection-helper";
import { EditorState } from "../state/editor";
import { Mode } from "../mode";

// Clear, filter (spc, a-spc, a-k, a-K)
// ===============================================================================================

define(Command.selectionsClear, CommandFlags.ChangeSelections, ({ editor }) => {
  editor.selections = [editor.selection];
});

define(Command.selectionsClearMain, CommandFlags.ChangeSelections, ({ editor }) => {
  const selections = editor.selections;

  if (selections.length > 1) {
    selections.shift();
    editor.selections = selections;
  }
});

define(
  Command.selectionsKeepMatching,
  CommandFlags.ChangeSelections,
  InputKind.RegExp,
  () => "",
  ({ editor }, { input: regex }) => {
    const document = editor.document,
          newSelections = editor.selections.filter((selection) =>
            regex.test(document.getText(selection)),
          );

    if (newSelections.length > 0) {
      editor.selections = newSelections;
    }
  },
);

define(
  Command.selectionsClearMatching,
  CommandFlags.ChangeSelections,
  InputKind.RegExp,
  () => "",
  ({ editor }, { input: regex }) => {
    const document = editor.document,
          newSelections = editor.selections.filter(
            (selection) => !regex.test(document.getText(selection)),
          );

    if (newSelections.length > 0) {
      editor.selections = newSelections;
    }
  },
);

// Split lines, select first & last, merge (a-s, a-S, a-_)
// ===============================================================================================

define(Command.selectFirstLast, CommandFlags.ChangeSelections, ({ editor }) => {
  const { document, selections } = editor,
        len = selections.length,
        newSelections = [] as vscode.Selection[];

  for (let i = 0; i < len; i++) {
    const selection = selections[i],
          selectionStartOffset = document.offsetAt(selection.start),
          selectionEndOffset = document.offsetAt(selection.end);

    if (selectionEndOffset - selectionStartOffset < 2) {
      newSelections.push(selection);
    } else {
      // Select start character.
      {
        const start = selection.start,
              end = document.positionAt(document.offsetAt(start) + 1);

        newSelections.push(new vscode.Selection(start, end));
      }

      // Select end character.
      {
        const end = selection.end,
              start = document.positionAt(document.offsetAt(end) - 1);

        newSelections.push(new vscode.Selection(start, end));
      }
    }
  }

  editor.selections = newSelections;
});

// Copy selections (C, a-C)
// ===============================================================================================

function tryCopySelection(
  selectionHelper: SelectionHelper<EditorState>,
  document: vscode.TextDocument,
  selection: vscode.Selection,
  newActiveLine: number,
) {
  const active = selection.active,
        anchor = selection.anchor,
        activeLine = selectionHelper.activeLine(selection);

  if (activeLine === anchor.line) {
    const newLine = document.lineAt(newActiveLine);

    // TODO: Generalize below for all cases
    return newLine.text.length >= selection.end.character
      ? new vscode.Selection(anchor.with(newActiveLine),
                             active.with(newActiveLine, selectionHelper.activeCharacter(selection)))
      : undefined;
  }

  const newAnchorLine = newActiveLine + anchor.line - activeLine;

  if (newAnchorLine < 0 || newAnchorLine >= document.lineCount) {
    return undefined;
  }

  const newAnchorTextLine = document.lineAt(newAnchorLine);

  if (anchor.character > newAnchorTextLine.text.length) {
    return undefined;
  }

  const newActiveTextLine = document.lineAt(newActiveLine);

  if (active.character > newActiveTextLine.text.length) {
    return undefined;
  }

  const newSelection = new vscode.Selection(anchor.with(newAnchorLine), active.with(newActiveLine));
  const hasOverlap
    = !(
      selection.start.line < newSelection.start.line
      || (selection.end.line === newSelection.start.line
        && selection.end.character < newSelection.start.character)
    )
    && !(
      newSelection.start.line < selection.start.line
      || (newSelection.end.line === selection.start.line
        && newSelection.end.character < selection.start.character)
    );

  if (hasOverlap) {
    return undefined;
  }

  return newSelection;
}

function copySelections(
  editorState: EditorState,
  { repetitions }: CommandState,
  direction: Direction,
) {
  const editor = editorState.editor,
        selections = editor.selections,
        len = selections.length,
        document = editor.document,
        lineCount = document.lineCount,
        selectionHelper = SelectionHelper.for(editorState);

  for (let i = 0; i < len; i++) {
    const selection = selections[i],
          selectionActiveLine = selectionHelper.activeLine(selection);

    for (
      let i = 0, currentLine = selectionActiveLine + direction;
      i < repetitions && currentLine >= 0 && currentLine < lineCount;

    ) {
      const copiedSelection = tryCopySelection(selectionHelper, document, selection, currentLine);

      if (copiedSelection !== undefined) {
        if (!selections.some((s) => s.contains(copiedSelection))) {
          selections.push(copiedSelection);
        }

        i++;

        if (direction === Backward) {
          currentLine = copiedSelection.end.line - 1;
        } else {
          currentLine = copiedSelection.start.line + 1;
        }
      } else {
        currentLine += direction;
      }
    }
  }

  editor.selections = selections;
}

define(Command.selectCopy, CommandFlags.ChangeSelections, (editorState, state) =>
  copySelections(editorState, state, Forward),
);
define(Command.selectCopyBackwards, CommandFlags.ChangeSelections, (editorState, state) =>
  copySelections(editorState, state, Backward),
);
