import * as vscode from "vscode";
import {
  Context,
  deindentLines,
  edit,
  indentLines,
  joinLines,
  replace,
  Selections,
  selectionsLines,
  setSelections,
  toMode,
} from "../api";
import { Register } from "../register";
import { keypress, prompt } from "../utils/prompt";

/**
 * Commands that perform changes on the text content of the document.
 *
 * See https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#changes.
 */
declare module "./edit";

/**
 * Join lines.
 *
 * @keys `a-j` (normal)
 */
export function join(_: Context, argument?: { separator?: string }) {
  return joinLines(selectionsLines(), argument?.separator);
}

/**
 * Join lines and select inserted separators.
 *
 * @keys `s-a-j` (normal)
 */
export function join_select(_: Context, argument?: { separator?: string }) {
  return joinLines(selectionsLines(), argument?.separator).then(setSelections);
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
  input?: string,
) {
  if (input === undefined) {
    input = await keypress(_.cancellationToken);
  }

  input = input.repeat(repetitions);

  return _.run(() => edit((editBuilder, editor, selections) => {
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
      const firstLine = editor.document.lineAt(i).range.with(selection.start);

      editBuilder.replace(
        firstLine,
        input!.repeat(firstLine.end.character - firstLine.start.character),
      );

      // Replace in intermediate lines
      while (++i < selection.end.line) {
        const line = editor.document.lineAt(i);

        editBuilder.replace(line.range, input!.repeat(line.text.length));
      }

      // Replace in last line
      const lastLine = editor.document.lineAt(i).range.with(undefined, selection.end);

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
export function align(_: Context, selections: readonly vscode.Selection[]) {
  const startChar = selections.reduce(
    (max, sel) => (sel.start.character > max ? sel.start.character : max),
    0,
  );

  return edit((builder, editor) => {
    const selections = editor.selections,
          len = selections.length;

    for (let i = 0; i < len; i++) {
      const selection = selections[i];

      builder.insert(selection.start, " ".repeat(startChar - selection.start.character));
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
export function copyIndentation(_: Context, editor: vscode.TextEditor, count: number) {
  const sourceSelection = editor.selections[count] ?? editor.selection,
        sourceIndent = editor.document
          .lineAt(sourceSelection.start)
          .firstNonWhitespaceCharacterIndex;

  return edit((builder, editor) => {
    const selections = editor.selections,
          len = selections.length;

    for (let i = 0; i < len; i++) {
      if (i === sourceSelection.start.line) {
        continue;
      }

      const line = editor.document.lineAt(selections[i].start),
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
 * Insert contents of register.
 *
 * A `where` argument may be specified to state where the text should be
 * inserted relative to each selection. If unspecified, each selection will be
 * replaced by the text.
 *
 * @keys `c-r` (normal), `c-r` (insert)
 *
 * #### Additional commands
 *
 * TODO
 *
 * | Title                   | Identifier     | Keybinding     | Commands                                                                                                                                        |
 * | ----------------------- | -------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
 * | Paste before            | `pipe.filter`  | `$` (normal)   | `` |
 * | Paste after             | `pipe.replace` | `|` (normal)   | ``                                                                                              |
 * | Paste before and select | `pipe.append`  | `!` (normal)   | ``                                                                              |
 * | Paste after and select  | `pipe.prepend` | `a-!` (normal) | ``                                                                            |
 */
export async function insert(
  _: Context,
  cancellationToken: vscode.CancellationToken,
  argument?: { where?: "active" | "anchor" | "start" | "end" },
  register?: Register,
) {
  if (register === undefined) {
    register = _.extensionState.registers.get(await keypress(cancellationToken));
  }

  Register.assertFlags(register, Register.Flags.CanRead);

  const editor = _.editor,
        contents = await register.get();

  if (contents === undefined) {
    throw new Error(`register ${register.name} does not contain any saved text`);
  }

  const selectionsLen = editor.selections.length;

  if (contents.length !== selectionsLen) {
    throw new Error(
      `register ${register.name} has ${contents.length} strings, but there are `
      + `${selectionsLen} selections`,
    );
  }

  // TODO: hard-code case where selection ends with \n.
  const where = argument?.where;

  if (where === undefined) {
    return replace.byIndex((i) => contents[i], editor);
  }

  if (!["active", "anchor", "start", "end"].includes(where)) {
    throw new Error(`where must be one of "active", "anchor", "start", "end", or undefined`);
  }

  return edit((editBuilder, editor) => {
    const selections = editor.selections;

    for (let i = 0; i < selections.length; i++) {
      editBuilder.insert(selections[i][where], contents[i]);
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
 * | Title                                      | Identifier             | Keybinding     | Commands                                           |
 * | ------------------------------------------ | ---------------------- | -------------- | -------------------------------------------------- |
 * | Insert new line above and switch to insert | `newLine.above.insert` | `s-o` (normal) | `[".newLine.above", { "switchToMode": "insert" }]` |
 */
export function newLine_above(_: Context, argument?: { switchToMode?: string }) {
  const switchToMode = argument?.switchToMode;

  if (switchToMode !== undefined) {
    const editor = _.editor;

    editor.selections = normalizeSelectionsForLineInsertion(editor.selections);

    return vscode.commands
      .executeCommand("editor.action.insertLineBefore")
      .then(() => _.run(() => toMode(switchToMode)));
  }

  return edit((builder, editor) => {
    const newLine = editor.document.eol === vscode.EndOfLine.LF ? "\n" : "\r\n",
          processedLines = new Set<number>();

    const selections = editor.selections,
          len = selections.length;

    for (let i = 0; i < len; i++) {
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
 * | Title                                      | Identifier             | Keybinding   | Commands                                           |
 * | ------------------------------------------ | ---------------------- | ------------ | -------------------------------------------------- |
 * | Insert new line below and switch to insert | `newLine.below.insert` | `o` (normal) | `[".newLine.below", { "switchToMode": "insert" }]` |
 */
export function newLine_below(_: Context, argument?: { switchToMode?: string }) {
  const switchToMode = argument?.switchToMode;

  if (switchToMode !== undefined) {
    const editor = _.editor;

    editor.selections = normalizeSelectionsForLineInsertion(editor.selections);

    return vscode.commands
      .executeCommand("editor.action.insertLineAfter")
      .then(() => _.run(() => toMode(switchToMode)));
  }

  return edit((builder, editor) => {
    const newLine = editor.document.eol === vscode.EndOfLine.LF ? "\n" : "\r\n",
          processedLines = new Set<number>();

    const selections = editor.selections,
          len = selections.length;

    for (let i = 0; i < len; i++) {
      const selection = selections[i],
            activeLine = Selections.activeLine(selection);

      if (processedLines.size !== processedLines.add(activeLine).size) {
        builder.insert(new vscode.Position(activeLine + 1, 0), newLine);
      }
    }
  });
}

function normalizeSelectionsForLineInsertion(selections: readonly vscode.Selection[]) {
  const len = selections.length,
        normalized = new Array<vscode.Selection>(len);

  for (let i = 0; i < len; i++) {
    let selection = selections[i];
    const activeLine = Selections.activeLine(selection);

    if (selection.active.line !== activeLine) {
      selection = new vscode.Selection(selection.anchor, selection.active.with(activeLine));
    }

    normalized[i] = selection;
  }

  return normalized;
}
