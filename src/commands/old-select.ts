// Select / extend
// https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#movement
import * as vscode from "vscode";

import { Command, CommandFlags, CommandState, InputKind, define } from ".";
import { moveWhile } from "../api";
import { EditorState } from "../state/editor";
import { SelectionBehavior } from "../state/extension";
import { CharSet, getCharSetFunction } from "../utils/charset";
import {
  Backward,
  Coord,
  CoordMapper,
  Direction,
  DoNotExtend,
  Extend,
  ExtendBehavior,
  Forward,
  RemoveSelection,
  SelectionHelper,
  SelectionMapper,
  moveActiveCoord,
  seekToRange,
} from "../utils/selection-helper";

// Move / extend to word begin / end (w, b, e, W, B, E, alt+[wbe], alt+[WBE])
// ===============================================================================================

function skipEmptyLines(
  coord: Coord,
  document: vscode.TextDocument,
  direction: Direction,
): Coord | undefined {
  let { line } = coord;

  line += direction;
  while (line >= 0 && line < document.lineCount) {
    const textLine = document.lineAt(line);
    if (textLine.text.length > 0) {
      const edge = direction === Backward ? textLine.text.length - 1 : 0;
      return new Coord(line, edge);
    }
    line += direction;
  }
  return undefined;
}

function categorize(
  charCode: number,
  isBlank: (charCode: number) => boolean,
  isWord: (charCode: number) => boolean,
) {
  return isWord(charCode) ? "word" : charCode === 0 || isBlank(charCode) ? "blank" : "punct";
}

function selectByWord(
  editorState: EditorState,
  state: CommandState,
  extend: ExtendBehavior,
  direction: Direction,
  end: boolean,
  wordCharset: CharSet,
) {
  const helper = SelectionHelper.for(editorState, state);
  const { repetitions } = state;
  const document = editorState.editor.document;
  const isWord = getCharSetFunction(wordCharset, document),
        isBlank = getCharSetFunction(CharSet.Blank, document),
        isPunctuation = getCharSetFunction(CharSet.Punctuation, document);

  for (let i = repetitions; i > 0; i--) {
    helper.mapEach(
      seekToRange(
        (from) => {
          let anchor = undefined,
              active = from;
          const text = document.lineAt(active.line).text;
          const lineEndCol = helper.selectionBehavior === SelectionBehavior.Caret
            ? text.length
            : text.length - 1;
            // 1. Starting from active, try to seek to the word start.
          const isAtLineBoundary = direction === Forward
            ? (active.character >= lineEndCol)
            : (active.character === 0);
          if (isAtLineBoundary) {
            const afterEmptyLines = skipEmptyLines(active, document, direction);
            if (afterEmptyLines === undefined) {
              if (direction === Backward && active.line > 0) {
                // This is a special case in Kakoune and we try to mimic it
                // here.
                // Instead of overflowing, put anchor at document start and
                // active always on the first character on the second line.
                return [new Coord(0, 0), new Coord(1, 0)];
              } else {
                // Otherwise the selection overflows.
                return { remove: true, fallback: [anchor, active] };
              }
            }
            anchor = afterEmptyLines;
          } else if (direction === Backward && active.character >= text.length) {
            anchor = new Coord(active.line, text.length - 1);
          } else {
            let shouldSkip;
            if (helper.selectionBehavior === SelectionBehavior.Character) {
              // Skip current character if it is at boundary.
              // (e.g. "ab[c]  " =>`w`)
              const column = active.character;
              shouldSkip
                  = categorize(text.charCodeAt(column), isBlank, isWord)
                  !== categorize(text.charCodeAt(column + direction), isBlank, isWord);
            } else {
              // Ignore the character on the right of the caret.
              shouldSkip = direction === Backward;
            }
            anchor = shouldSkip ? new Coord(active.line, active.character + direction) : active;
          }

          active = anchor;

          // 2. Then scan within the current line until the word ends.

          const curLineText = document.lineAt(active).text;
          let nextCol = active.character; // The next character to be tested.
          if (end) {
            // Select the whitespace before word, if any.
            while (
              nextCol >= 0
                && nextCol < curLineText.length
                && isBlank(curLineText.charCodeAt(nextCol))
            ) {
              nextCol += direction;
            }
          }
          if (nextCol >= 0 && nextCol < curLineText.length) {
            const startCharCode = curLineText.charCodeAt(nextCol);
            const isSameCategory = isWord(startCharCode) ? isWord : isPunctuation;
            while (
              nextCol >= 0
                && nextCol < curLineText.length
                && isSameCategory(curLineText.charCodeAt(nextCol))
            ) {
              nextCol += direction;
            }
          }
          if (!end) {
            // Select the whitespace after word, if any.
            while (
              nextCol >= 0
                && nextCol < curLineText.length
                && isBlank(curLineText.charCodeAt(nextCol))
            ) {
              nextCol += direction;
            }
          }
          // If we reach here, nextCol must be the first character we encounter
          // that does not belong to the current word (or -1 / line break).
          // Exclude it.
          active = new Coord(active.line, nextCol - direction);
          return [anchor!, active];
        },
        extend,
        /* singleCharDirection = */ direction,
      ),
    );
  }
}

define(Command.selectWord, CommandFlags.ChangeSelections, (editorState, state) =>
  selectByWord(editorState, state, DoNotExtend, Forward, false, CharSet.Word),
);
define(Command.selectWordExtend, CommandFlags.ChangeSelections, (editorState, state) =>
  selectByWord(editorState, state, Extend, Forward, false, CharSet.Word),
);
define(Command.selectWordAlt, CommandFlags.ChangeSelections, (editorState, state) =>
  selectByWord(editorState, state, DoNotExtend, Forward, false, CharSet.NonBlank),
);
define(Command.selectWordAltExtend, CommandFlags.ChangeSelections, (editorState, state) =>
  selectByWord(editorState, state, Extend, Forward, false, CharSet.NonBlank),
);
define(Command.selectWordEnd, CommandFlags.ChangeSelections, (editorState, state) =>
  selectByWord(editorState, state, DoNotExtend, Forward, true, CharSet.Word),
);
define(Command.selectWordEndExtend, CommandFlags.ChangeSelections, (editorState, state) =>
  selectByWord(editorState, state, Extend, Forward, true, CharSet.Word),
);
define(Command.selectWordAltEnd, CommandFlags.ChangeSelections, (editorState, state) =>
  selectByWord(editorState, state, DoNotExtend, Forward, true, CharSet.NonBlank),
);
define(
  Command.selectWordAltEndExtend,
  CommandFlags.ChangeSelections,
  (editorState, state) => selectByWord(editorState, state, Extend, Forward, true, CharSet.NonBlank),
);
define(Command.selectWordPrevious, CommandFlags.ChangeSelections, (editorState, state) =>
  selectByWord(editorState, state, DoNotExtend, Backward, true, CharSet.Word),
);
define(
  Command.selectWordPreviousExtend,
  CommandFlags.ChangeSelections,
  (editorState, state) => selectByWord(editorState, state, Extend, Backward, true, CharSet.Word),
);
define(
  Command.selectWordAltPrevious,
  CommandFlags.ChangeSelections,
  (editorState, state) =>
    selectByWord(editorState, state, DoNotExtend, Backward, true, CharSet.NonBlank),
);
define(
  Command.selectWordAltPreviousExtend,
  CommandFlags.ChangeSelections,
  (editorState, state) =>
    selectByWord(editorState, state, Extend, Backward, true, CharSet.NonBlank),
);
