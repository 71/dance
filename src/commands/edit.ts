import * as vscode from "vscode";
import * as api from "../api";

import {
  Context,
  deindentLines,
  edit,
  indentLines,
  joinLines,
  keypress,
  LengthMismatchError,
  replace,
  Selections,
  selectionsLines,
  setSelections,
} from "../api";
import { Register } from "../state/registers";
import { Argument, InputOr, RegisterOr } from ".";

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
 * @keys `s-a-r` (normal)
 *
 * #### Additional commands
 *
 * | Title                              | Identifier              | Keybinding                     | Commands                                                                                             |
 * | ---------------------------------- | ----------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
 * | Pick register and replace          | `selectRegister-insert` | `c-r` (normal), `c-r` (insert) | `[".selectRegister"], [".edit.insert"]`                                                              |
 * | Paste before                       | `paste.before`          | `s-p` (normal)                 | `[".edit.insert", { handleNewLine: true, where: "start"               }]`                            |
 * | Paste after                        | `paste.after`           | `p` (normal)                   | `[".edit.insert", { handleNewLine: true, where: "end"                 }]`                            |
 * | Paste before and select            | `paste.before.select`   | `s-a-p` (normal)               | `[".edit.insert", { handleNewLine: true, where: "start", select: true }]`                            |
 * | Paste after and select             | `paste.after.select`    | `a-p` (normal)                 | `[".edit.insert", { handleNewLine: true, where: "end"  , select: true }]`                            |
 * | Delete                             | `delete`                | `a-d` (normal)                 | `[".edit.insert", { register: "_" }]`                                                                |
 * | Delete and switch to Insert        | `delete-insert`         | `a-c` (normal)                 | `[".modes.set", { input: "insert" }], [".edit.insert", { register: "_" }]`                           |
 * | Copy and delete                    | `yank-delete`           | `d` (normal)                   | `[".selections.saveText"],                                      [".edit.insert", { register: "_" }]` |
 * | Copy and replace                   | `yank-replace`          | `s-r` (normal)                 | `[".selections.saveText"],                                      [".edit.insert"]`                    |
 * | Copy, delete and switch to Insert  | `yank-delete-insert`    | `c` (normal)                   | `[".selections.saveText"], [".modes.set", { input: "insert" }], [".edit.insert", { register: "_" }]` |
 */
export async function insert(
  _: Context,
  selections: readonly vscode.Selection[],
  register: RegisterOr<"dquote", Register.Flags.CanRead>,

  adjust: Argument<boolean> = true,
  handleNewLine: Argument<boolean> = false,
  repetitions: number,
  select: Argument<boolean> = false,
  where?: Argument<"active" | "anchor" | "start" | "end" | undefined>,
) {
  let contents = await register.get();

  if (contents === undefined || contents.length === 0) {
    throw new Error(`register "${register.name}" does not contain any saved text`);
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
    Selections.set(await replace.byIndex((i) => contents![i], selections));
    return;
  }

  if (!["active", "anchor", "start", "end"].includes(where)) {
    throw new Error(`"where" must be one of "active", "anchor", "start", "end", or undefined`);
  }

  const flags = api.insert.flagsAtEdge(where) | (select ? api.insert.Select : api.insert.Keep);

  Selections.set(
    handleNewLine
      ? await api.insert.byIndex.withFullLines(flags, (i) => contents![i], selections)
      : await api.insert.byIndex(flags, (i) => contents![i], selections),
  );
}

/**
 * Join lines.
 *
 * @keys `a-j` (normal)
 */
export function join(_: Context, separator?: Argument<string>) {
  return joinLines(selectionsLines(), separator);
}

/**
 * Join lines and select inserted separators.
 *
 * @keys `s-a-j` (normal)
 */
export function join_select(_: Context, separator?: Argument<string>) {
  return joinLines(selectionsLines(), separator).then(setSelections);
}

/**
 * Indent selected lines.
 *
 * @keys `>` (normal)
 */
export function indent(_: Context, repetitions: number) {
  return indentLines(selectionsLines(), repetitions, /* indentEmpty= */ false);
}

/**
 * Indent selected lines (including empty lines).
 *
 * @keys `a->` (normal)
 */
export function indent_withEmpty(_: Context, repetitions: number) {
  return indentLines(selectionsLines(), repetitions, /* indentEmpty= */ true);
}

/**
 * Deindent selected lines.
 *
 * @keys `a-<` (normal)
 */
export function deindent(_: Context, repetitions: number) {
  return deindentLines(selectionsLines(), repetitions, /* deindentIncomplete= */ false);
}

/**
 * Deindent selected lines (including incomplete indent).
 *
 * @keys `<` (normal)
 */
export function deindent_withIncomplete(_: Context, repetitions: number) {
  return deindentLines(selectionsLines(), repetitions, /* deindentIncomplete= */ true);
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
 * @keys `s-a-o` (normal)
 *
 * #### Additional keybindings
 *
 * | Title                                      | Identifier             | Keybinding     | Commands                                                                         |
 * | ------------------------------------------ | ---------------------- | -------------- | -------------------------------------------------------------------------------- |
 * | Insert new line above and switch to insert | `newLine.above.insert` | `s-o` (normal) | `[".edit.newLine.above", { select: true }], [".modes.set", { input: "insert" }]` |
 */
export function newLine_above(_: Context, select: Argument<boolean> = false) {
  if (select) {
    Selections.update.byIndex(prepareSelectionForLineInsertion);

    // Use built-in `insertLineBefore` command. It gives us less control, but at
    // least it handles indentation well.
    return vscode.commands.executeCommand("editor.action.insertLineBefore");
  }

  return edit((builder, selections, document) => {
    const newLine = document.eol === vscode.EndOfLine.LF ? "\n" : "\r\n",
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
 * @keys `a-o` (normal)
 *
 * #### Additional keybindings
 *
 * | Title                                      | Identifier             | Keybinding   | Commands                                                                         |
 * | ------------------------------------------ | ---------------------- | ------------ | -------------------------------------------------------------------------------- |
 * | Insert new line below and switch to insert | `newLine.below.insert` | `o` (normal) | `[".edit.newLine.below", { select: true }], [".modes.set", { input: "insert" }]` |
 */
export function newLine_below(_: Context, select: Argument<boolean> = false) {
  if (select) {
    Selections.update.byIndex(prepareSelectionForLineInsertion);

    // Use built-in `insertLineAfter` command. It gives us less control, but at
    // least it handles indentation well.
    return vscode.commands.executeCommand("editor.action.insertLineAfter");
  }

  return edit((builder, selections, document) => {
    const newLine = document.eol === vscode.EndOfLine.LF ? "\n" : "\r\n",
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
