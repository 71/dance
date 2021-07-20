import * as vscode from "vscode";

import type { Argument, InputOr } from ".";
import { closestSurroundedBy, Context, Direction, keypress, Lines, moveTo, moveWhile, Pair, pair, Positions, prompt, Range, search, SelectionBehavior, Selections, Shift, surroundedBy, wordBoundary } from "../api";
import { CharSet } from "../utils/charset";
import { ArgumentError, assert } from "../utils/errors";
import { execRange } from "../utils/regexp";

/**
 * Update selections based on the text surrounding them.
 */
declare module "./seek";

/**
 * Select to character (excluded).
 *
 * @keys `t` (normal)
 *
 * #### Variants
 *
 * | Title                                    | Identifier                 | Keybinding       | Command                                                        |
 * | ---------------------------------------- | -------------------------- | ---------------- | -------------------------------------------------------------- |
 * | Extend to character (excluded)           | `extend`                   | `s-t` (normal)   | `[".seek", {                shift: "extend"                }]` |
 * | Select to character (excluded, backward) | `backward`                 | `a-t` (normal)   | `[".seek", {                                 direction: -1 }]` |
 * | Extend to character (excluded, backward) | `extend.backward`          | `s-a-t` (normal) | `[".seek", {                shift: "extend", direction: -1 }]` |
 * | Select to character (included)           | `included`                 | `f` (normal)     | `[".seek", { include: true                                 }]` |
 * | Extend to character (included)           | `included.extend`          | `s-f` (normal)   | `[".seek", { include: true, shift: "extend"                }]` |
 * | Select to character (included, backward) | `included.backward`        | `a-f` (normal)   | `[".seek", { include: true,                  direction: -1 }]` |
 * | Extend to character (included, backward) | `included.extend.backward` | `s-a-f` (normal) | `[".seek", { include: true, shift: "extend", direction: -1 }]` |
 */
export async function seek(
  _: Context,
  inputOr: InputOr<string>,

  repetitions: number,
  direction = Direction.Forward,
  shift = Shift.Select,
  include: Argument<boolean> = false,
) {
  const input = await inputOr(() => keypress(_));

  Selections.update.byIndex((_, selection, document) => {
    let position: vscode.Position | undefined = Selections.seekFrom(selection, -direction);

    for (let i = 0; i < repetitions; i++) {
      position = Positions.offset(position, direction, document);

      if (position === undefined) {
        return undefined;
      }

      position = moveTo.excluded(direction, input, position, document);

      if (position === undefined) {
        return undefined;
      }
    }

    if (include && !(shift === Shift.Extend && direction === Direction.Backward && position.isAfter(selection.anchor))) {
      position = Positions.offset(position, input.length * direction);

      if (position === undefined) {
        return undefined;
      }
    }

    return Selections.shift(selection, position, shift);
  });
}

const defaultEnclosingPatterns = [
  "\\[", "\\]",
  "\\(", "\\)",
  "\\{", "\\}",
  "/\\*", "\\*/",
  "\\bbegin\\b", "\\bend\\b",
];

/**
 * Select to next enclosing character.
 *
 * @keys `m` (normal)
 *
 * #### Variants
 *
 * | Title                                  | Identifier                  | Keybinding       | Command                                                   |
 * | -------------------------------------- | --------------------------- | ---------------- | --------------------------------------------------------- |
 * | Extend to next enclosing character     | `enclosing.extend`          | `s-m` (normal)   | `[".seek.enclosing", { shift: "extend"                }]` |
 * | Select to previous enclosing character | `enclosing.backward`        | `a-m` (normal)   | `[".seek.enclosing", {                  direction: -1 }]` |
 * | Extend to previous enclosing character | `enclosing.extend.backward` | `s-a-m` (normal) | `[".seek.enclosing", { shift: "extend", direction: -1 }]` |
 */
export function enclosing(
  _: Context,

  direction = Direction.Forward,
  shift = Shift.Select,
  open: Argument<boolean> = true,
  pairs: Argument<readonly string[]> = defaultEnclosingPatterns,
) {
  ArgumentError.validate(
    "pairs",
    (pairs.length & 1) === 0,
    "an even number of pairs must be given",
  );

  const selectionBehavior = _.selectionBehavior,
        compiledPairs = [] as Pair[];

  for (let i = 0; i < pairs.length; i += 2) {
    compiledPairs.push(pair(new RegExp(pairs[i], "mu"), new RegExp(pairs[i + 1], "mu")));
  }

  // This command intentionally ignores repetitions to be consistent with
  // Kakoune.
  // It only finds one next enclosing character and drags only once to its
  // matching counterpart. Repetitions > 1 does exactly the same with rep=1,
  // even though executing the command again will jump back and forth.
  Selections.update.byIndex((_, selection, document) => {
    // First, find an enclosing char (which may be the current character).
    let currentCharacter = selection.active;

    if (selectionBehavior === SelectionBehavior.Caret) {
      if (direction === Direction.Backward && selection.isReversed) {
        // When moving backwards, the first character to consider is the
        // character to the left, not the right. However, we hackily special
        // case `|[foo]>` (> is anchor, | is active) to jump to the end in the
        // current group.
        currentCharacter = Positions.previous(currentCharacter, document) ?? currentCharacter;
      } else if (direction === Direction.Forward && !selection.isReversed && !selection.isEmpty) {
        // Similarly, we special case `<[foo]|` to jump back in the current
        // group.
        currentCharacter = Positions.previous(currentCharacter, document) ?? currentCharacter;
      }
    }

    if (selectionBehavior === SelectionBehavior.Caret && direction === Direction.Backward) {
      // When moving backwards, the first character to consider is the
      // character to the left, not the right.
      currentCharacter = Positions.previous(currentCharacter, document) ?? currentCharacter;
    }

    const enclosedRange = closestSurroundedBy(compiledPairs, direction, currentCharacter, open, document);

    if (enclosedRange === undefined) {
      return undefined;
    }

    if (shift === Shift.Extend) {
      return new vscode.Selection(selection.anchor, enclosedRange.active);
    }

    return enclosedRange;
  });
}

/**
 * Select to next word start.
 *
 * Select the word and following whitespaces on the right of the end of each selection.
 *
 * @keys `w` (normal)
 *
 * #### Variants
 *
 * | Title                                        | Identifier                | Keybinding       | Command                                                                          |
 * | -------------------------------------------- | ------------------------- | ---------------- | -------------------------------------------------------------------------------- |
 * | Extend to next word start                    | `word.extend`             | `s-w` (normal)   | `[".seek.word", {                             shift: "extend"                }]` |
 * | Select to previous word start                | `word.backward`           | `b` (normal)     | `[".seek.word", {                                              direction: -1 }]` |
 * | Extend to previous word start                | `word.extend.backward`    | `s-b` (normal)   | `[".seek.word", {                             shift: "extend", direction: -1 }]` |
 * | Select to next non-whitespace word start     | `word.ws`                 | `a-w` (normal)   | `[".seek.word", {                   ws: true                                 }]` |
 * | Extend to next non-whitespace word start     | `word.ws.extend`          | `s-a-w` (normal) | `[".seek.word", {                   ws: true, shift: "extend"                }]` |
 * | Select to previous non-whitespace word start | `word.ws.backward`        | `a-b` (normal)   | `[".seek.word", {                   ws: true,                  direction: -1 }]` |
 * | Extend to previous non-whitespace word start | `word.ws.extend.backward` | `s-a-b` (normal) | `[".seek.word", {                   ws: true, shift: "extend", direction: -1 }]` |
 * | Select to next word end                      | `wordEnd`                 | `e` (normal)     | `[".seek.word", { stopAtEnd: true                                            }]` |
 * | Extend to next word end                      | `wordEnd.extend`          | `s-e` (normal)   | `[".seek.word", { stopAtEnd: true ,           shift: "extend"                }]` |
 * | Select to next non-whitespace word end       | `wordEnd.ws`              | `a-e` (normal)   | `[".seek.word", { stopAtEnd: true , ws: true                                 }]` |
 * | Extend to next non-whitespace word end       | `wordEnd.ws.extend`       | `s-a-e` (normal) | `[".seek.word", { stopAtEnd: true , ws: true, shift: "extend"                }]` |
 */
export function word(
  _: Context,

  repetitions: number,
  stopAtEnd: Argument<boolean> = false,
  ws: Argument<boolean> = false,
  direction = Direction.Forward,
  shift = Shift.Select,
) {
  const charset = ws ? CharSet.NonBlank : CharSet.Word;

  Selections.update.withFallback.byIndex((_i, selection) => {
    const anchor = Selections.seekFrom(selection, direction, selection.anchor, _);
    let active = Selections.seekFrom(selection, direction, selection.active, _);

    for (let i = 0; i < repetitions; i++) {
      const mapped = wordBoundary(direction, active, stopAtEnd, charset, _);

      if (mapped === undefined) {
        if (direction === Direction.Backward && active.line > 0) {
          // This is a special case in Kakoune and we try to mimic it
          // here.
          // Instead of overflowing, put anchor at document start and
          // active always on the first character on the second line.
          const end = _.selectionBehavior === SelectionBehavior.Caret
            ? Positions.lineStart(1)
            : (Lines.isEmpty(1) ? Positions.lineStart(2) : Positions.at(1, 1));

          return new vscode.Selection(Positions.lineStart(0), end);
        }

        if (shift === Shift.Extend) {
          return [new vscode.Selection(anchor, selection.active)];
        }

        return [selection];
      }

      selection = mapped;
      active = selection.active;
    }

    if (shift === Shift.Extend) {
      return new vscode.Selection(anchor, selection.active);
    }

    return selection;
  });
}

let lastObjectInput: string | undefined;

/**
 * Select object.
 *
 * @param input The pattern of object to select; see
 *   [object patterns](#object-patterns) below for more information.
 * @param inner If `true`, only the "inner" part of the object will be selected.
 *   The definition of the "inner" part depends on the object.
 * @param where What end of the object should be sought. If `undefined`, the
 *   object will be selected from start to end regardless of the `shift`.
 *
 * #### Object patterns
 * - Pairs: `<regexp>(?#inner)<regexp>`.
 * - Character sets: `[<characters>]+`.
 *   - Can be preceded by `(?<before>[<characters>]+)` and followed by
 *     `(?<after>[<character>]+)` for whole objects.
 * - Matches that may only span a single line: `(?#singleline)<regexp>`.
 * - Predefined: `(?#predefined=<argument | paragraph | sentence>)`.
 *
 * #### Variants
 *
 * | Title                        | Identifier                     | Keybinding                     | Command                                                                                        |
 * | ---------------------------- | ------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------- |
 * | Select whole object          | `askObject`                    | `a-a` (normal), `a-a` (insert) | `[".openMenu", { input: "object"                                                           }]` |
 * | Select inner object          | `askObject.inner`              | `a-i` (normal), `a-i` (insert) | `[".openMenu", { input: "object", pass: [{ inner: true                                  }] }]` |
 * | Select to whole object start | `askObject.start`              | `[` (normal)                   | `[".openMenu", { input: "object", pass: [{              where: "start"                  }] }]` |
 * | Extend to whole object start | `askObject.start.extend`       | `{` (normal)                   | `[".openMenu", { input: "object", pass: [{              where: "start", shift: "extend" }] }]` |
 * | Select to inner object start | `askObject.inner.start`        | `a-[` (normal)                 | `[".openMenu", { input: "object", pass: [{ inner: true, where: "start"                  }] }]` |
 * | Extend to inner object start | `askObject.inner.start.extend` | `a-{` (normal)                 | `[".openMenu", { input: "object", pass: [{ inner: true, where: "start", shift: "extend" }] }]` |
 * | Select to whole object end   | `askObject.end`                | `]` (normal)                   | `[".openMenu", { input: "object", pass: [{              where: "end"                    }] }]` |
 * | Extend to whole object end   | `askObject.end.extend`         | `}` (normal)                   | `[".openMenu", { input: "object", pass: [{              where: "end"  , shift: "extend" }] }]` |
 * | Select to inner object end   | `askObject.inner.end`          | `a-]` (normal)                 | `[".openMenu", { input: "object", pass: [{ inner: true, where: "end"                    }] }]` |
 * | Extend to inner object end   | `askObject.inner.end.extend`   | `a-}` (normal)                 | `[".openMenu", { input: "object", pass: [{ inner: true, where: "end"  , shift: "extend" }] }]` |
 */
export async function object(
  _: Context,

  inputOr: InputOr<string>,
  inner: Argument<boolean> = false,
  where?: Argument<"start" | "end">,
  shift = Shift.Select,
) {
  const input = await inputOr(() => prompt({
    prompt: "Object description",
    value: lastObjectInput,
  }));

  let match: RegExpExecArray | null;

  if (match = /^(.+)\(\?#inner\)(.+)$/s.exec(input)) {
    const openRe = new RegExp(preprocessRegExp(match[1]), "u"),
          closeRe = new RegExp(preprocessRegExp(match[2]), "u"),
          p = pair(openRe, closeRe);

    if (where === "start") {
      return Selections.update.byIndex((_i, selection) => {
        const startResult = p.searchOpening(Selections.activeStart(selection, _));

        if (startResult === undefined) {
          return;
        }

        const start = inner
          ? Positions.offset(startResult[0], startResult[1][0].length, _.document) ?? startResult[0]
          : startResult[0];

        return Selections.shift(selection, start, shift, _);
      });
    }

    if (where === "end") {
      return Selections.update.byIndex((_i, selection) => {
        const endResult = p.searchClosing(Selections.activeEnd(selection, _));

        if (endResult === undefined) {
          return;
        }

        const end = inner
          ? endResult[0]
          : Positions.offset(endResult[0], endResult[1][0].length, _.document) ?? endResult[0];

        return Selections.shift(selection, end, shift, _);
      });
    }

    if (_.selectionBehavior === SelectionBehavior.Character) {
      const startRe = new RegExp("^" + openRe.source, openRe.flags);

      return Selections.update.byIndex((_i, selection) => {
        // If the selection behavior is character and the current character
        // corresponds to the start of a pair, we select from here.
        const searchStart = Selections.activeStart(selection, _),
              searchStartResult = search(Direction.Forward, startRe, searchStart);

        if (searchStartResult?.[1][0].length === 1) {
          const start = searchStartResult[0],
                innerStart = Positions.offset(start, searchStartResult[1][0].length, _.document)!,
                endResult = p.searchClosing(innerStart);

          if (endResult === undefined) {
            return undefined;
          }

          if (inner) {
            return new vscode.Selection(innerStart, endResult[0]);
          }

          return new vscode.Selection(
            start,
            Positions.offset(endResult[0], endResult[1][0].length, _.document)!,
          );
        }

        // Otherwise, we select from the end of the current selection.
        return surroundedBy([p], Selections.activeStart(selection, _), !inner, _.document);
      });
    }

    return Selections.update.byIndex(
      (_i, selection) => surroundedBy([p], Selections.activeStart(selection, _), !inner, _.document),
    );
  }

  if (match =
        /^(?:\(\?<before>(\[.+?\])\+\))?(\[.+\])\+(?:\(\?<after>(\[.+?\])\+\))?$/.exec(input)) {
    const re = new RegExp(match[2], "u"),
          beforeRe = inner || match[1] === undefined ? undefined : new RegExp(match[1], "u"),
          afterRe = inner || match[3] === undefined ? undefined : new RegExp(match[3], "u");

    return shiftWhere(
      _,
      (selection, _) => {
        let start = moveWhile.backward((c) => re.test(c), selection.active, _.document),
            end = moveWhile.forward((c) => re.test(c), selection.active, _.document);

        if (beforeRe !== undefined) {
          start = moveWhile.backward((c) => beforeRe.test(c), start, _.document);
        }

        if (afterRe !== undefined) {
          end = moveWhile.forward((c) => afterRe.test(c), end, _.document);
        }

        return new vscode.Selection(start, end);
      },
      shift,
      where,
    );
  }

  if (match = /^\(\?#singleline\)(.+)$/.exec(input)) {
    const re = new RegExp(preprocessRegExp(match[1]), "u");

    return shiftWhere(
      _,
      (selection, _) => {
        const line = Selections.activeLine(selection),
              lineText = _.document.lineAt(line).text,
              matches = execRange(lineText, re);

        // Find match at text position.
        const character = Selections.activeCharacter(selection, _.document);

        for (const m of matches) {
          let [start, end] = m;

          if (start <= character && character <= end) {
            if (inner && m[2].groups !== undefined) {
              const match = m[2];

              if ("before" in match.groups!) {
                start += match.groups.before.length;
              }
              if ("after" in match.groups!) {
                end -= match.groups.after.length;
              }
            }

            return new vscode.Selection(
              new vscode.Position(line, start),
              new vscode.Position(line, end),
            );
          }
        }

        return undefined;
      },
      shift,
      where,
    );
  }

  if (match = /^\(\?#predefined=(argument|indent|paragraph|sentence)\)$/.exec(input)) {
    let f: Range.Seek;

    switch (match[1]) {
    case "argument":
    case "indent":
    case "paragraph":
    case "sentence":
      f = Range[match[1]];
      break;

    default:
      assert(false);
    }

    let newSelections: vscode.Selection[];

    if (where === "start") {
      newSelections = Selections.map.byIndex((_i, selection, document) => {
        const activePosition = Selections.activePosition(selection, _.document);
        let shiftTo = f.start(activePosition, inner, document);

        if (shiftTo.isEqual(activePosition)) {
          const activePositionBefore = Positions.previous(activePosition, document);

          if (activePositionBefore !== undefined) {
            shiftTo = f.start(activePositionBefore, inner, document);
          }
        }

        return Selections.shift(selection, shiftTo, shift, _);
      });
    } else if (where === "end") {
      newSelections = Selections.map.byIndex((_i, selection, document) =>
        Selections.shift(
          selection,
          f.end(selection.active, inner, document),
          shift,
          _,
        ),
      );
    } else {
      newSelections = Selections.map.byIndex((_, selection, document) =>
        f(selection.active, inner, document),
      );
    }

    if (_.selectionBehavior === SelectionBehavior.Character) {
      Selections.shiftEmptyLeft(newSelections, _.document);
    }

    return _.selections = newSelections;
  }

  throw new Error("unknown object " + JSON.stringify(input));
}

function preprocessRegExp(re: string) {
  return re.replace(/\(\?#noescape\)/g, "(?<=(?<!\\\\)(?:\\\\{2})*)");
}

function shiftWhere(
  context: Context,
  f: (selection: vscode.Selection, context: Context) => vscode.Selection | undefined,
  shift: Shift,
  where: "start" | "end" | undefined,
) {
  Selections.update.byIndex((_, selection) => {
    const result = f(selection, context);

    if (result === undefined) {
      return undefined;
    }

    if (where === undefined) {
      return result;
    }

    return Selections.shift(selection, result[where], shift, context);
  });
}
