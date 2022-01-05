import * as vscode from "vscode";

import type { Argument, InputOr, RegisterOr } from ".";
import { insert as apiInsert, Context, deindentLines, edit, indentLines, insertByIndex, insertByIndexWithFullLines, insertFlagsAtEdge, joinLines, keypress, Positions, replace, replaceByIndex, Selections, Shift } from "../api";
import type { Register } from "../state/registers";
import { LengthMismatchError } from "../utils/errors";

/**
 * Perform changes on the text content of the document.
 *
 * See https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#changes.
 */
declare module "./edit";

/**
 * Insert contents of register.
 *
 * A `where` argument may be specified to state where the text should be
 * inserted relative to each selection. If unspecified, each selection will be
 * replaced by the text.
 *
 * Specify `"shift": "select"` to select the inserted selection,
 * `"shift": "extend"` to extend to the inserted text, and nothing to keep the
 * current selections.
 *
 * `select` is deprecated; use `shift` with `"select"` instead.
 *
 * @keys `s-a-r` (normal)
 *
 * #### Additional commands
 *
 * | Title                              | Identifier              | Keybinding                     | Commands                                                                                                    |
 * | ---------------------------------- | ----------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
 * | Pick register and replace          | `selectRegister-insert` | `c-r` (normal), `c-r` (insert) | `[".selectRegister"], [".edit.insert"]`                                                                     |
 * | Paste before                       | `paste.before`          | `s-p` (normal)                 | `[".edit.insert", { handleNewLine: true, where: "start"               }]`                                   |
 * | Paste after                        | `paste.after`           | `p` (normal)                   | `[".edit.insert", { handleNewLine: true, where: "end"                 }]`                                   |
 * | Paste before and select            | `paste.before.select`   | `s-a-p` (normal)               | `[".edit.insert", { handleNewLine: true, where: "start", shift: "select" }]`                                |
 * | Paste after and select             | `paste.after.select`    | `a-p` (normal)                 | `[".edit.insert", { handleNewLine: true, where: "end"  , shift: "select" }]`                                |
 * | Delete                             | `delete`                | `a-d` (normal)                 | `[".edit.insert", { register: "_" }]`                                                                       |
 * | Delete and switch to Insert        | `delete-insert`         | `a-c` (normal)                 | `[".modes.set", { input: "insert" }], [".edit.insert", { register: "_" }]`                                  |
 * | Copy and delete                    | `yank-delete`           | `d` (normal)                   | `[".selections.saveText"],                                      [".edit.insert", { register: "_" }]`        |
 * | Copy, delete and switch to Insert  | `yank-delete-insert`    | `c` (normal)                   | `[".selections.saveText"], [".modes.set", { input: "insert" }], [".edit.insert", { register: "_" }]`        |
 * | Copy and replace                   | `yank-replace`          | `s-r` (normal)                 | `[".selections.saveText", { register: "tmp" }], [".edit.insert"], [".updateRegister", { copyFrom: "tmp" }]` |
 */
export async function insert(
  _: Context,
  selections: readonly vscode.Selection[],
  register: RegisterOr<"dquote", Register.Flags.CanRead>,

  adjust: Argument<boolean> = true,
  handleNewLine: Argument<boolean> = false,
  repetitions: number,
  select: Argument<boolean> = false,
  shift?: Argument<Shift>,
  text?: Argument<string>,
  where?: Argument<"active" | "anchor" | "start" | "end" | undefined>,
) {
  let contents = text?.length
    ? (select ? [text] : selections.map(() => text))
    : await register.get();

  if (contents === undefined || contents.length === 0) {
    throw new Error(`register "${register.name}" does not contain any saved text`);
  }

  if (select || shift === Shift.Select) {
    const textToInsert = contents.join(""),
          insert = handleNewLine ? insertByIndexWithFullLines : insertByIndex,
          flags = insertFlagsAtEdge(where) | apiInsert.Flags.Select;

    const insertedRanges = await insert(flags, () => textToInsert, selections),
          allSelections = [] as vscode.Selection[],
          document = _.document;

    for (const insertedRange of insertedRanges) {
      let offset = document.offsetAt(insertedRange.start);

      for (const content of contents) {
        const newSelection = Selections.fromLength(offset, content.length, false, document);

        allSelections.push(newSelection);
        offset += content.length;
      }
    }

    Selections.set(Selections.bottomToTop(allSelections));
    return;
  }

  if (adjust) {
    contents = extendArrayToLength(contents, selections.length);
  } else {
    LengthMismatchError.throwIfLengthMismatch(selections, contents);
  }

  if (repetitions > 1) {
    contents = contents.map((content) => content.repeat(repetitions));
  }

  if (where === undefined) {
    Selections.set(await replaceByIndex((i) => contents![i], selections));
    return;
  }

  if (!["active", "anchor", "start", "end"].includes(where)) {
    throw new Error(`"where" must be one of "active", "anchor", "start", "end", or undefined`);
  }

  const keepOrExtend = shift === Shift.Extend ? apiInsert.Flags.Extend : apiInsert.Flags.Keep,
        flags = insertFlagsAtEdge(where) | keepOrExtend;

  Selections.set(
    handleNewLine
      ? await insertByIndexWithFullLines(flags, (i) => contents![i], selections)
      : await insertByIndex(flags, (i) => contents![i], selections),
  );
}

/**
 * Join lines.
 *
 * @keys `a-j` (normal)
 */
export function join(_: Context, separator?: Argument<string>) {
  return joinLines(Selections.lines(), separator);
}

/**
 * Join lines and select inserted separators.
 *
 * @keys `s-a-j` (normal)
 */
export function join_select(_: Context, separator?: Argument<string>) {
  return joinLines(Selections.lines(), separator).then(Selections.set);
}

/**
 * Indent selected lines.
 *
 * @keys `>` (normal)
 */
export function indent(_: Context, repetitions: number) {
  return indentLines(Selections.lines(), repetitions, /* indentEmpty= */ false);
}

/**
 * Indent selected lines (including empty lines).
 *
 * @keys `a->` (normal)
 */
export function indent_withEmpty(_: Context, repetitions: number) {
  return indentLines(Selections.lines(), repetitions, /* indentEmpty= */ true);
}

/**
 * Deindent selected lines.
 *
 * @keys `a-<` (normal)
 */
export function deindent(_: Context, repetitions: number) {
  return deindentLines(Selections.lines(), repetitions, /* deindentIncomplete= */ false);
}

/**
 * Deindent selected lines (including incomplete indent).
 *
 * @keys `<` (normal)
 */
export function deindent_withIncomplete(_: Context, repetitions: number) {
  return deindentLines(Selections.lines(), repetitions, /* deindentIncomplete= */ true);
}

/**
 * Transform to lower case.
 *
 * @keys `` ` `` (normal)
 */
export function case_toLower(_: Context) {
  return replace((text) => text.toLocaleLowerCase());
}

/**
 * Transform to upper case.
 *
 * @keys `` s-` `` (normal)
 */
export function case_toUpper(_: Context) {
  return replace((text) => text.toLocaleUpperCase());
}

/**
 * Swap case.
 *
 * @keys `` a-` `` (normal)
 */
export function case_swap(_: Context) {
  return replace((text) => {
    let builtText = "";

    for (let i = 0, len = text.length; i < len; i++) {
      const x = text[i],
            loCase = x.toLocaleLowerCase();

      builtText += loCase === x ? x.toLocaleUpperCase() : loCase;
    }

    return builtText;
  });
}

/**
 * Replace characters.
 *
 * @keys `r` (normal)
 */
export async function replaceCharacters(
  _: Context,
  repetitions: number,
  inputOr: InputOr<string>,
) {
  const input = (await inputOr(() => keypress(_))).repeat(repetitions);

  return _.run(() => edit((editBuilder, selections, document) => {
    for (const selection of selections) {
      let i = selection.start.line;

      if (selection.end.line === i) {
        // A single line-selection; replace the selection directly
        editBuilder.replace(
          selection,
          input!.repeat(selection.end.character - selection.start.character),
        );

        continue;
      }

      // Replace in first line
      const firstLine = document.lineAt(i).range.with(selection.start);

      editBuilder.replace(
        firstLine,
        input!.repeat(firstLine.end.character - firstLine.start.character),
      );

      // Replace in intermediate lines
      while (++i < selection.end.line) {
        const line = document.lineAt(i);

        editBuilder.replace(line.range, input!.repeat(line.text.length));
      }

      // Replace in last line
      const lastLine = document.lineAt(i).range.with(undefined, selection.end);

      editBuilder.replace(
        lastLine,
        input!.repeat(lastLine.end.character - lastLine.start.character),
      );
    }
  }));
}

/**
 * Align selections.
 *
 * Align selections, aligning the cursor of each selection by inserting spaces
 * before the first character of each selection.
 *
 * @keys `&` (normal)
 */
export function align(
  _: Context,
  selections: readonly vscode.Selection[],

  fill: Argument<string> = " ",
) {
  const startChar = selections.reduce(
    (max, sel) => (sel.start.character > max ? sel.start.character : max),
    0,
  );

  return edit((builder, selections) => {
    for (let i = 0, len = selections.length; i < len; i++) {
      const selection = selections[i];

      builder.insert(selection.start, fill.repeat(startChar - selection.start.character));
    }
  });
}

/**
 * Copy indentation.
 *
 * Copy the indentation of the main selection (or the count one if a count is
 * given) to all other ones.
 *
 * @keys `a-&` (normal)
 */
export function copyIndentation(
  _: Context,
  document: vscode.TextDocument,
  selections: readonly vscode.Selection[],
  count: number,
) {
  const sourceSelection = selections[count] ?? selections[0],
        sourceIndent = document
          .lineAt(sourceSelection.start)
          .firstNonWhitespaceCharacterIndex;

  return edit((builder, selections, document) => {
    for (let i = 0, len = selections.length; i < len; i++) {
      if (i === sourceSelection.start.line) {
        continue;
      }

      const line = document.lineAt(selections[i].start),
            indent = line.firstNonWhitespaceCharacterIndex;

      if (indent > sourceIndent) {
        builder.delete(
          line.range.with(
            undefined,
            line.range.start.translate(undefined, indent - sourceIndent),
          ),
        );
      } else if (indent < sourceIndent) {
        builder.insert(line.range.start, " ".repeat(indent - sourceIndent));
      }
    }
  });
}

/**
 * Insert new line above each selection.
 *
 * Specify `"shift": "select"` to select the inserted selections, and nothing to
 * keep the current selections.
 *
 * `select` is deprecated; use `shift` with `"select"` instead.
 *
 * @keys `s-a-o` (normal)
 *
 * #### Additional keybindings
 *
 * | Title                                      | Identifier             | Keybinding     | Commands                                                                 |
 * | ------------------------------------------ | ---------------------- | -------------- | ------------------------------------------------------------------------ |
 * | Insert new line above and switch to insert | `newLine.above.insert` | `s-o` (normal) | `[".edit.newLine.above", { shift: "select" }], [".modes.insert.before"]` |
 */
export function newLine_above(
  _: Context,
  repetitions: number,
  select: Argument<boolean> = false,
  shift?: Argument<Shift>,
) {
  if (select || shift === Shift.Select) {
    return insertLinesNativelyAndCopySelections(_, repetitions, "editor.action.insertLineBefore");
  }

  return edit((builder, selections, document) => {
    const newLine = (document.eol === vscode.EndOfLine.LF ? "\n" : "\r\n").repeat(repetitions),
          processedLines = new Set<number>();

    for (let i = 0, len = selections.length; i < len; i++) {
      const selection = selections[i],
            activeLine = Selections.activeLine(selection);

      if (processedLines.size !== processedLines.add(activeLine).size) {
        builder.insert(new vscode.Position(activeLine, 0), newLine);
      }
    }
  });
}

/**
 * Insert new line below each selection.
 *
 * Specify `"shift": "select"` to select the inserted selections, and nothing to
 * keep the current selections.
 *
 * `select` is deprecated; use `shift` with `"select"` instead.
 *
 * @keys `a-o` (normal)
 *
 * #### Additional keybindings
 *
 * | Title                                      | Identifier             | Keybinding   | Commands                                                                 |
 * | ------------------------------------------ | ---------------------- | ------------ | ------------------------------------------------------------------------ |
 * | Insert new line below and switch to insert | `newLine.below.insert` | `o` (normal) | `[".edit.newLine.below", { shift: "select" }], [".modes.insert.before"]` |
 */
export function newLine_below(
  _: Context,
  repetitions: number,
  select: Argument<boolean> = false,
  shift?: Argument<Shift>,
) {
  if (select || shift === Shift.Select) {
    return insertLinesNativelyAndCopySelections(_, repetitions, "editor.action.insertLineAfter");
  }

  return edit((builder, selections, document) => {
    const newLine = (document.eol === vscode.EndOfLine.LF ? "\n" : "\r\n").repeat(repetitions),
          processedLines = new Set<number>();

    for (let i = 0, len = selections.length; i < len; i++) {
      const selection = selections[i],
            activeLine = Selections.activeLine(selection);

      if (processedLines.size !== processedLines.add(activeLine).size) {
        builder.insert(new vscode.Position(activeLine + 1, 0), newLine);
      }
    }
  });
}

function prepareSelectionForLineInsertion(_: number, selection: vscode.Selection) {
  const activeLine = Selections.activeLine(selection);

  if (selection.active.line !== activeLine) {
    return new vscode.Selection(selection.anchor, selection.active.with(activeLine));
  }

  return selection;
}

function extendArrayToLength<T>(array: readonly T[], length: number) {
  const arrayLen = array.length;

  if (length > arrayLen) {
    const newArray = array.slice(),
          last = array[arrayLen - 1];

    for (let i = arrayLen; i < length; i++) {
      newArray.push(last);
    }

    return newArray;
  } else {
    return array.slice(0, length);
  }
}

/**
 * Inserts lines below or above each current selection, and copies the new
 * selections the given number of times.
 *
 * This function uses the native VS Code insertion strategy to get a valid
 * indentation for the new selections, and copies the inserted selections down
 * if more than one repetition is requested.
 */
function insertLinesNativelyAndCopySelections(
  _: Context,
  repetitions: number,
  command: "editor.action.insertLineAfter" | "editor.action.insertLineBefore",
) {
  Selections.updateByIndex(prepareSelectionForLineInsertion);

  if (repetitions === 1) {
    return vscode.commands.executeCommand(command);
  }

  const isLastCharacterAt = [] as boolean[];

  return vscode.commands.executeCommand(command).then(() =>
    _.edit((builder, selections, document) => {
      for (const selection of selections) {
        const active = selection.active,
              lineStart = Positions.lineStart(active.line),
              indentationRange = new vscode.Range(lineStart, active),
              indentation = (document.getText(indentationRange) + "\n").repeat(repetitions - 1);

        if (active.line === document.lineCount - 1) {
          isLastCharacterAt.push(true);
          builder.insert(Positions.lineEnd(active.line), "\n" + indentation.slice(0, -1));
        } else {
          isLastCharacterAt.push(false);
          builder.insert(lineStart.translate(1), indentation);
        }
      }
    }),
  ).then(() => {
    const selections = [] as vscode.Selection[];
    let selectionIndex = 0;

    for (let selection of _.selections) {
      if (isLastCharacterAt[selectionIndex++]) {
        // Selection corresponds to the last character in the document. We
        // couldn't simply insert a line above, so we must correct the current
        // selection.
        selection = Selections.fromAnchorActive(
          selection.anchor.translate(-repetitions + 1),
          selection.active.translate(-repetitions + 1),
        );
      }

      const active = selection.active,
            anchor = selection.anchor;

      for (let i = repetitions - 1; i > 0; i--) {
        selections.push(Selections.fromAnchorActive(anchor.translate(i), active.translate(i)));
      }

      selections.push(selection);
    }

    _.selections = selections;
  });
}
