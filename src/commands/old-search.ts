// Search
// https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#searching
import * as vscode from "vscode";

function needleInHaystack(
  direction: Direction,
  allowWrapping: boolean,
): (
  selection: vscode.Selection,
  helper: SelectionHelper<SearchState>,
) => [Coord, Coord] | undefined {
  return (selection, helper) => {
    const document = helper.editor.document;
    const regex = helper.state.regex!;
    // Try finding in the normal search range first, then the wrapped search
    // range.
    for (const isWrapped of [false, true]) {
      const searchRange = getSearchRange(selection, document, direction, isWrapped);
      const text = document.getText(searchRange);
      regex.lastIndex = 0;
      const match = direction === Forward ? regex.exec(text) : execFromEnd(regex, text);
      if (match) {
        const startOffset = helper.offsetAt(searchRange.start) + match.index;
        const firstCharacter = helper.coordAt(startOffset);
        const lastCharacter = helper.coordAt(startOffset + match[0].length - 1);
        return [firstCharacter, lastCharacter];
      }
      if (!allowWrapping) {
        break;
      }
    }
    return undefined;
  };
}

function nextNeedleInHaystack(
  direction: Direction,
): (
  selection: vscode.Selection,
  helper: SelectionHelper<SearchState>,
) => vscode.Selection | undefined {
  const find = needleInHaystack(direction, /* allowWrapping = */ true);
  return (selection, helper) => {
    const result = find(selection, helper);
    if (result === undefined) {
      return undefined;
    }
    const [start, end] = result;
    // The result selection should always face forward,
    // regardless of old selection or search direction.
    return helper.selectionBetween(start, end);
  };
}

function registerNextCommand(command: Command, direction: Direction, replace: boolean) {
  const mapper = nextNeedleInHaystack(direction);
  define(
    command,
    CommandFlags.ChangeSelections,
    async (editorState, { currentRegister, repetitions }) => {
      const { editor, extension } = editorState;
      const regexStr = await (currentRegister ?? extension.registers.slash).get(editor);

      if (regexStr === undefined || regexStr.length === 0) {
        return;
      }

      const regex = new RegExp(regexStr[0], "g"),
            selections = editor.selections;
      const searchState = { selectionBehavior, regex };
      const helper = SelectionHelper.for(editorState, searchState);
      let cur = selections[0];

      for (let i = repetitions; i > 0; i--) {
        const next = mapper(cur, helper);
        if (next === undefined) {
          throw new Error("no matches found");
        }
        cur = next;

        if (replace) {
          selections[0] = cur;
        } else {
          selections.unshift(cur);
        }
      }

      editor.selections = selections;
    },
  );
}

registerNextCommand(Command.searchNext, Forward, true);
registerNextCommand(Command.searchNextAdd, Forward, false);
registerNextCommand(Command.searchPrevious, Backward, true);
registerNextCommand(Command.searchPreviousAdd, Backward, false);
