import * as vscode from "vscode";
import { Argument, InputOr, RegisterOr } from ".";
import { Context, EmptySelectionsError, moveWhile, Positions, prompt, promptInList, Selections, switchRun, todo } from "../api";
import { Mode } from "../mode";
import { Register } from "../register";
import { CharSet, getCharacters } from "../utils/charset";
import { SettingsValidator } from "../utils/settings-validator";
import { TrackedSelection } from "../utils/tracked-selection";

/**
 * Interacting with selections.
 */
declare module "./selections";

/**
 * Copy selections text.
 *
 * @keys `y` (normal)
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
 * @keys `s-z` (normal)
 */
export function save(
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[],
  register: RegisterOr<"caret", Register.Flags.CanReadSelections>,

  style?: Argument<object>,
) {
  // TODO dispose of selection set automatically
  todo();

  // const existingMarks = register.getSelectionSet();

  // if (existingMarks !== undefined) {
  //   documentState.forgetSelections(existingMarks);
  // }

  // const trackedSelections = TrackedSelection.fromArray(selections, document);
  // let trackedSelectionSet: TrackedSelection.Set;

  // if (typeof style === "object") {
  //   const validator = new SettingsValidator(),
  //         renderOptions = Mode.decorationObjectToDecorationRenderOptions(style, validator);

  //   validator.throwErrorIfNeeded();

  //   trackedSelectionSet
  //     = new TrackedSelection.StyledSet(editor, trackedSelections, renderOptions);
  // } else {
  //   trackedSelectionSet = new TrackedSelection.Set(trackedSelections);
  // }

  // documentState.trackSelectionSet(trackedSelectionSet);
  // register.setSelectionSet(document, trackedSelectionSet);
}

/**
 * Restore selections.
 *
 * @keys `z` (normal)
 */
export function restore(
  _: Context,
  register: RegisterOr<"caret", Register.Flags.CanReadSelections>,
) {
  _.selections = throwIfRegisterHasNoSelections(register);
}

/**
 * Combine register selections with current ones.
 *
 * @keys `a-z` (normal)
 *
 * The following keybinding is also available:
 *
 * | Keybinding       | Command                                                    |
 * | ---------------- | ---------------------------------------------------------- |
 * | `s-a-z` (normal) | `[".selections.restore.withCurrent", { "reverse": true }]` |
 *
 * See https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#marks
 */
export async function restore_withCurrent(
  _: Context,
  document: vscode.TextDocument,
  cancellationToken: vscode.CancellationToken,
  register: RegisterOr<"caret", Register.Flags.CanReadSelections>,

  reverse: Argument<boolean> = false,
) {
  const marks = throwIfRegisterHasNoSelections(register);
  let from = marks,
      add = _.selections;

  if (reverse) {
    from = _.selections;
    add = marks;
  }

  const type = await promptInList(false, [
    ["a", "Append lists"],
    ["u", "Union"],
    ["i", "Intersection"],
    ["<", "Select leftmost cursor"],
    [">", "Select rightmost cursor"],
    ["+", "Select longest"],
    ["-", "Select shortest"],
  ], cancellationToken);

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

/**
 * Pipe selections.
 *
 * Run the specified command or code with the contents of each selection, and
 * save the result to a register.
 *
 * @keys `a-|` (normal)
 *
 * See https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#changes-through-external-programs
 *
 * #### Additional commands
 *
 * | Title               | Identifier     | Keybinding     | Commands                                                                        |
 * | ------------------- | -------------- | -------------- | ------------------------------------------------------------------------------- |
 * | Pipe and replace    | `pipe.replace` | `|` (normal)   | `[".selections.pipe"], [".edit.insert", { "register": "|" }]`                   |
 * | Pipe and append     | `pipe.append`  | `!` (normal)   | `[".selections.pipe"], [".edit.insert", { "register": "|", "where": "end" }]`   |
 * | Pipe and prepend    | `pipe.prepend` | `a-!` (normal) | `[".selections.pipe"], [".edit.insert", { "register": "|", "where": "start" }]` |
 */
export async function pipe(
  _: Context,
  register: RegisterOr<"pipe", Register.Flags.CanWrite>,
  inputOr: InputOr<string>,
) {
  const input = await inputOr(() => prompt({
    validateInput(value) {
      try {
        switchRun.validate(value);
      } catch (e) {
        return e?.message ?? `${e}`;
      }
    },
    prompt: "Enter an expression",
  }, _));

  const selections = _.selections,
        document = _.document,
        selectionsStrings = selections.map((selection) => document.getText(selection));

  const results = await Promise.all(_.run((_) => selectionsStrings.map((string, i, strings) =>
    switchRun(input!, { $: string, $$: strings, i }),
  )));

  const strings = results.map((result) => {
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
  });

  await register.set(strings);
}

/**
 * Extend to lines.
 *
 * Extend selections to contain full lines (including end-of-line characters).
 *
 * @keys `a-x` (normal)
 */
export function extendToLines(_: Context) {
  return Selections.update.byIndex((_, selection, document) => {
    const start = selection.start,
          end = selection.end;

    // Move start to line start and end to include line break.
    const newStart = start.with(undefined, 0);
    let newEnd: vscode.Position;

    if (end.character === 0) {
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
    return Selections.fromStartEnd(newStart, newEnd, selection.isReversed);
  });
}

/**
 * Trim lines.
 *
 * Trim selections to only contain full lines (from start to line break).
 *
 * @keys `s-a-x` (normal)
 */
export function trimLines(_: Context) {
  return Selections.update.byIndex((_, selection) => {
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
 * @keys `_` (normal)
 */
export function trimWhitespace(_: Context) {
  const blank = getCharacters(CharSet.Blank, _.document),
        isBlank = (character: string) => blank.includes(character);

  return Selections.update.byIndex((_, selection, document) => {
    const firstCharacter = selection.start,
          lastCharacter = Positions.previous(selection.end, document);

    if (lastCharacter === undefined) {
      return selection;
    }

    const start = moveWhile.forward(isBlank, firstCharacter),
          end = moveWhile.backward(isBlank, lastCharacter);

    if (start.isAfter(end)) {
      return undefined;
    }

    return Selections.fromStartEnd(start, end, selection.isReversed);
  });
}

let lastFilterInput: string | undefined;

/**
 * Filter selections.
 *
 * @keys `$` (normal)
 *
 * #### Additional commands
 *
 * | Title               | Identifier      | Keybinding     | Commands                                          |
 * | ------------------- | --------------- | -------------- | ------------------------------------------------- |
 * | Filter with RegExp  | `filter.regexp` | `s` (normal)   | `[".selections.filter", { "defaultInput": "/" }]` |
 */
export async function filter(
  _: Context,
  inputOr: InputOr<string>,

  defaultInput?: Argument<string>,
) {
  defaultInput ??= lastFilterInput;

  const input = await inputOr(() => prompt({
    prompt: "Enter an expression",
    validateInput(value) {
      try {
        switchRun.validate(value);
        lastFilterInput = value;
      } catch (e) {
        return e?.message ?? `${e}`;
      }
    },
    value: defaultInput,
    valueSelection: defaultInput === undefined ? undefined : [0, defaultInput.length],
  }, _));

  const document = _.document,
        selections = _.selections,
        strings = selections.map((selection) => document.getText(selection));

  return _.run(() =>
    Selections.filter.byIndex(async (i) => {
      try {
        return !!await switchRun(input, { $: strings[i], $$: strings, i });
      } catch {
        return false;
      }
    }).then(Selections.set),
  );
}

/**
 * Split selections.
 *
 * @keys `s-s` (normal)
 */
export async function split(
  _: Context,
) {
}

/**
 * Split selections at line boundaries.
 *
 * @keys `a-s` (normal)
 */
export function splitLines(_: Context) {

}

function throwIfRegisterHasNoSelections(
  register: Register & Register.ReadableSelections,
) {
  const selections = register.getSelections();

  EmptySelectionsError.throwIfRegisterIsEmpty(selections, register.name);

  return selections;
}
