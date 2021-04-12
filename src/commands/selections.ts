import * as vscode from "vscode";
import { Argument, Input, InputOr, RegisterOr, SetInput } from ".";
import { ArgumentError, Context, Direction, EmptySelectionsError, moveWhile, Positions, prompt, Selections, switchRun, todo } from "../api";
import { Mode } from "../mode";
import { Register } from "../register";
import { EditorState } from "../state/editor";
import { SelectionBehavior } from "../state/extension";
import { CharSet, getCharacters } from "../utils/charset";
import { AutoDisposable } from "../utils/disposables";
import { manipulateSelectionsInteractively } from "../utils/misc";
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
  _: Context,
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[],
  register: RegisterOr<"caret", Register.Flags.CanWriteSelections>,

  style?: Argument<object>,
  until?: Argument<AutoDisposable.Event[]>,
) {
  const trackedSelections = TrackedSelection.fromArray(selections, document);
  let trackedSelectionSet: TrackedSelection.Set;

  if (typeof style === "object") {
    const validator = new SettingsValidator(),
          renderOptions = Mode.decorationObjectToDecorationRenderOptions(style, validator);

    validator.throwErrorIfNeeded();

    trackedSelectionSet =
      new TrackedSelection.StyledSet(trackedSelections, _.editor, renderOptions);
  } else {
    trackedSelectionSet = new TrackedSelection.Set(trackedSelections, document);
  }

  const disposable = _.extensionState
    .createAutoDisposable()
    .addNotifyingDisposable(trackedSelectionSet);

  if (Array.isArray(until)) {
    until.forEach((until) => disposable.disposeOnUserEvent(until, _.editorState));
  }

  register.replaceSelectionSet(trackedSelectionSet)?.dispose();
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
  const selectionSet = register.getSelectionSet();

  if (selectionSet === undefined || selectionSet.selections.length === 0) {
    throw new EmptySelectionsError(`no selections are saved in register "${register.name}"`);
  }

  return _.switchToDocument(selectionSet.document, /* alsoFocusEditor= */ true)
    .then(() => _.selections = selectionSet.restore());
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
  register: RegisterOr<"caret", Register.Flags.CanReadSelections>,

  reverse: Argument<boolean> = false,
) {
  const savedSelections = register.getSelections();

  EmptySelectionsError.throwIfRegisterIsEmpty(savedSelections, register.name);

  let from = savedSelections,
      add = _.selections;

  if (reverse) {
    from = _.selections;
    add = savedSelections;
  }

  const type = await prompt.one([
    ["a", "Append lists"],
    ["u", "Union"],
    ["i", "Intersection"],
    ["<", "Select leftmost cursor"],
    [">", "Select rightmost cursor"],
    ["+", "Select longest"],
    ["-", "Select shortest"],
  ]);

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

let lastPipeInput: string | undefined;

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
    prompt: "Expression",
    validateInput(value) {
      try {
        switchRun.validate(value);
        lastPipeInput = value;
      } catch (e) {
        return e?.message ?? `${e}`;
      }
    },
    value: lastPipeInput,
  }, _));

  const selections = _.selections,
        document = _.document,
        selectionsStrings = selections.map((selection) => document.getText(selection));

  const results = await Promise.all(_.run((_) => selectionsStrings.map((string, i, strings) =>
    switchRun(input!, { $: string, $$: strings, i, n: strings.length }),
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

let lastFilterInput: string | undefined;

/**
 * Filter selections.
 *
 * @keys `$` (normal)
 *
 * #### Variants
 *
 * | Title                      | Identifier              | Keybinding         | Commands                                                           |
 * | -------------------------- | ----------------------- | ------------------ | ------------------------------------------------------------------ |
 * | Keep matching selections   | `filter.regexp`         | `a-k` (normal)     | `[".selections.filter", { "defaultInput": "/" }]`                  |
 * | Clear matching selections  | `filter.regexp.inverse` | `s-a-k` (normal)   | `[".selections.filter", { "defaultInput": "/", "inverse": true }]` |
 * | Clear secondary selections | `clear.secondary`       | `space` (normal)   | `[".selections.filter", { "input": "i === 0" }]`                   |
 * | Clear main selections      | `clear.main`            | `a-space` (normal) | `[".selections.filter", { "input": "i !== 0" }]`                   |
 */
export function filter(
  _: Context,

  input: Input<string>,
  setInput: SetInput<string>,
  defaultInput?: Argument<string>,
  inverse: Argument<boolean> = false,
  interactive: Argument<boolean> = true,
) {
  const document = _.document,
        strings = _.selections.map((selection) => document.getText(selection));

  return manipulateSelectionsInteractively(_, input, setInput, interactive, {
    prompt: "Expression",
    validateInput(value) {
      try {
        switchRun.validate(value);
        lastFilterInput = value;
      } catch (e) {
        return e?.message ?? `${e}`;
      }
    },
    value: defaultInput ?? lastFilterInput,
    valueSelection: defaultInput
      ? [defaultInput.length, defaultInput.length]
      : lastFilterInput
        ? [0, lastFilterInput.length]
        : undefined,
  }, (input, selections) => {
    return Selections.filter.byIndex(async (i) => {
      const context = { $: strings[i], $$: strings, i, n: strings.length };

      try {
        return !!(await switchRun(input, context)) !== inverse;
      } catch {
        return inverse;
      }
    }, selections).then(Selections.set).then(() => input);
  });
}

let lastSelectInput: RegExp | undefined;

/**
 * Select within selections.
 *
 * @keys `s` (normal)
 */
export function select(
  _: Context,

  interactive: Argument<boolean> = true,
  input: Input<string | RegExp>,
  setInput: SetInput<RegExp>,
) {
  return manipulateSelectionsInteractively(_, input, setInput, interactive, {
    ...prompt.regexpOpts("mu"),
    value: lastSelectInput?.source,
  }, (input, selections) => {
    if (typeof input === "string") {
      input = new RegExp(input, "mu");
    }

    lastSelectInput = input;

    Selections.set(Selections.selectWithin(input, selections));

    return Promise.resolve(input);
  });
}

let lastSplitInput: RegExp | undefined;

/**
 * Split selections.
 *
 * @keys `s-s` (normal)
 */
export function split(
  _: Context,

  excludeEmpty: Argument<boolean> = false,
  interactive: Argument<boolean> = true,
  input: Input<string | RegExp>,
  setInput: SetInput<RegExp>,
) {
  return manipulateSelectionsInteractively(_, input, setInput, interactive, {
    ...prompt.regexpOpts("mu"),
    value: lastSplitInput?.source,
  }, (input, selections) => {
    if (typeof input === "string") {
      input = new RegExp(input, "mu");
    }

    lastSplitInput = input;

    let split = Selections.split(input, selections);

    if (excludeEmpty) {
      split = split.filter((s) => !s.isEmpty);
    }

    Selections.set(split);

    return Promise.resolve(input);
  });
}

/**
 * Split selections at line boundaries.
 *
 * @keys `a-s` (normal)
 */
export function splitLines(
  _: Context,
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[],
  repetitions: number,
) {
  const newSelections = [] as vscode.Selection[];

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
      Selections.fromStartEnd(start, Positions.lineEnd(startLine, document), isReversed, document),
    );

    // Add intermediate lines.
    for (let line = startLine + repetitions; line < endLine; line += repetitions) {
      const start = Positions.lineStart(line),
            end = Positions.lineEnd(line, document);

      newSelections.push(Selections.fromStartEnd(start, end, isReversed, document));
    }

    // Add end line.
    if (endLine % repetitions === 0) {
      newSelections.push(
        Selections.fromStartEnd(Positions.lineStart(endLine), end, isReversed, document),
      );
    }
  }

  Selections.set(newSelections);
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

/**
 * Reduce selections to their cursor.
 *
 * @param where Which edge each selection should be reduced to; defaults to
 *   "active".
 *
 * @keys `;` (normal)
 *
 * #### Variant
 *
 * | Title                           | Identifier     | Keybinding       | Command                                       |
 * | ------------------------------- | -------------- | ---------------- | --------------------------------------------- |
 * | Reduce selections to their ends | `reduce.edges` | `s-a-s` (normal) | `[".selections.reduce", { "where": "both" }]` |
 */
export function reduce(
  _: Context,

  handleCharacterBehavior = true,
  where: Argument<"active" | "anchor" | "start" | "end" | "both"> = "active",
) {
  ArgumentError.validate(
    "where",
    ["active", "anchor", "start", "end", "both"].includes(where),
    `"where" must be "active", "anchor", "start", "end", "both", or undefined`,
  );

  const takeWhere = handleCharacterBehavior && _.selectionBehavior === SelectionBehavior.Character
    ? (selection: vscode.Selection, prop: Exclude<typeof where, "both">) => {
        const result = selection[prop];

        if (result === selection.end && !result.isEqual(selection.start)) {
          return Positions.previous(result)!;
        }

        return result;
      }
    : (selection: vscode.Selection, prop: Exclude<typeof where, "both">) => selection[prop];

  if (where !== "both") {
    Selections.update.byIndex((_, selection) => Selections.empty(takeWhere(selection, where)));

    return;
  }

  Selections.set(_.selections.flatMap((selection) => {
    if (selection.isEmpty || Selections.isNonDirectional(selection)) {
      return [selection];
    }

    return [
      Selections.empty(takeWhere(selection, "active")),
      Selections.empty(takeWhere(selection, "anchor")),
    ];
  }));
}

/**
 * Change direction of selections.
 *
 * @param direction If unspecified, flips each direction. Otherwise, ensures
 *   that all selections face the given direction.
 *
 * @keys `a-;` (normal)
 *
 * #### Variants
 *
 * | Title               | Identifier     | Keybinding     | Command                                                |
 * | ------------------- | -------------- | -------------- | ------------------------------------------------------ |
 * | Forward selections  | `faceForward`  | `a-:` (normal) | `[".selections.changeDirection", { "direction": 1 }]`  |
 * | Backward selections | `faceBackward` |                | `[".selections.changeDirection", { "direction": -1 }]` |
 */
export function changeDirection(_: Context, direction?: Direction) {
  switch (direction) {
  case Direction.Backward:
    Selections.update.byIndex((_, selection) =>
      selection.isReversed || selection.isEmpty || Selections.isNonDirectional(selection)
        ? selection
        : new vscode.Selection(selection.end, selection.start));
    break;

  case Direction.Forward:
    Selections.update.byIndex((_, selection) =>
      selection.isReversed
        ? new vscode.Selection(selection.start, selection.end)
        : selection);
    break;

  default:
    Selections.update.byIndex((_, selection) =>
      selection.isEmpty || Selections.isNonDirectional(selection)
        ? selection
        : new vscode.Selection(selection.active, selection.anchor));
    break;
  }
}

/**
 * Copy selections below.
 *
 * @keys `s-c` (normal)
 *
 * #### Variant
 *
 * | Title                 | Identifier   | Keybinding       | Command                                     |
 * | --------------------- | ------------ | ---------------- | ------------------------------------------- |
 * | Copy selections above | `copy.above` | `s-a-c` (normal) | `[".selections.copy", { "direction": -1 }]` |
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

const indicesPerEditor = new Map<EditorState, AutoDisposable>();

/**
 * Toggle selection indices.
 *
 * @keys `s-y` (normal)
 *
 * #### Variants
 *
 * | Title                  | Identifier    | Command                                               |
 * | ---------------------- | ------------- | ----------------------------------------------------- |
 * | Show selection indices | `showIndices` | `[".selections.toggleIndices", { "display": true  }]` |
 * | Hide selection indices | `hideIndices` | `[".selections.toggleIndices", { "display": false }]` |
 */
export function toggleIndices(
  _: Context,

  display: Argument<boolean | undefined> = undefined,
  until: Argument<AutoDisposable.Event[]> = [],
) {
  const editorState = _.editorState;
  let disposable = indicesPerEditor.get(editorState);

  if (disposable !== undefined) {
    // Indices already exist; remove them.
    if (display !== true) {
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
    const selections = editor.selections,
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

  disposable = _.extensionState
    .createAutoDisposable()
    .addDisposable(indicesDecorationType)
    .addDisposable({
      dispose() {
        indicesPerEditor.delete(editorState);
      },
    })
    .addDisposable(vscode.window.onDidChangeTextEditorSelection((e) => {
      onDidChangeSelection(e.textEditor);
    }));

  indicesPerEditor.set(editorState, disposable);

  if (Array.isArray(until)) {
    until.forEach((until) => disposable!.disposeOnUserEvent(until, editorState));
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
