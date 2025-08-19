import * as vscode from "vscode";

import type { Argument, InputOr } from ".";
import { closestSurroundedBy, command, Context, Direction, keypress, Lines, moveToExcluded, moveWhileBackward, moveWhileForward, Objects, Pair, pair, Positions, prompt, search, SelectionBehavior, Selections, Shift, surroundedBy, wordBoundary } from "../api";
import { CharSet } from "../utils/charset";
import { ArgumentError, assert } from "../utils/errors";
import { escapeForRegExp, execRange } from "../utils/regexp";
import * as TrackedSelection from "../utils/tracked-selection";
import { SyntaxNode, Tree, TreeSitter } from "../utils/tree-sitter";

/**
 * Update selections based on the text surrounding them.
 *
 * #### Predefined keybindings
 *
 * | Title                       | Keybinding          | Command                                                         |
 * | --------------------------- | ------------------- | --------------------------------------------------------------- |
 * | Open match menu             | `m` (helix: normal) | `[".openMenu", { menu: "match"                              }]` |
 * | Open match menu with extend | `m` (helix: select) | `[".openMenu", { menu: "match", pass: [{ shift: "extend" }] }]` |
 */
declare module "./seek";

/**
 * Select to character (excluded).
 *
 * @keys `t` (core: normal)
 *
 * #### Variants
 *
 * | Title                                    | Identifier                 | Keybinding                                       | Command                                                             |
 * | ---------------------------------------- | -------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
 * | Extend to character (excluded)           | `extend`                   | `s-t` (kakoune: normal), `t` (helix: select)     | `[".seek", {                shift: "extend"               , ... }]` |
 * | Select to character (excluded, backward) | `backward`                 | `a-t` (kakoune: normal), `s-t` (helix: normal)   | `[".seek", {                                 direction: -1, ... }]` |
 * | Extend to character (excluded, backward) | `extend.backward`          | `s-a-t` (kakoune: normal), `s-t` (helix: select) | `[".seek", {                shift: "extend", direction: -1, ... }]` |
 * | Select to character (included)           | `included`                 | `f` (core: normal)                               | `[".seek", { include: true                                , ... }]` |
 * | Extend to character (included)           | `included.extend`          | `s-f` (kakoune: normal), `f` (helix: select)     | `[".seek", { include: true, shift: "extend"               , ... }]` |
 * | Select to character (included, backward) | `included.backward`        | `a-f` (kakoune: normal), `s-f` (helix: normal)   | `[".seek", { include: true,                  direction: -1, ... }]` |
 * | Extend to character (included, backward) | `included.extend.backward` | `s-a-f` (kakoune: normal), `s-f` (helix: select) | `[".seek", { include: true, shift: "extend", direction: -1, ... }]` |
 */
export async function seek(
  _: Context,
  inputOr: InputOr<"input", string>,

  repetitions: number,
  direction = Direction.Forward,
  shift = Shift.Select,
  include: Argument<boolean> = false,
) {
  const input = await inputOr(() => keypress(_));

  Selections.updateByIndex((_, selection, document) => {
    let position: vscode.Position | undefined = Selections.seekFrom(selection, -direction);

    for (let i = 0; i < repetitions; i++) {
      position = Positions.offset(position, direction, document);

      if (position === undefined) {
        return undefined;
      }

      position = moveToExcluded(direction, input, position, document);

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
 * @keys `m` (kakoune: normal)
 *
 * #### Variants
 *
 * | Title                                  | Identifier                  | Keybinding                | Command                                                        |
 * | -------------------------------------- | --------------------------- | ------------------------- | -------------------------------------------------------------- |
 * | Extend to next enclosing character     | `enclosing.extend`          | `s-m` (kakoune: normal)   | `[".seek.enclosing", { shift: "extend"               , ... }]` |
 * | Select to previous enclosing character | `enclosing.backward`        | `a-m` (kakoune: normal)   | `[".seek.enclosing", {                  direction: -1, ... }]` |
 * | Extend to previous enclosing character | `enclosing.extend.backward` | `s-a-m` (kakoune: normal) | `[".seek.enclosing", { shift: "extend", direction: -1, ... }]` |
 */
export function enclosing(
  _: Context,

  direction = Direction.Forward,
  shift = Shift.Select,
  open: Argument<boolean> = true,
  pairs?: Argument<readonly string[]>,
) {
  if (pairs === undefined) {
    // Find bracket pairs for current language, if any.
    const languageConfig = vscode.workspace.getConfiguration("editor.language", _.document),
          bracketsConfig = languageConfig.get<readonly [string, string][]>("brackets");

    if (Array.isArray(bracketsConfig)) {
      const flattenedPairs: string[] = [];

      for (const bracketPair of bracketsConfig) {
        if (!Array.isArray(bracketPair) || bracketPair.length !== 2
            || typeof bracketPair[0] !== "string" || typeof bracketPair[1] !== "string") {
          throw new Error("setting `editor.language.brackets` contains an invalid entry: "
                          + JSON.stringify(bracketPair));
        }

        flattenedPairs.push(escapeForRegExp(bracketPair[0]), escapeForRegExp(bracketPair[1]));
      }

      pairs = flattenedPairs;
    } else {
      pairs = defaultEnclosingPatterns;
    }
  }

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
  Selections.updateByIndex((_, selection, document) => {
    // First, find an enclosing char (which may be the current character).
    let currentCharacter = selection.active;

    if (direction === Direction.Backward && selection.isReversed && !selection.isEmpty) {
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
 * @keys `w` (core: normal)
 *
 * #### Variants
 *
 * | Title                                        | Identifier                | Keybinding                                       | Command                                                                               |
 * | -------------------------------------------- | ------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
 * | Extend to next word start                    | `word.extend`             | `s-w` (kakoune: normal), `w` (helix: select)     | `[".seek.word", {                             shift: "extend"               , ... }]` |
 * | Select to previous word start                | `word.backward`           | `b` (core: normal)                               | `[".seek.word", {                                              direction: -1, ... }]` |
 * | Extend to previous word start                | `word.extend.backward`    | `s-b` (kakoune: normal), `b` (helix: select)     | `[".seek.word", {                             shift: "extend", direction: -1, ... }]` |
 * | Select to next non-whitespace word start     | `word.ws`                 | `a-w` (kakoune: normal), `s-w` (helix: normal)   | `[".seek.word", {                   ws: true                                , ... }]` |
 * | Extend to next non-whitespace word start     | `word.ws.extend`          | `s-a-w` (kakoune: normal), `s-w` (helix: select) | `[".seek.word", {                   ws: true, shift: "extend"               , ... }]` |
 * | Select to previous non-whitespace word start | `word.ws.backward`        | `a-b` (kakoune: normal), `s-b` (helix: normal)   | `[".seek.word", {                   ws: true,                  direction: -1, ... }]` |
 * | Extend to previous non-whitespace word start | `word.ws.extend.backward` | `s-a-b` (kakoune: normal), `s-b` (helix: select) | `[".seek.word", {                   ws: true, shift: "extend", direction: -1, ... }]` |
 * | Select to next word end                      | `wordEnd`                 | `e` (core: normal)                               | `[".seek.word", { stopAtEnd: true                                           , ... }]` |
 * | Extend to next word end                      | `wordEnd.extend`          | `s-e` (kakoune: normal), `e` (helix: select)     | `[".seek.word", { stopAtEnd: true ,           shift: "extend"               , ... }]` |
 * | Select to next non-whitespace word end       | `wordEnd.ws`              | `a-e` (kakoune: normal), `s-e` (helix: normal)   | `[".seek.word", { stopAtEnd: true , ws: true                                , ... }]` |
 * | Extend to next non-whitespace word end       | `wordEnd.ws.extend`       | `s-a-e` (kakoune: normal), `s-e` (helix: select) | `[".seek.word", { stopAtEnd: true , ws: true, shift: "extend"               , ... }]` |
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

  Selections.updateWithFallbackByIndex((_i, selection) => {
    const wasReversed = selection.isReversed;
    const oldAnchor = selection.anchor;
    const newAnchor = Selections.seekFrom(selection, direction, selection.anchor, _);
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
          let newSelection = new vscode.Selection(oldAnchor, selection.active);
          if (newSelection.isReversed !== wasReversed) {
            // The selection changed direction, we need to shift the anchor
            newSelection = new vscode.Selection(newAnchor, selection.active);
          }
          return newSelection;
        }

        return [selection];
      }

      selection = mapped;
      active = selection.active;
    }

    if (shift === Shift.Extend) {
      let newSelection = new vscode.Selection(oldAnchor, selection.active);
      if (newSelection.isReversed !== wasReversed) {
        // The selection changed direction, we need to shift the anchor
        newSelection = new vscode.Selection(newAnchor, selection.active);
      }
      return newSelection;
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
 * | Title                        | Identifier                     | Keybinding                                                | Command                                                                                       |
 * | ---------------------------- | ------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
 * | Select whole object          | `askObject`                    | `a-a` (kakoune: normal), `a-a` (kakoune: insert)          | `[".openMenu", { menu: "object",                          title: "Select whole object..." }]` |
 * | Select inner object          | `askObject.inner`              | `a-i` (kakoune: normal), `a-i` (kakoune: insert)          | `[".openMenu", { menu: "object", pass: [{ inner: true }], title: "Select inner object..." }]` |
 * | Select to whole object start | `askObject.start`              | `[` (kakoune: normal), `[` (helix: normal; helix: select) | `[".openMenu", { menu: "object", pass: [{              where: "start"                  }] }]` |
 * | Extend to whole object start | `askObject.start.extend`       | `{` (kakoune: normal)                                     | `[".openMenu", { menu: "object", pass: [{              where: "start", shift: "extend" }] }]` |
 * | Select to inner object start | `askObject.inner.start`        | `a-[` (kakoune: normal)                                   | `[".openMenu", { menu: "object", pass: [{ inner: true, where: "start"                  }] }]` |
 * | Extend to inner object start | `askObject.inner.start.extend` | `a-{` (kakoune: normal)                                   | `[".openMenu", { menu: "object", pass: [{ inner: true, where: "start", shift: "extend" }] }]` |
 * | Select to whole object end   | `askObject.end`                | `]` (kakoune: normal), `]` (helix: normal; helix: select) | `[".openMenu", { menu: "object", pass: [{              where: "end"                    }] }]` |
 * | Extend to whole object end   | `askObject.end.extend`         | `}` (kakoune: normal)                                     | `[".openMenu", { menu: "object", pass: [{              where: "end"  , shift: "extend" }] }]` |
 * | Select to inner object end   | `askObject.inner.end`          | `a-]` (kakoune: normal)                                   | `[".openMenu", { menu: "object", pass: [{ inner: true, where: "end"                    }] }]` |
 * | Extend to inner object end   | `askObject.inner.end.extend`   | `a-}` (kakoune: normal)                                   | `[".openMenu", { menu: "object", pass: [{ inner: true, where: "end"  , shift: "extend" }] }]` |
 */
export async function object(
  _: Context,

  inputOr: InputOr<"input", string>,
  inner: Argument<boolean> = false,
  where?: Argument<"start" | "end">,
  shift = Shift.Select,

  treeSitter?: TreeSitter,
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
      return Selections.updateByIndex((_i, selection) => {
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
      return Selections.updateByIndex((_i, selection) => {
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

      return Selections.updateByIndex((_i, selection) => {
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

    return Selections.updateByIndex(
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
        let start = moveWhileBackward((c) => re.test(c), selection.active, _.document),
            end = moveWhileForward((c) => re.test(c), selection.active, _.document);

        if (beforeRe !== undefined) {
          start = moveWhileBackward((c) => beforeRe.test(c), start, _.document);
        }

        if (afterRe !== undefined) {
          end = moveWhileForward((c) => afterRe.test(c), end, _.document);
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
                start += match.groups["before"].length;
              }
              if ("after" in match.groups!) {
                end -= match.groups["after"].length;
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
    let f: Objects.Seek;

    switch (match[1]) {
    case "argument":
    case "indent":
    case "paragraph":
    case "sentence":
      f = Objects[match[1]];
      break;

    default:
      assert(false);
    }

    let newSelections: vscode.Selection[];

    if (where === "start") {
      newSelections = Selections.mapByIndex((_i, selection, document) => {
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
      newSelections = Selections.mapByIndex((_i, selection, document) =>
        Selections.shift(
          selection,
          f.end(selection.active, inner, document),
          shift,
          _,
        ),
      );
    } else {
      newSelections = Selections.mapByIndex((_, selection, document) =>
        f(selection.active, inner, document),
      );
    }

    if (_.selectionBehavior === SelectionBehavior.Character) {
      Selections.shiftEmptyLeft(newSelections, _.document);
    }

    return Selections.set(newSelections);
  }

  // Helix text objects:
  //   https://github.com/helix-editor/helix/blob/master/book/src/guides/textobject.md#L1
  if (match = /^\(\?#textobject=(\w+)\)$/.exec(input)) {
    if (treeSitter === undefined) {
      throw new Error("tree-sitter is not available");
    }

    const query = await treeSitter.textObjectQueryFor(_.document);

    if (query === undefined) {
      throw new Error("no textobject query available for current document");
    }

    // Languages with queries available are a subset of supported languages, so
    // given that we have a `query` `withDocumentTree()` will not fail.
    const newSelections = await treeSitter.withDocumentTree(_.document, (documentTree) => {
      const textObjectName = match![1] + (inner ? ".inside" : ".around");

      if (!query.captureNames.includes(textObjectName)) {
        const existingValues = query.captureNames.map((name) =>
          `"${name.replace(".inside", "").replace(".around", "")}"`,
        ).join(", ");

        throw new Error(
          `unknown textobject ${JSON.stringify(textObjectName)}, valid values are ${existingValues}`,
        );
      }

      // TODO(71): add helpers for checking if a VS Code Position is within a Tree
      //   Sitter range without creating temporary objects
      const captures = query.captures(documentTree.rootNode)
        .filter((capture) => capture.name === textObjectName)
        .map(({ node }) => [node, treeSitter.toRange(node)] as const);

      return Selections.mapByIndex((_i, selection) => {
        const active = selection.active;

        let smallestNode: SyntaxNode | undefined;
        const smallestNodeLength = Number.MAX_SAFE_INTEGER;

        for (const [node, nodeRange] of captures) {
          if (!nodeRange.contains(active)) {
            continue;
          }

          const nodeLength = node.endIndex - node.startIndex;

          if (nodeLength < smallestNodeLength && !nodeRange.isEqual(selection)) {
            smallestNode = node;
          }
        }

        return smallestNode === undefined
          ? selection
          : Selections.fromStartEnd(
            treeSitter.toPosition(smallestNode.startPosition),
            treeSitter.toPosition(smallestNode.endPosition),
            Selections.isStrictlyReversed(selection, _));
      });
    });

    return Selections.set(newSelections);
  }

  throw new Error("unknown object " + JSON.stringify(input));
}

/**
 * Select syntax object.
 *
 * #### Variants
 *
 * | Title                         | Identifier                     | Command                                                |
 * | ----------------------------- | ------------------------------ | ------------------------------------------------------ |
 * | Select next syntax object     | `syntax.next.experimental`     | `[".seek.syntax.experimental", { where: "next"     }]` |
 * | Select previous syntax object | `syntax.previous.experimental` | `[".seek.syntax.experimental", { where: "previous" }]` |
 * | Select parent syntax object   | `syntax.parent.experimental`   | `[".seek.syntax.experimental", { where: "parent"   }]` |
 * | Select child syntax object    | `syntax.child.experimental`    | `[".seek.syntax.experimental", { where: "child"    }]` |
 */
export function syntax_experimental(
  _: Context,

  treeSitter: TreeSitter,
  documentTree: Tree,

  where: Argument<"next" | "previous" | "parent" | "child"> = "next",
): void {
  const rootNode = documentTree.rootNode;

  Selections.updateByIndex((_, selection) => {
    const activeNode =
      rootNode.namedDescendantForPosition(treeSitter.fromPosition(selection.active));
    let newNode: SyntaxNode | null;

    switch (where) {
    case "next":
      newNode = activeNode.nextNamedSibling;
      break;

    case "previous":
      newNode = activeNode.previousNamedSibling;
      break;

    case "child":
      newNode = activeNode.firstNamedChild;
      break;

    case "parent":
      newNode = activeNode.parent;
      break;
    }

    if (newNode == null) {
      return selection;
    }

    return Selections.fromRange(treeSitter.toRange(newNode));
  }, _);
}

/**
 * Leap forward.
 *
 * Inspired by [`leap.nvim`](https://github.com/ggandor/leap.nvim).
 *
 * #### Variants
 *
 * | Title         | Identifier      | Command                                  |
 * | ------------- | --------------- | ---------------------------------------- |
 * | Leap backward | `leap.backward` | `[".seek.leap", { direction: -1, ... }]` |
 */
export async function leap(
  _: Context,

  direction: Direction = Direction.Forward,
  labels: Argument<string> = "sft",
) {
  ArgumentError.validate("labels", !labels.includes(" "), "must not contain a space ' '");

  labels = labels.toLowerCase();

  ArgumentError.validate(
    "labels",
    new Set(labels as Iterable<string>).size === [...labels].length, "must not reuse characters");

  const editor = _.editor,
        doc = _.document,
        highlightColor = new vscode.ThemeColor("inputValidation.errorBackground"),
        dimHighlightColor = new vscode.ThemeColor("inputValidation.warningBackground"),
        foregroundColor = new vscode.ThemeColor("input.foreground"),
        dimForegroundColor = new vscode.ThemeColor("input.foreground"),
        renderOptions: vscode.DecorationRenderOptions = {
          borderColor: highlightColor,
          borderStyle: "solid",
          borderWidth: "1px",
        },
        activeLabeledSets: TrackedSelection.StyledSet[] = [],
        inactiveLabeledSets: TrackedSelection.StyledSet[] = [],
        activeLabelRenderOptions: vscode.ThemableDecorationAttachmentRenderOptions = {
          ...renderOptions,
          backgroundColor: highlightColor,
          color: foregroundColor,
        },
        inactiveLabelRenderOptions: vscode.ThemableDecorationAttachmentRenderOptions = {
          ...renderOptions,
          borderColor: dimHighlightColor,
          backgroundColor: dimHighlightColor,
          color: dimForegroundColor,
        },
        addSelection = (
          labeledSets: TrackedSelection.StyledSet[],
          labeledRenderOptions: vscode.ThemableDecorationAttachmentRenderOptions,
          selection: vscode.Selection,
          i: number) => {
          if (i < labeledSets.length) {
            labeledSets[i].addSelection(selection);
          } else {
            labeledSets[i] = new TrackedSelection.StyledSet(
              TrackedSelection.fromArray([selection], doc),
              _.getState(),
              {
                ...renderOptions,
                after: {
                  ...labeledRenderOptions,
                  contentText: labels[i],
                },
              },
            );
          }

          return labeledSets[i];
        };

  // Highlight character pairs starting with the first specified characters.
  const cutoffPosition = _.mainSelection.active,
        endPosition = direction === Direction.Forward ? Positions.last(doc) : Positions.zero,
        allowedRange = new vscode.Range(cutoffPosition, endPosition),
        firstChar = await keypress(_),
        pairSelections = Selections.selectWithin(
          new RegExp(escapeForRegExp(firstChar) + ".?", "is"),
          editor.visibleRanges.flatMap((range) => {
            const intersection = range.intersection(allowedRange);

            return intersection === undefined ? [] : [Selections.fromRange(intersection)];
          })),
        secondCharToUnlabeledSelection: Record<string, vscode.Selection> = {},
        secondCharToLabeledSelections: Record<string, [vscode.Selection, TrackedSelection.StyledSet][]> = {};

  Selections.sort(direction, pairSelections);

  for (const pairSelection of pairSelections) {
    const text = Selections.text(pairSelection, doc),
          secondChar = text.length === 1 ? "\n" : text[1];

    if (secondChar in secondCharToUnlabeledSelection) {
      const labeledSelectionsForSecondChar = (secondCharToLabeledSelections[secondChar] ??= []),
            length = labeledSelectionsForSecondChar.length,
            labeledSet = length < labels.length
              ? addSelection(activeLabeledSets, activeLabelRenderOptions, pairSelection, length)
              : addSelection(
                inactiveLabeledSets, inactiveLabelRenderOptions, pairSelection,
                length % labels.length);

      labeledSelectionsForSecondChar.push([pairSelection, labeledSet]);
    } else {
      secondCharToUnlabeledSelection[secondChar] = pairSelection;
    }
  }

  const unlabeledSelections = Object.values(secondCharToUnlabeledSelection),
        unlabeledSelectionsSet = new TrackedSelection.StyledSet(
          TrackedSelection.fromArray(unlabeledSelections, doc), _.getState(), renderOptions);

  try {
    // Get second character and jump to it.
    const secondChar = await keypress(_),
          unlabeledSelection = secondCharToUnlabeledSelection[secondChar];

    if (unlabeledSelection === undefined) {
      return;
    }

    Selections.set([Selections.empty(unlabeledSelection.start)], _);

    // Save relevant labeled selections to ensure we don't hide them below.
    const labeledSelections = secondCharToLabeledSelections[secondChar]?.map((x) => x[0]);

    if (labeledSelections === undefined || labeledSelections.length === 0) {
      // There are no labels yet, we can just stop.
      return;
    }

    delete secondCharToLabeledSelections[secondChar];

    // Hide irrelevant selections.
    const selectionsToDeletePerSet = new Map<TrackedSelection.StyledSet, vscode.Selection[]>();

    for (const [selection, styledSet] of Object.values(secondCharToLabeledSelections).flat(1)) {
      let arr = selectionsToDeletePerSet.get(styledSet);

      if (arr === undefined) {
        selectionsToDeletePerSet.set(styledSet, arr = []);
      }

      arr.push(selection);
    }

    for (const [styledSet, selections] of selectionsToDeletePerSet) {
      if (selections.length === styledSet.length) {
        styledSet.dispose();
      } else {
        styledSet.deleteSelections(selections);
      }
    }
    // clear unlabeled highlight
    unlabeledSelectionsSet.clearSelections();

    // Listen to jumps to labels.
    let offset = 0;

    for (;;) {
      const labelChar = await keypress(_);

      if (labelChar === " ") {
        // Rotate active labeled selections.
        if (labels.length >= labeledSelections.length) {
          continue;
        }

        // Add new inactive selections.
        for (let i = 0; i < labels.length; i++) {
          if (offset + i < labeledSelections.length) {
            const labeledSelection = labeledSelections[offset + i];

            // Use `addSelection` in case the inactive set does not exist yet.
            addSelection(inactiveLabeledSets, inactiveLabelRenderOptions, labeledSelection, i);
            activeLabeledSets[i].deleteSelections([labeledSelection]);
          } else {
            inactiveLabeledSets[i].clearSelections();
          }
        }

        // Rotate offset.
        if (offset + labels.length >= labeledSelections.length) {
          offset = 0;
        } else {
          offset += labels.length;
        }

        // Add new active selections.
        for (let i = 0; i < labels.length; i++) {
          if (offset + i < labeledSelections.length) {
            const labeledSelection = labeledSelections[offset + i];

            activeLabeledSets[i].addSelection(labeledSelection);
            inactiveLabeledSets[i].deleteSelections([labeledSelection]);
          } else {
            activeLabeledSets[i].clearSelections();
          }
        }

        continue;
      }

      const index = labels.indexOf(labelChar.toLowerCase());

      if (index === -1) {
        // User did not select a label, resume normally.

        // TODO: this does not properly execute the command bound to
        // `labelChar`, probably because VS Code did not have the time to switch
        // to the previous mode.
        // A way to fix this would be to bind `dance.cancel` (renamed
        // `dance.intercept`) to _all_ keybindings, gated by a VS Code `context`
        // that only intercepts keys in a given array.
        // Then `dance.intercept` would also specify which keybinding was hit.
        return;
      }

      // Jump to label.
      const selection = labeledSelections[offset + index];

      Selections.set([Selections.empty(selection.start)], _);

      return;
    }
  } finally {
    unlabeledSelectionsSet.dispose();

    activeLabeledSets.forEach((set) => set.dispose());
    inactiveLabeledSets.forEach((set) => set.dispose());
  }
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
  Selections.updateByIndex((_, selection) => {
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
