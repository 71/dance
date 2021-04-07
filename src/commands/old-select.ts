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

// Line selecting key bindings (x, X, alt+[xX], home, end)
// ===============================================================================================

define(
  Command.selectLine,
  CommandFlags.ChangeSelections,
  (editorState, { currentCount }) => {
    const editor = editorState.editor,
          selections = editor.selections,
          len = selections.length,
          selectionHelper = SelectionHelper.for(editorState);

    if (currentCount === 0 || currentCount === 1) {
      for (let i = 0; i < len; i++) {
        const selection = selections[i],
              isFullLine = selectionHelper.isEntireLines(selection);
        let line = selectionHelper.activeLine(selection);

        if (isFullLine) {
          line++;
        }

        selections[i] = new vscode.Selection(line, 0, line + 1, 0);
      }
    } else {
      for (let i = 0; i < len; i++) {
        const selection = selections[i],
              targetLine = Math.min(
                selectionHelper.activeLine(selection) + currentCount - 1,
                editor.document.lineCount - 1,
              );

        selections[i] = new vscode.Selection(targetLine, 0, targetLine + 1, 0);
      }
    }

    editor.selections = selections;
  },
);

define(
  Command.selectLineExtend,
  CommandFlags.ChangeSelections,
  (editorState, { currentCount, selectionBehavior }) => {
    const editor = editorState.editor,
          selections = editor.selections,
          len = selections.length,
          selectionHelper = SelectionHelper.for(editorState);

    if (currentCount === 0 || currentCount === 1) {
      for (let i = 0; i < len; i++) {
        const selection = selections[i],
              isSameLine = selectionHelper.isSingleLine(selection),
              isFullLineDiff = selectionHelper.isEntireLine(selection) ? 1 : 0;

        const anchor = isSameLine ? selection.anchor.with(undefined, 0) : selection.anchor;
        const active
          = selection.active.character === 0 && !selection.isReversed && !isSameLine
            ? selection.active.translate(1 + isFullLineDiff)
            : new vscode.Position(selectionHelper.activeLine(selection) + 1 + isFullLineDiff, 0);

        selections[i] = new vscode.Selection(anchor, active);
      }
    } else {
      for (let i = 0; i < len; i++) {
        const selection = selections[i],
              targetLine = Math.min(
                selectionHelper.activeLine(selection) + currentCount - 1,
                editor.document.lineCount - 1,
              ),
              isSameLine = selectionHelper.isSingleLine(selection);

        const anchor = isSameLine ? selection.anchor.with(undefined, 0) : selection.anchor;
        const active = new vscode.Position(targetLine + 1, 0);

        selections[i] = new vscode.Selection(anchor, active);
      }
    }

    editor.selections = selections;
  },
);

const toLineBegin: CoordMapper = (from) => from.with(undefined, 0);

const selectToLineBegin = moveActiveCoord(toLineBegin, DoNotExtend);
define(Command.selectToLineBegin, CommandFlags.ChangeSelections, (editorState, state) => {
  SelectionHelper.for(editorState, state).mapEach(selectToLineBegin);
});

const selectToLineBeginExtend = moveActiveCoord(toLineBegin, Extend);
define(
  Command.selectToLineBeginExtend,
  CommandFlags.ChangeSelections,
  (editorState, state) => {
    SelectionHelper.for(editorState, state).mapEach(selectToLineBeginExtend);
  },
);

const toLineEnd: CoordMapper = (from, helper) => {
  let newCol = helper.editor.document.lineAt(from.line).text.length;
  if (newCol > 0 && helper.selectionBehavior === SelectionBehavior.Character) {
    newCol--;
  }
  return from.with(undefined, newCol);
};

const selectToLineEnd = moveActiveCoord(toLineEnd, DoNotExtend);
define(Command.selectToLineEnd, CommandFlags.ChangeSelections, (editorState, state) => {
  SelectionHelper.for(editorState, state).mapEach(selectToLineEnd);
});

const selectToLineEndExtend = moveActiveCoord(toLineEnd, Extend);
define(
  Command.selectToLineEndExtend,
  CommandFlags.ChangeSelections,
  (editorState, state) => {
    SelectionHelper.for(editorState, state).mapEach(selectToLineEndExtend);
  },
);

const expandLine: SelectionMapper = (selection, helper) => {
  // This command is idempotent. state.currentCount is intentionally ignored.
  const { start, end } = selection,
        document = helper.editor.document;
  // Move start to line start and end to include line break.
  const newStart = start.with(undefined, 0);
  let newEnd;
  if (end.character === 0) {
    // End is next line start, which means the selection already includes
    // the line break of last line.
    newEnd = end;
  } else if (end.line + 1 < document.lineCount) {
    // Move end to the next line start to include the line break.
    newEnd = new vscode.Position(end.line + 1, 0);
  } else {
    // End is at the last line, so try to include all text.
    const textLen = document.lineAt(end.line).text.length;
    newEnd = end.with(undefined, textLen);
  }
  // After expanding, the selection should be in the same direction as before.
  if (selection.isReversed) {
    return new vscode.Selection(newEnd, newStart);
  } else {
    return new vscode.Selection(newStart, newEnd);
  }
};

define(Command.expandLines, CommandFlags.ChangeSelections, (editorState, state) => {
  SelectionHelper.for(editorState, state).mapEach(expandLine);
});

const trimToFullLines: SelectionMapper = (selection, helper) => {
  // This command is idempotent. state.currentCount is intentionally ignored.
  const { start, end } = selection;
  // If start is not at line start, move it to the next line start.
  const newStart = start.character === 0 ? start : new vscode.Position(start.line + 1, 0);
  // Move end to the line start, so that the selection ends with a line break.
  const newEnd = end.with(undefined, 0);

  if (newStart.isAfterOrEqual(newEnd)) {
    return RemoveSelection;
  } // No full line contained.

  // After trimming, the selection should be in the same direction as before.
  // Except when selecting only one empty line in non-directional mode, prefer
  // to keep the selection facing forward.
  if (selection.isReversed
      && !(helper.selectionBehavior === SelectionBehavior.Character
           && newStart.line + 1 === newEnd.line)) {
    return new vscode.Selection(newEnd, newStart);
  } else {
    return new vscode.Selection(newStart, newEnd);
  }
};

define(Command.trimLines, CommandFlags.ChangeSelections, (editorState, state) => {
  SelectionHelper.for(editorState, state).mapEach(trimToFullLines);
});

/**
 * Starting from `current` (inclusive), find the first character that does not
 * satisfy `condition` in the direction and return its Coord.
 *
 * @param current Coord of the first character to test
 * @param condition will be only executed on character codes, not line breaks
 * @returns the Coord of the first character that does not satisfy condition,
 *          which may be `current`. Or `undefined` if document edge is reached.
 */
export function skipWhile(
  direction: Direction,
  current: Coord,
  condition: (charCode: number) => boolean,
  document: vscode.TextDocument,
  endLine?: number,
): Coord | undefined {
  let col = current.character,
      line = current.line,
      text = document.lineAt(line).text;
  if (endLine === undefined) {
    endLine = direction === Forward ? document.lineCount - 1 : 0;
  }

  while (col < 0 || col >= text.length || condition(text.charCodeAt(col))) {
    col += direction;
    if (col < 0 || col >= text.length) {
      line += direction;
      if (line < 0 || line * direction > endLine * direction) {
        return undefined;
      }
      text = document.lineAt(line).text;
      col = direction === Forward ? 0 : text.length - 1;
    }
  }
  return new Coord(line, col);
}

const LF = "\n".charCodeAt(0);
/**
 * Starting from `current` (inclusive), find the first character or line break
 * that does not satisfy `condition` in the direction and return its Coord.
 *
 * @param current Coord of the first character to test
 * @param condition will be called with charCode (or LF for line break).
 * @returns the Coord of the first character/LF that does not satisfy condition,
 *          which may be `current`. Or `undefined` if document edge is reached.
 */
export function skipWhileX(
  direction: Direction,
  current: Coord,
  condition: (charCode: number) => boolean,
  document: vscode.TextDocument,
  endLine?: number,
): Coord | undefined {
  let col = current.character,
      line = current.line;
  if (endLine === undefined) {
    endLine = direction === Forward ? document.lineCount - 1 : 0;
  }

  while (line >= 0 && line * direction <= endLine * direction) {
    const text = document.lineAt(line).text;
    if (direction === Backward && col >= text.length) {
      if (!condition(LF)) {
        return new Coord(line, text.length);
      }
      col = text.length - 1;
    }
    while (col >= 0 && col < text.length) {
      if (!condition(text.charCodeAt(col))) {
        return new Coord(line, col);
      }
      col += direction;
    }

    if (direction === Forward && !condition(LF)) {
      return new Coord(line, text.length);
    }
    col = direction === Forward ? 0 : Number.MAX_SAFE_INTEGER;
    line += direction;
  }
  return undefined;
}

const trimSelections: SelectionMapper = (selection, helper) => {
  // This command is idempotent. state.currentCount is intentionally ignored.
  const document = helper.editor.document;
  const isBlank = getCharSetFunction(CharSet.Blank, document);

  const firstCharacter = selection.start;
  const lastCharacter = helper.coordAt(helper.offsetAt(selection.end) - 1);

  const start = skipWhile(Forward, firstCharacter, isBlank, document, lastCharacter.line);
  const end = skipWhile(Backward, lastCharacter, isBlank, document, firstCharacter.line);
  if (!start || !end || start.isAfter(end)) {
    return RemoveSelection;
  }

  if (selection.isReversed) {
    return helper.selectionBetween(end, start, /* singleCharDirection = */ Backward);
  } else {
    return helper.selectionBetween(start, end, /* singleCharDirection = */ Forward);
  }
};

define(Command.trimSelections, CommandFlags.ChangeSelections, (editorState, state) => {
  SelectionHelper.for(editorState, state).mapEach(trimSelections);
});

// Select enclosing (m, M, alt+[mM])
// ===============================================================================================

const enclosingChars = new Uint8Array(Array.from("(){}[]<>", (ch) => ch.charCodeAt(0)));
const isNotEnclosingChar = (charCode: number) => enclosingChars.indexOf(charCode) === -1;

/**
 * Find the matching matchingChar, balanced by balancingChar.
 *
 * The character at start does not contribute to balance, and will not be
 * returned as result either. Every other balancingChar will cause the next
 * matchingChar to be ignored.
 */
export function findMatching(
  direction: Direction,
  start: Coord,
  matchingChar: number,
  balancingChar: number,
  document: vscode.TextDocument,
) {
  let isStart = true;
  let balance = 0;
  const active = skipWhile(
    direction,
    start,
    (charCode) => {
      if (isStart) {
        isStart = false;
        return true;
      }
      if (charCode === matchingChar) {
        if (balance === 0) {
          return false;
        }
        balance--;
      } else if (charCode === balancingChar) {
        balance++;
      }
      return true;
    },
    document,
  );
  return active;
}

function selectEnclosing(extend: ExtendBehavior, direction: Direction) {
  // This command intentionally ignores repetitions to be consistent with
  // Kakoune.
  // It only finds one next enclosing character and drags only once to its
  // matching counterpart. Repetitions > 1 does exactly the same with rep=1,
  // even though executing the command again will jump back and forth.

  const mapper = seekToRange(
    (from, helper, i) => {
      const document = helper.editor.document;
      // First, find an enclosing char (which may be the current character).
      let currentCharacter = from;
      if (helper.selectionBehavior === SelectionBehavior.Caret) {
        // When moving backwards, the first character to consider is the
        // character to the left, not the right. However, we hackily special
        // case `|[foo]>` (> is anchor, | is active) to jump to the end in the
        // current group.
        const selection = helper.editor.selections[i];
        if (direction === Backward && selection.isReversed) {
          currentCharacter = helper.coordAt(helper.offsetAt(currentCharacter) - 1);
        }
        // Similarly, we special case `<[foo]|` to jump back in the current
        // group.
        if (direction === Forward && !selection.isReversed && !selection.isEmpty) {
          currentCharacter = helper.coordAt(helper.offsetAt(currentCharacter) - 1);
        }
      }
      if (helper.selectionBehavior === SelectionBehavior.Caret && direction === Backward) {
        // When moving backwards, the first character to consider is the
        // character to the left, not the right.
        currentCharacter = helper.coordAt(helper.offsetAt(currentCharacter) - 1);
      }
      const anchor = skipWhile(direction, currentCharacter, isNotEnclosingChar, document);
      if (!anchor) {
        return RemoveSelection;
      }

      // Then, find the matching char of the anchor.
      const enclosingChar = document.lineAt(anchor.line).text.charCodeAt(anchor.character),
            idxOfEnclosingChar = enclosingChars.indexOf(enclosingChar);

      let active;
      if (idxOfEnclosingChar & 1) {
        // Odd enclosingChar index
        //     <=> enclosingChar is closing character
        //     <=> we go backward looking for the opening character
        const matchingChar = enclosingChars[idxOfEnclosingChar - 1];
        active = findMatching(Backward, anchor, matchingChar, enclosingChar, document);
      } else {
        // Even enclosingChar index
        //     <=> enclosingChar is opening character
        //     <=> we go forward looking for the closing character
        const matchingChar = enclosingChars[idxOfEnclosingChar + 1];
        active = findMatching(Forward, anchor, matchingChar, enclosingChar, document);
      }

      if (!active) {
        return RemoveSelection;
      }
      return [anchor, active];
    },
    extend,
    /* singleCharDirection = */ direction,
  );

  return (editorState: EditorState, state: CommandState) => {
    SelectionHelper.for(editorState, state).mapEach(mapper);
  };
}

define(
  Command.selectEnclosing,
  CommandFlags.ChangeSelections,
  selectEnclosing(DoNotExtend, Forward),
);
define(
  Command.selectEnclosingExtend,
  CommandFlags.ChangeSelections,
  selectEnclosing(Extend, Forward),
);
define(
  Command.selectEnclosingBackwards,
  CommandFlags.ChangeSelections,
  selectEnclosing(DoNotExtend, Backward),
);
define(
  Command.selectEnclosingExtendBackwards,
  CommandFlags.ChangeSelections,
  selectEnclosing(Extend, Backward),
);
