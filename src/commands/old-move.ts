// Movement
// https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode from "vscode";

import { Command, CommandFlags, define } from ".";
import {
  Backward,
  Direction,
  DoNotExtend,
  Extend,
  ExtendBehavior,
  Forward,
  jumpTo,
} from "../utils/selection-helper";
import { Coord, SelectionHelper } from "../utils/selection-helper";
import { SelectionBehavior } from "../state/extension";

// Move around (h, j, k, l, H, J, K, L, arrows, shift+arrows)
// ===============================================================================================

function revealActiveTowards(direction: Direction, editor: vscode.TextEditor) {
  let revealPosition = undefined as vscode.Position | undefined;
  for (let i = 0; i < editor.selections.length; i++) {
    const activePosition = editor.selections[i].active;

    if (revealPosition === undefined || revealPosition.compareTo(activePosition) * direction > 0) {
      revealPosition = activePosition;
    }
  }
  editor.revealRange(new vscode.Range(revealPosition!, revealPosition!));
}

function registerMoveHorizontal(command: Command, direction: Direction, extend: ExtendBehavior) {
  const selectionMapper = jumpTo((from, helper) => {
    return helper.coordAt(helper.offsetAt(from) + helper.state.repetitions * direction);
  }, extend);

  define(command, CommandFlags.ChangeSelections, (editorState, state) => {
    SelectionHelper.for(editorState, state).mapEach(selectionMapper);
    revealActiveTowards(direction, editorState.editor);
  });
}

function registerMoveVertical(command: Command, direction: Direction, extend: ExtendBehavior) {
  const selectionMapper = jumpTo((from, helper, i) => {
    const targetLine = from.line + helper.state.repetitions * direction;
    let actualLine = targetLine;
    if (actualLine < 0) {
      actualLine = 0;
    } else if (targetLine > helper.editor.document.lineCount - 1) {
      actualLine = helper.editor.document.lineCount - 1;
    }

    const lineLen = helper.editor.document.lineAt(actualLine).text.length;
    if (lineLen === 0) {
      // Select the line break on an empty line.
      return new Coord(actualLine, 0);
    }

    const preferredColumn = helper.editorState.preferredColumns![i];
    if (preferredColumn >= lineLen) {
      if (helper.selectionBehavior === SelectionBehavior.Character) {
        return new Coord(actualLine, lineLen - 1);
      } else {
        return new Coord(actualLine, lineLen);
      }
    }
    return new Coord(actualLine, preferredColumn);
  }, extend);

  define(
    command,
    CommandFlags.ChangeSelections | CommandFlags.DoNotResetPreferredColumns,
    (editorState, state) => {
      const { editor, preferredColumns } = editorState,
            selectionHelper = SelectionHelper.for(editorState, state);

      if (preferredColumns.length === 0) {
        for (let i = 0; i < editor.selections.length; i++) {
          const column = selectionHelper.activeCoord(editor.selections[i]).character;

          preferredColumns.push(column);
        }
      }
      SelectionHelper.for(editorState, state).mapEach(selectionMapper);
      revealActiveTowards(direction, editorState.editor);
    },
  );
}

// Move/extend left/down/up/right

registerMoveHorizontal(Command.left, Backward, DoNotExtend);
registerMoveHorizontal(Command.leftExtend, Backward, Extend);
registerMoveHorizontal(Command.right, Forward, DoNotExtend);
registerMoveHorizontal(Command.rightExtend, Forward, Extend);
registerMoveVertical(Command.up, Backward, DoNotExtend);
registerMoveVertical(Command.upExtend, Backward, Extend);
registerMoveVertical(Command.down, Forward, DoNotExtend);
registerMoveVertical(Command.downExtend, Forward, Extend);

// Move up/down (ctrl-[bfud])
// ===============================================================================================

function scrollBy(iterations: number, to: "up" | "down", by: "page" | "halfPage") {
  return vscode.commands.executeCommand("editorScroll", {
    to,
    by,
    value: iterations,
    revealCursor: true,
  }) as Promise<void>;
}

define(Command.upPage, CommandFlags.ChangeSelections, (_, { repetitions }) =>
  scrollBy(repetitions, "up", "page"),
);
define(Command.upHalfPage, CommandFlags.ChangeSelections, (_, { repetitions }) =>
  scrollBy(repetitions, "up", "halfPage"),
);
define(Command.downPage, CommandFlags.ChangeSelections, (_, { repetitions }) =>
  scrollBy(repetitions, "down", "page"),
);
define(Command.downHalfPage, CommandFlags.ChangeSelections, (_, { repetitions }) =>
  scrollBy(repetitions, "down", "halfPage"),
);

// Other bindings (%)
// ===============================================================================================

define(Command.selectBuffer, CommandFlags.ChangeSelections, ({ editor }) => {
  const start = new vscode.Position(0, 0);
  const end = editor.document.lineAt(editor.document.lineCount - 1).range.end;

  editor.selection = new vscode.Selection(start, end);
});
