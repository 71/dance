import * as vscode from "vscode";

import type { Argument, InputOr, RegisterOr } from ".";
import { Context, Direction, manipulateSelectionsInteractively, moveWhile, moveWhileBackward, moveWhileForward, Positions, prompt, promptOne, promptRegexpOpts, SelectionBehavior, Selections, switchRun, validateForSwitchRun } from "../api";
import { PerEditorState } from "../state/editors";
import { Mode } from "../state/modes";
import type { Register } from "../state/registers";
import { CharSet, getCharacters } from "../utils/charset";
import { AutoDisposable } from "../utils/disposables";
import { ArgumentError, EmptySelectionsError } from "../utils/errors";
import { unsafeSelections } from "../utils/misc";
import { newRegExp } from "../utils/regexp";
import { SettingsValidator } from "../utils/settings-validator";
import * as TrackedSelection from "../utils/tracked-selection";

/**
 * Interacting with selections.
 */
declare module "./selections";

/**
 * Copy selections text.
 *
 * @keys `y` (core: normal)
 * | Keybindings         | Commands                                          |
 * | -----------         | --------                                          |
 * | `y` (helix: select) | `[".selections.saveText"], [".modes.set.normal"]` |
 */
export function saveText(
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[],
  register: RegisterOr<"dquote", Register.Flags.CanWrite>,
) {
  register.set(selections.map(document.getText.bind(document)));
}

/**
 * Save selections.
 *
 * @keys `s-z` (kakoune: normal)
 */
export function save(
  _: Context,
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[],
  register: RegisterOr<"caret", Register.Flags.CanWriteSelections>,

  style?: Argument<object>,
  until?: Argument<AutoDisposable.Event[]>,
  untilDelay: Argument<number> = 100,
) {
  const trackedSelections = TrackedSelection.fromArray(selections, document);
  let trackedSelectionSet: TrackedSelection.Set;

  if (typeof style === "object") {
    const validator = new SettingsValidator(),
          renderOptions = Mode.decorationObjectToDecorationRenderOptions(style, validator);

    validator.throwErrorIfNeeded();

    renderOptions.rangeBehavior = vscode.DecorationRangeBehavior.ClosedOpen;
    trackedSelectionSet =
      new TrackedSelection.StyledSet(trackedSelections, _.getState(), renderOptions);
    trackedSelectionSet.flags |= TrackedSelection.Flags.EmptyMoves;
  } else {
    trackedSelectionSet = new TrackedSelection.Set(trackedSelections, document);
  }

  const disposable = _.extension
    .createAutoDisposable()
    .addNotifyingDisposable(trackedSelectionSet)
    .addDisposable(new vscode.Disposable(() => {
      if (register.canReadSelections() && register.getSelectionSet() === trackedSelectionSet) {
        register.replaceSelectionSet()!.dispose();
      }
    }));

  if (Array.isArray(until)) {
    if (untilDelay <= 0) {
      until.forEach((until) => disposable.disposeOnUserEvent(until, _));
    } else {
      setTimeout(() => {
        try {
          _.getState();
        } catch {
          // Editor has gone out of view.
          return disposable.dispose();
        }

        until.forEach((until) => disposable.disposeOnUserEvent(until, _));
      }, untilDelay);
    }
  }

  register.replaceSelectionSet(trackedSelectionSet)?.dispose();
}

/**
 * Restore selections.
 *
 * @keys `z` (kakoune: normal)
 */
export async function restore(
  _: Context,
  register: RegisterOr<"caret", Register.Flags.CanReadSelections>,
) {
  const selectionSet = register.getSelectionSet();

  if (selectionSet === undefined) {
    throw new EmptySelectionsError(`no selections are saved in register "${register.name}"`);
  }

  await _.switchToDocument(selectionSet.document, /* alsoFocusEditor= */ true);

  _.selections = selectionSet.restore();
}

/**
 * Combine register selections with current ones.
 *
 * @keys `a-z` (kakoune: normal)
 *
 * The following keybinding is also available:
 *
 * | Keybinding                | Command                                                       |
 * | ------------------------- | ------------------------------------------------------------- |
 * | `s-a-z` (kakoune: normal) | `[".selections.restore.withCurrent", { reverse: true, ... }]` |
 *
 * See https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#marks
 */
export async function restore_withCurrent(
  _: Context,
  document: vscode.TextDocument,
  register: RegisterOr<"caret", Register.Flags.CanReadSelections>,

  reverse: Argument<boolean> = false,
  action?: Argument<"a" | "u" | "i" | "<" | ">" | "+" | "-">,
) {
  const savedSelections = register.getSelections();

  EmptySelectionsError.throwIfRegisterIsEmpty(savedSelections, register.name);

  let from = savedSelections,
      add = _.selections;

  if (reverse) {
    from = _.selections;
    add = savedSelections;
  }

  const type = await promptOne([
    ["a", "Append lists"],
    ["u", "Union"],
    ["i", "Intersection"],
    ["<", "Select leftmost cursor"],
    [">", "Select rightmost cursor"],
    ["+", "Select longest"],
    ["-", "Select shortest"],
  ], undefined, {
    defaultPick: action,
    defaultPickName: "action",
  });

  if (type === 0) {
    _.selections = from.concat(add);

    return;
  }

  if (from.length !== add.length) {
    throw new Error("the current and register selections have different sizes");
  }

  const selections = [] as vscode.Selection[];

  for (let i = 0; i < from.length; i++) {
    const a = from[i],
          b = add[i];

    switch (type) {
    case 1: {
      const anchor = a.start.isBefore(b.start) ? a.start : b.start,
            active = a.end.isAfter(b.end) ? a.end : b.end;

      selections.push(new vscode.Selection(anchor, active));
      break;
    }

    case 2: {
      const anchor = a.start.isAfter(b.start) ? a.start : b.start,
            active = a.end.isBefore(b.end) ? a.end : b.end;

      selections.push(new vscode.Selection(anchor, active));
      break;
    }

    case 3:
      if (a.active.isBeforeOrEqual(b.active)) {
        selections.push(a);
      } else {
        selections.push(b);
      }
      break;

    case 4:
      if (a.active.isAfterOrEqual(b.active)) {
        selections.push(a);
      } else {
        selections.push(b);
      }
      break;

    case 5: {
      const aLength = document.offsetAt(a.end) - document.offsetAt(a.start),
            bLength = document.offsetAt(b.end) - document.offsetAt(b.start);

      if (aLength > bLength) {
        selections.push(a);
      } else {
        selections.push(b);
      }
      break;
    }

    case 6: {
      const aLength = document.offsetAt(a.end) - document.offsetAt(a.start),
            bLength = document.offsetAt(b.end) - document.offsetAt(b.start);

      if (aLength < bLength) {
        selections.push(a);
      } else {
        selections.push(b);
      }
      break;
    }
    }
  }

  _.selections = selections;
}

const pipeHistory: string[] = [];

/**
 * Pipe selections.
 *
 * Run the specified command or code with the contents of each selection, and
 * save the result to a register.
 *
 * @keys `a-|` (core: normal; helix: select)
 * See https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#changes-through-external-programs
 *
 * #### Additional commands
 *
 * | Title               | Identifier     | Keybinding                          | Commands                                                                                                                    |
 * | ------------------- | -------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
 * | Pipe and replace    | `pipe.replace` | `|` (core: normal; helix: select)   | `[".selections.pipe", { +expression,register }], [".edit.insert", { register: "|",                                  ... }]` |
 * | Pipe and append     | `pipe.append`  | `!` (core: normal; helix: select)   | `[".selections.pipe", { +expression,register }], [".edit.insert", { register: "|", where: "end"  , shift: "select", ... }]` |
 * | Pipe and prepend    | `pipe.prepend` | `a-!` (core: normal; helix: select) | `[".selections.pipe", { +expression,register }], [".edit.insert", { register: "|", where: "start", shift: "select", ... }]` |
 */
export async function pipe(
  _: Context,
  register: RegisterOr<"pipe", Register.Flags.CanWrite>,
  expressionOr: InputOr<"expression", string>,
) {
  const expression = await expressionOr(() => prompt({
    prompt: "Expression",
    validateInput(value) {
      try {
        return void validateForSwitchRun(value);
      } catch (e) {
        return (e as Error)?.message ?? `${e}`;
      }
    },
    history: pipeHistory,
  }, _));

  const selections = _.selections,
        document = _.document,
        selectionsStrings = selections.map((selection) => document.getText(selection));

  const results = await Promise.all(_.run((_) => selectionsStrings.map((string, i, strings) =>
    switchRun(expression!, { $: string, $$: strings, i, n: strings.length }),
  )));

  const strings = results.map(resultToString);

  await register.set(strings);
}

const filterHistory: string[] = [];

/**
 * Filter selections.
 *
 * @keys `$` (core: normal; helix: select)
 * #### Variants
 *
 * | Title                      | Identifier              | Keybinding                            | Commands                                                                 |
 * | -------------------------- | ----------------------- | ------------------------------------- | ------------------------------------------------------------------------ |
 * | Keep matching selections   | `filter.regexp`         | `a-k` (core: normal; helix: select)   | `[".selections.filter", { defaultExpression: "/"               , ... }]` |
 * | Clear matching selections  | `filter.regexp.inverse` | `s-a-k` (core: normal; helix: select) | `[".selections.filter", { defaultExpression: "/", inverse: true, ... }]` |
 * | Clear secondary selections | `clear.secondary`       | `,` (core: normal; helix: select)     | `[".selections.filter", { expression: "i === count"            , ... }]` |
 * | Clear main selections      | `clear.main`            | `a-,` (core: normal; helix: select)   | `[".selections.filter", { expression: "i !== count"            , ... }]` |
 */
export function filter(
  _: Context,

  argument: { expression?: string },
  defaultExpression?: Argument<string>,
  inverse: Argument<boolean> = false,
  interactive: Argument<boolean> = true,
  count: number = 0,
) {
  const document = _.document,
        strings = _.selections.map((selection) => document.getText(selection));

  return manipulateSelectionsInteractively(_, "expression", argument, interactive, {
    prompt: "Expression",
    validateInput(value) {
      try {
        return void validateForSwitchRun(value);
      } catch (e) {
        return (e as Error)?.message ?? `${e}`;
      }
    },
    value: defaultExpression,
    valueSelection: defaultExpression
      ? [defaultExpression.length, defaultExpression.length]
      : undefined,
    history: filterHistory,
  }, async (expression, selections) => {
    Selections.set(await Selections.filterByIndex(async (i) => {
      const context = { $: strings[i], $$: strings, i, n: strings.length, count };

      try {
        return !!(await switchRun(expression, context)) !== inverse;
      } catch {
        return inverse;
      }
    }, selections));

    return expression;
  });
}

/**
 * Select within selections.
 *
 * #### Variants
 *
 * | Title          | Identifier      | Keybinding                        | Command                                                                                           |
 * | -------------- | --------------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
 * | Leap or select | `select.orLeap` | `s` (core: normal; helix: select) | `[".ifEmpty", { then: [[".seek.leap", { ... }]], otherwise: [[".selections.select", { ... }]] }]` |
 */
export async function select(
  _: Context,
  register: RegisterOr<"slash", [Register.Flags.CanRead, Register.Flags.CanWrite]>,

  interactive: Argument<boolean> = true,
  argument: { re?: string | RegExp & { originalSource?: string } },
) {
  return manipulateSelectionsInteractively(
    _,
    "re",
    argument,
    interactive,
    { ...promptRegexpOpts("mu"), value: (await register.get())?.[0] },
    (re, selections) => {
      if (typeof re === "string") {
        re = newRegExp(re, "mu");
      }

      register.set([re.originalSource ?? re.source]);

      Selections.set(Selections.bottomToTop(Selections.selectWithin(re, selections)));

      return Promise.resolve(re);
    },
  );
}

/**
 * Split selections.
 *
 * @keys `s-s` (core: normal; helix: select)
 */
export async function split(
  _: Context,
  register: RegisterOr<"slash", [Register.Flags.CanRead, Register.Flags.CanWrite]>,

  excludeEmpty: Argument<boolean> = false,
  interactive: Argument<boolean> = true,
  argument: { re?: string | RegExp & { originalSource?: string } },
) {
  return manipulateSelectionsInteractively(
    _,
    "re",
    argument,
    interactive,
    { ...promptRegexpOpts("mu"), value: (await register.get())?.[0] },
    (re, selections) => {
      if (typeof re === "string") {
        re = newRegExp(re, "mu");
      }

      register.set([re.originalSource ?? re.source]);

      let split = Selections.split(re, selections);

      if (excludeEmpty) {
        split = split.filter((s) => !s.isEmpty);
      }

      Selections.set(Selections.bottomToTop(split));

      return Promise.resolve(re);
    },
  );
}

/**
 * Split selections at line boundaries.
 *
 * #### Variants
 *
 * | Title                   | Identifier                   | Keybinding                          | Command                                                                                                              |
 * | ----------------------- | ---------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
 * | Leap or select backward | `splitLines.orLeap.backward` | `a-s` (core: normal; helix: select) | `[".ifEmpty", { then: [[".seek.leap", { direction: -1, ... }]], otherwise: [[".selections.splitLines", { ... }]] }]` |
 */
export function splitLines(
  _: Context,
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[],
  repetitions: number,

  excludeEol: Argument<boolean> = false,
) {
  const newSelections = [] as vscode.Selection[],
        lineEnd = excludeEol ? Positions.lineEnd : Positions.lineBreak;

  for (let i = 0, len = selections.length; i < len; i++) {
    const selection = selections[i],
          start = selection.start,
          end = selection.end,
          startLine = start.line,
          endLine = end.line,
          isReversed = selection.isReversed;

    if (startLine === endLine) {
      newSelections.push(selection);

      return;
    }


    // Add start line.
    newSelections.push(
      Selections.fromStartEnd(start, lineEnd(startLine, document), isReversed, document),
    );

    // Add intermediate lines.
    for (let line = startLine + repetitions; line < endLine; line += repetitions) {
      const start = Positions.lineStart(line),
            end = lineEnd(line, document);

      newSelections.push(Selections.fromStartEnd(start, end, isReversed, document));
    }

    // Add end line.
    if (endLine % repetitions === 0 && end.character > 0) {
      newSelections.push(
        Selections.fromStartEnd(Positions.lineStart(endLine), end, isReversed, document),
      );
    }
  }

  Selections.set(Selections.bottomToTop(newSelections));
}

/**
 * Expand to lines.
 *
 * Expand selections to contain full lines (including end-of-line characters).
 *
 * @keys `x` (kakoune: normal), `s-x` (helix: normal; helix: select)
 */
export function expandToLines(_: Context) {
  return Selections.updateByIndex((_i, selection, document) => {
    const start = selection.start,
          end = selection.end;

    // Move start to line start and end to include line break.
    const newStart = start.with(undefined, 0);
    let newEnd: vscode.Position;

    if (end.character === 0 && end.line !== start.line) {
      // End is next line start, which means the selection already includes the
      // line break of last line.
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
    return Selections.fromStartEnd(newStart, newEnd, Selections.isStrictlyReversed(selection, _));
  });
}

/**
 * Trim lines.
 *
 * Trim selections to only contain full lines (from start to line break).
 *
 * @keys `a-x` (core: normal; helix: select)
 */
export function trimLines(_: Context) {
  return Selections.updateByIndex((_, selection) => {
    const start = selection.start,
          end = selection.end;

    // If start is not at line start, move it to the next line start.
    const newStart = start.character === 0 ? start : new vscode.Position(start.line + 1, 0);
    // Move end to the line start, so that the selection ends with a line break.
    const newEnd = new vscode.Position(end.line, 0);

    if (newStart.isAfterOrEqual(newEnd)) {
      return undefined;  // No full line contained.
    }

    // After trimming, the selection should be in the same direction as before.
    // Except when selecting only one empty line in non-directional mode, prefer
    // to keep the selection facing forward.
    if (selection.isReversed && newStart.line + 1 !== newEnd.line) {
      return new vscode.Selection(newEnd, newStart);
    } else {
      return new vscode.Selection(newStart, newEnd);
    }
  });
}

/**
 * Trim whitespace.
 *
 * Trim whitespace at beginning and end of selections.
 *
 * @keys `_` (core: normal; helix: select)
 */
export function trimWhitespace(_: Context) {
  const blank = getCharacters(CharSet.Blank, _.document),
        isBlank = (character: string) => blank.includes(character);

  return Selections.updateByIndex((_, selection, document) => {
    const firstCharacter = selection.start,
          lastCharacter = selection.end;

    const start = moveWhileForward(isBlank, firstCharacter, document),
          end = moveWhileBackward(isBlank, lastCharacter, document);

    if (start.isAfter(end)) {
      return undefined;
    }

    return Selections.fromStartEnd(start, end, selection.isReversed);
  });
}

/**
 * Reduce selections to their cursor.
 *
 * @param where Which edge each selection should be reduced to; defaults to
 *   "active".
 *
 * @keys `;` (core: normal; helix: select)
 *
 * #### Variant
 *
 * | Title                           | Identifier     | Keybinding                | Command                                                        |
 * | ------------------------------- | -------------- | ------------------------- | -------------------------------------------------------------- |
 * | Reduce selections to their ends | `reduce.edges` | `s-a-s` (kakoune: normal) | `[".selections.reduce", { where: "both", empty: false, ... }]` |
 */
export function reduce(
  _: Context,

  where: Argument<"active" | "anchor" | "start" | "end" | "both"> = "active",
  empty: Argument<boolean> = true,
) {
  ArgumentError.validate(
    "where",
    ["active", "anchor", "start", "end", "both"].includes(where),
    `"where" must be "active", "anchor", "start", "end", "both", or undefined`,
  );

  if (empty && _.selectionBehavior !== SelectionBehavior.Character) {
    if (where !== "both") {
      Selections.updateByIndex((_, selection) => Selections.empty(selection[where]));
    } else {
      Selections.set(_.selections.flatMap((selection) => {
        if (selection.isEmpty) {
          return [selection];
        }

        return [
          Selections.empty(selection.active),
          Selections.empty(selection.anchor),
        ];
      }));
    }

    return;
  }

  const takeWhere = (selection: vscode.Selection, prop: Exclude<typeof where, "both">) => {
    if (selection.isEmpty) {
      return selection;
    }

    let start = selection[prop],
        end: vscode.Position;

    if (start === selection.end && !start.isEqual(selection.start)) {
      end = start;
      start = Positions.previous(start)!;
    } else {
      end = Positions.next(start) ?? start;
    }

    return Selections.from(start, end);
  };

  if (where !== "both") {
    Selections.updateByIndex((_, selection) => takeWhere(selection, where));

    return;
  }

  Selections.set(_.selections.flatMap((selection) => {
    if (selection.isEmpty || Selections.isNonDirectional(selection)) {
      return [selection];
    }

    return [
      takeWhere(selection, "active"),
      takeWhere(selection, "anchor"),
    ];
  }));
}

/**
 * Change direction of selections.
 *
 * @param direction If unspecified, flips each direction. Otherwise, ensures
 *   that all selections face the given direction.
 *
 * @keys `a-;` (core: normal; helix: select)
 *
 * #### Variants
 *
 * | Title               | Identifier     | Keybinding              | Command                                              |
 * | ------------------- | -------------- | ----------------------- | ---------------------------------------------------- |
 * | Forward selections  | `faceForward`  | `a-:` (kakoune: normal) | `[".selections.changeDirection", { direction:  1 }]` |
 * | Backward selections | `faceBackward` |                         | `[".selections.changeDirection", { direction: -1 }]` |
 */
export function changeDirection(_: Context, direction?: Direction) {
  switch (direction) {
  case Direction.Backward:
    Selections.updateByIndex((_, selection) =>
      selection.isReversed || selection.isEmpty || Selections.isNonDirectional(selection)
        ? selection
        : new vscode.Selection(selection.end, selection.start));
    break;

  case Direction.Forward:
    Selections.updateByIndex((_, selection) =>
      selection.isReversed
        ? new vscode.Selection(selection.start, selection.end)
        : selection);
    break;

  default:
    Selections.updateByIndex((_, selection) =>
      selection.isEmpty || Selections.isNonDirectional(selection)
        ? selection
        : new vscode.Selection(selection.active, selection.anchor));
    break;
  }
}

/**
 * Reverse selections.
 *
 * @param direction If unspecified, reverses the order of the current
 *   selections. Otherwise, ensures directions are sorted top-to-bottom
 *   (`direction === 1`) or bottom-to-top (`direction === -1`).
 *
 * #### Variants
 *
 * | Title                       | Identifier        | Command                                          |
 * | --------------------------- | ----------------- | ------------------------------------------------ |
 * | Order selections descending | `orderDescending` | `[".selections.changeOrder", { direction:  1 }]` |
 * | Order selections ascending  | `orderAscending`  | `[".selections.changeOrder", { direction: -1 }]` |
 */
export function changeOrder(_: Context, selections: vscode.Selection[], direction?: Direction) {
  switch (direction) {
  case Direction.Backward:
  case Direction.Forward:
    Selections.set(Selections.sort(direction, selections), _);
    break;

  default:
    Selections.set(selections.reverse(), _);
    break;
  }
}

/**
 * Sort selections.
 *
 * @param expressionOr An expression which returns either a string or a number
 *   used to sort selections.
 *
 * @param direction If `Backward`, selections will be sorted descendingly.
 */
export async function sort(
  _: Context,
  expressionOr: InputOr<"expression", string>,
  direction = Direction.Forward,
) {
  const expression = await expressionOr(() => prompt({
    prompt: "Expression",
    validateInput(value) {
      try {
        return void validateForSwitchRun(value);
      } catch (e) {
        return (e as Error)?.message ?? `${e}`;
      }
    },
    history: pipeHistory,
  }, _));

  const document = _.document,
        selectionsStrings = _.selections.map((selection) => document.getText(selection));

  const results = await Promise.all(_.run((_) => selectionsStrings.map((string, i, strings) =>
    switchRun(expression, { $: string, $$: strings, i, n: strings.length }),
  )));

  const numbers: number[] = [],
        strings: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];

    if (numbers.length === i) {
      // Try to convert `result` to a number.
      if (typeof result === "number") {
        numbers.push(result);

        continue;
      }

      if (typeof result === "string" || typeof result === "boolean") {
        const asNumber = +result;

        if (!isNaN(asNumber)) {
          numbers.push(asNumber);

          continue;
        }
      }

      // `result` is not a number, if we have seen numbers before, add their
      // string representation to `strings`, and only compare strings from now
      // on.
      for (const number of numbers) {
        strings.push(`${number}`);
      }
    }

    strings.push(resultToString(result));
  }

  const selections = _.selections.slice(),
        selectionToIndex = new Map(selections.map((s, i) => [s, i]));

  if (numbers.length === results.length) {
    selections.sort((a, b) => numbers[selectionToIndex.get(a)!] - numbers[selectionToIndex.get(b)!]);
  } else {
    selections.sort((a, b) =>
      strings[selectionToIndex.get(a)!].localeCompare(strings[selectionToIndex.get(b)!]),
    );
  }

  if (direction === Direction.Backward) {
    selections.reverse();
  }

  Selections.set(selections, _);
}

/**
 * Copy selections below.
 *
 * @keys `s-c` (core: normal; helix: select)
 *
 * #### Variant
 *
 * | Title                 | Identifier   | Keybinding                            | Command                                   |
 * | --------------------- | ------------ | ------------------------------------- | ----------------------------------------- |
 * | Copy selections above | `copy.above` | `s-a-c` (core: normal; helix: select) | `[".selections.copy", { direction: -1 }]` |
 */
export function copy(
  _: Context,
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[],
  repetitions: number,

  direction = Direction.Forward,
) {
  const newSelections = [] as vscode.Selection[],
        lineCount = document.lineCount;

  for (const selection of selections) {
    const activeLine = Selections.activeLine(selection);
    let currentLine = activeLine + direction;

    for (let i = 0; i < repetitions;) {
      if (currentLine < 0 || currentLine >= lineCount) {
        break;
      }

      const copiedSelection = tryCopySelection(document, selection, currentLine);

      if (copiedSelection === undefined) {
        currentLine += direction;
        continue;
      }

      newSelections.push(copiedSelection);

      i++;
      currentLine = direction === Direction.Backward
        ? copiedSelection.end.line - 1
        : copiedSelection.start.line + 1;
    }
  }

  newSelections.push(...selections);

  Selections.set(newSelections);
}

/**
 * Merge contiguous selections.
 *
 * @keys `a-_` (kakoune: normal)
 */
export function merge(_: Context) {
  Selections.set(Selections.mergeConsecutive(Selections.current()));
}

/**
 * Open selected file.
 */
export async function open(_: Context) {
  const basePath = vscode.Uri.joinPath(_.document.uri, "..");

  await Promise.all(
    Selections.map(async (text) =>
      await vscode.window.showTextDocument(
        await vscode.workspace.openTextDocument(vscode.Uri.joinPath(basePath, text))),
    ),
  );
}

const indicesToken = PerEditorState.registerState<AutoDisposable>(/* isDisposable= */ true);

/**
 * Toggle selection indices.
 *
 * @keys `enter` (core: normal; helix: select)
 *
 * #### Variants
 *
 * | Title                  | Identifier    | Command                                                  |
 * | ---------------------- | ------------- | -------------------------------------------------------- |
 * | Show selection indices | `showIndices` | `[".selections.toggleIndices", { display: true , ... }]` |
 * | Hide selection indices | `hideIndices` | `[".selections.toggleIndices", { display: false, ... }]` |
 */
export function toggleIndices(
  _: Context,

  display: Argument<boolean | undefined> = undefined,
  until: Argument<AutoDisposable.Event[]> = [],
) {
  const editorState = _.getState();
  let disposable = editorState.get(indicesToken);

  if (disposable !== undefined) {
    // Indices already exist; remove them.
    if (display !== true) {
      editorState.store(indicesToken, undefined);
      disposable.dispose();
    }

    return;
  }

  // Indices do not exist yet; add them.
  if (display === false) {
    return;
  }

  const indicesDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor("textLink.activeForeground"),
      margin: "0 0 0 20px",
    },
    isWholeLine: true,
  });

  function onDidChangeSelection(editor: vscode.TextEditor) {
    // Collect selection indices for each line; keep the column of the cursor in
    // memory for later.
    const selections = unsafeSelections(editor),
          selectionsPerLine = new Map<number, [activeColumn: number, selectionIndex: number][]>();

    for (let i = 0; i < selections.length; i++) {
      const selection = selections[i],
            active = selection.active,
            activeLine = Selections.activeLine(selection),
            activeCharacter = activeLine === active.line
              ? active.character
              : Number.MAX_SAFE_INTEGER,  // We were at the end of the line.
            selectionsForLine = selectionsPerLine.get(activeLine);

      if (selectionsForLine === undefined) {
        selectionsPerLine.set(activeLine, [[activeCharacter, i]]);
      } else {
        selectionsForLine.push([activeCharacter, i]);
      }
    }

    // For each line with selections, add a new decoration.
    const ranges = [] as vscode.DecorationOptions[];

    for (const [line, selectionsForLine] of selectionsPerLine) {
      // Sort selection indices by their column to make sure they match the
      // order seen by the user.
      selectionsForLine.sort((a, b) => a[0] - b[0]);

      const rangePosition = new vscode.Position(line, 0),
            range = new vscode.Range(rangePosition, rangePosition);

      ranges.push({
        range,
        renderOptions: {
          after: {
            contentText: "#" + selectionsForLine.map((x) => x[1]).join(", #"),
          },
        },
      });
    }

    editor.setDecorations(indicesDecorationType, ranges);
  }

  disposable = _.extension
    .createAutoDisposable()
    .addDisposable(indicesDecorationType)
    .addDisposable(vscode.window.onDidChangeTextEditorSelection((e) =>
      e.textEditor === editorState.editor && onDidChangeSelection(e.textEditor),
    ))
    .addDisposable(editorState.onVisibilityDidChange((e) =>
      e.isVisible && onDidChangeSelection(e.editor),
    ));

  editorState.store(indicesToken, disposable);

  if (Array.isArray(until)) {
    until.forEach((until) => disposable!.disposeOnUserEvent(until, _));
  }

  onDidChangeSelection(editorState.editor);
}

function tryCopySelection(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  newActiveLine: number,
) {
  const active = selection.active,
        anchor = selection.anchor,
        activeLine = Selections.activeLine(selection),
        endCharacter = Selections.endCharacter(selection, document);
  let activeCharacter = selection.end === active ? endCharacter : active.character,
      anchorCharacter = selection.end === anchor ? endCharacter : anchor.character;

  if (activeLine === anchor.line) {
    const newLineLength = document.lineAt(newActiveLine).text.length;

    if (endCharacter > newLineLength) {
      if (endCharacter !== newLineLength + 1) {
        return undefined;
      }

      return selection.end === active
        ? new vscode.Selection(newActiveLine, anchorCharacter, newActiveLine + 1, 0)
        : new vscode.Selection(newActiveLine + 1, 0, newActiveLine, activeCharacter);
    }

    return new vscode.Selection(newActiveLine, anchorCharacter, newActiveLine, activeCharacter);
  }

  let newAnchorLine = newActiveLine + anchor.line - activeLine;

  if (newAnchorLine < 0 || newAnchorLine >= document.lineCount) {
    return undefined;
  }

  const newAnchorLineLength = document.lineAt(newAnchorLine).text.length;

  if (anchorCharacter > newAnchorLineLength) {
    if (anchorCharacter !== newAnchorLineLength + 1) {
      return undefined;
    }

    newAnchorLine++;
    anchorCharacter = 0;
  }

  const newActiveLineLength = document.lineAt(newActiveLine).text.length;

  if (active.character > newActiveLineLength) {
    if (activeCharacter !== newActiveLineLength + 1) {
      return undefined;
    }

    newActiveLine++;
    activeCharacter = 0;
  }

  const newSelection = new vscode.Selection(newAnchorLine, anchorCharacter,
                                            newActiveLine, activeCharacter);

  if (Selections.overlap(selection, newSelection)) {
    return undefined;
  }

  return newSelection;
}

/**
 * Converts any value to a string appropriate for insertion and sorting.
 */
function resultToString(result: unknown) {
  if (result === null) {
    return "null";
  }
  if (result === undefined) {
    return "";
  }
  if (typeof result === "string") {
    return result;
  }
  if (typeof result === "number" || typeof result === "boolean") {
    return result.toString();
  }
  if (typeof result === "object") {
    return JSON.stringify(result);
  }

  throw new Error("invalid returned value by expression");
}
