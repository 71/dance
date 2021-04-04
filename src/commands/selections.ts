import * as vscode from "vscode";
import { Context, EmptySelectionsError, moveWhile, Positions, Selections, switchRun } from "../api";
import { Mode } from "../mode";
import { Register } from "../register";
import { Extension } from "../state/extension";
import { CharSet, getCharacters, getCharSetFunction } from "../utils/charset";
import { prompt, promptInList } from "../utils/prompt";
import { SettingsValidator } from "../utils/settings-validator";
import { TrackedSelection, TrackedSelectionSet } from "../utils/tracked-selection";

/**
 * Interacting with selections.
 */
declare module "./selections";

/**
 * Save selections.
 *
 * @keys `s-z` (normal)
 */
export function save(
  editor: vscode.TextEditor,
  extension: Extension,
  register?: Register.WithFlags<Register.Flags.CanReadSelections>,
) {
  // TODO dispose of selection set automatically
  if (register === undefined) {
    register = extension.registers.caret;
  }

  const existingMarks = register.getSelectionSet(editor.document);

  if (existingMarks !== undefined) {
    documentState.forgetSelections(existingMarks);
  }

  const style = argument.style,
        trackedSelections = TrackedSelection.fromArray(editor.selections, editor.document);
  let trackedSelectionSet: TrackedSelectionSet;

  if (typeof style === "object") {
    const validator = new SettingsValidator(),
          renderOptions = Mode.decorationObjectToDecorationRenderOptions(style, validator);

    validator.throwErrorIfNeeded();

    trackedSelectionSet
      = new TrackedSelectionSet.Styled(editor, trackedSelections, renderOptions);
  } else {
    trackedSelectionSet = new TrackedSelectionSet(trackedSelections);
  }

  documentState.trackSelectionSet(trackedSelectionSet);
  register.setSelectionSet(editor.document, trackedSelectionSet);
}

/**
 * Restore selections.
 *
 * @keys `z` (normal)
 */
export function restore(
  editor: vscode.TextEditor,
  extension: Extension,
  register?: Register.WithFlags<Register.Flags.CanReadSelections>,
) {
  register ??= extension.registers.caret;

  const marks = throwIfRegisterHasNoSelections(register, editor.document);

  editor.selections = marks;
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
  editor: vscode.TextEditor,
  extension: Extension,
  cancellationToken: vscode.CancellationToken,
  register?: Register.WithFlags<Register.Flags.CanReadSelections>,
  argument?: { reverse?: boolean },
) {
  if (register === undefined) {
    register = extension.registers.caret;
  }

  const marks = throwIfRegisterHasNoSelections(register, editor.document);
  let from = marks,
      add = editor.selections;

  if (argument?.reverse) {
    from = editor.selections;
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
    editor.selections = from.concat(add);

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
      const aLength = editor.document.offsetAt(a.end) - editor.document.offsetAt(a.start),
            bLength = editor.document.offsetAt(b.end) - editor.document.offsetAt(b.start);

      if (aLength > bLength) {
        selections.push(a);
      } else {
        selections.push(b);
      }
      break;
    }

    case 6: {
      const aLength = editor.document.offsetAt(a.end) - editor.document.offsetAt(a.start),
            bLength = editor.document.offsetAt(b.end) - editor.document.offsetAt(b.start);

      if (aLength < bLength) {
        selections.push(a);
      } else {
        selections.push(b);
      }
      break;
    }
    }
  }

  editor.selections = selections;
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
  extension: Extension,
  cancellationToken: vscode.CancellationToken,
  register?: Register.WithFlags<Register.Flags.CanWrite>,
  input?: string,
) {
  if (input === undefined) {
    input = await prompt({
      validateInput(value) {
        try {
          switchRun.validate(value);
        } catch (e) {
          return e?.message ?? `${e}`;
        }
      },
      prompt: "Enter an expression",
    }, cancellationToken);
  }

  if (register === undefined) {
    register = extension.registers.pipe;
  }

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
  return Selections.update.byIndex((_, selection, editor) => {
    const start = selection.start,
          end = selection.end;

    // Move start to line start and end to include line break.
    const newStart = start.with(undefined, 0);
    let newEnd: vscode.Position;

    if (end.character === 0) {
      // End is next line start, which means the selection already includes the
      // line break of last line.
      newEnd = end;
    } else if (end.line + 1 < editor.document.lineCount) {
      // Move end to the next line start to include the line break.
      newEnd = new vscode.Position(end.line + 1, 0);
    } else {
      // End is at the last line, so try to include all text.
      const textLen = editor.document.lineAt(end.line).text.length;
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

  return Selections.update.byIndex((_, selection, editor) => {
    const document = editor.document;

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
  cancellationToken: vscode.CancellationToken,
  argument?: { defaultInput?: string },
  input?: string,
) {
  const defaultInput = argument?.defaultInput;

  if (input === undefined) {
    input = await prompt({
      value: defaultInput,
      validateInput(value) {
        try {
          switchRun.validate(value);
        } catch (e) {
          return e?.message ?? `${e}`;
        }
      },
      prompt: "Enter an expression",
    }, cancellationToken);
  }

  const document = _.document,
        selections = _.selections,
        strings = selections.map((selection) => document.getText(selection));

  return _.run(() =>
    Selections.filter.byIndex(async (i) => {
      try {
        return !!await switchRun(strings[i], { $: strings[i], $$: strings, i });
      } catch {
        return false;
      }
    }).then(Selections.set),
  );
}

function throwIfRegisterHasNoSelections(
  register: Register & Register.ReadableSelections,
  document: vscode.TextDocument,
) {
  const selections = register.getSelections(document);

  EmptySelectionsError.throwIfRegisterIsEmpty(selections, register.name);

  return selections;
}
