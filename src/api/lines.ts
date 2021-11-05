import * as vscode from "vscode";

import { Context } from "./context";

/**
 * Returns the 0-based number of the first visible line in the current editor.
 */
export function firstVisibleLine(editor = Context.current.editor) {
  return editor.visibleRanges[0].start.line;
}

/**
 * Returns the 0-based number of the middle visible line in the current editor.
 */
export function middleVisibleLine(editor = Context.current.editor) {
  const range = editor.visibleRanges[0];

  return ((range.start.line + range.end.line) / 2) | 0;
}

/**
 * Returns the 0-based number of the last visible line in the current editor.
 */
export function lastVisibleLine(editor = Context.current.editor) {
  return editor.visibleRanges[0].end.line;
}

export namespace Lines {
  /**
   * Returns the text contents of the given line.
   */
  export function text(line: number, document = Context.current.document) {
    return document.lineAt(line).text;
  }

  /**
   * Returns the length of the given line.
   */
  export function length(line: number, document = Context.current.document) {
    return document.lineAt(line).text.length;
  }

  /**
   * Returns whether the given line is empty.
   */
  export function isEmpty(line: number, document = Context.current.document) {
    return length(line, document) === 0;
  }

  /**
   * Returns the given line number, possibly modified to fit in the current
   * document.
   */
  export function clamp(line: number, document?: vscode.TextDocument) {
    if (line < 0) {
      return 0;
    }

    const lastLine = (document ?? Context.current.document).lineCount - 1;

    if (line > lastLine) {
      return lastLine;
    }

    return line;
  }
}

function diffAddedByTabs(text: string, editor: Pick<vscode.TextEditor, "options">) {
  const tabSize = editor.options.tabSize as number;
  let total = 0;

  for (const ch of text) {
    if (ch === "\t") {
      total += tabSize - 1;
    }
  }

  return total;
}

function getCharacter(
  text: string,
  column: number,
  editor: Pick<vscode.TextEditor, "options">,
  roundUp: boolean,
) {
  const tabSize = editor.options.tabSize as number;
  let character = 0;

  for (const ch of text) {
    if (column <= 0) {
      break;
    }

    if (ch === "\t") {
      column -= tabSize;

      if (!roundUp && column < 0) {
        // Handle negative values here to escape loop before incrementing
        // `character`.
        break;
      }
    } else {
      column--;
    }

    character++;
  }

  return character;
}

/**
 * Returns the position corresponding to the character at the given position,
 * taking into account tab characters that precede it.
 */
export function column(
  position: vscode.Position,
  editor?: Pick<vscode.TextEditor, "document" | "options">,
): vscode.Position;

/**
 * Returns the render column corresponding to the specified character in the
 * specified line, taking into account tab characters that precede it.
 */
export function column(
  line: number,
  character: number,
  editor?: Pick<vscode.TextEditor, "document" | "options">,
): number;

export function column(
  line: number | vscode.Position,
  character?: number | Pick<vscode.TextEditor, "document" | "options">,
  editor?: Pick<vscode.TextEditor, "document" | "options">,
) {
  if (typeof line === "number") {
    editor ??= Context.current.editor;

    const text = editor.document.lineAt(line).text.slice(0, character as number);

    return text.length + diffAddedByTabs(text, editor);
  }

  editor ??= Context.current.editor;

  const text = editor.document.lineAt(line.line).text.slice(0, line.character);

  return new vscode.Position(line.line, text.length + diffAddedByTabs(text, editor));
}

export namespace column {
  /**
   * Returns the `vscode.Position`-compatible position for the given position.
   * Reverses the diff added by `column`.
   */
  export function character(
    position: vscode.Position,
    editor?: Pick<vscode.TextEditor, "document" | "options">,
    roundUp?: boolean,
  ): vscode.Position;

  /**
   * Returns the `vscode.Position`-compatible character for the given column.
   * Reverses the diff added by `column`.
   */
  export function character(
    line: number,
    character: number,
    editor?: Pick<vscode.TextEditor, "document" | "options">,
    roundUp?: boolean,
  ): number;

  export function character(
    lineOrPosition: number | vscode.Position,
    characterOrEditor?: number | Pick<vscode.TextEditor, "document" | "options">,
    editorOrRoundUp?: Pick<vscode.TextEditor, "document" | "options"> | boolean,
    roundUp?: boolean,
  ) {
    if (typeof lineOrPosition === "number") {
      // Second overload.
      const line = lineOrPosition,
            character = characterOrEditor as number,
            editor = editorOrRoundUp as vscode.TextEditor ?? Context.current.editor;

      return getCharacter(editor.document.lineAt(line).text, character, editor, roundUp ?? false);
    }

    // First overload.
    const position = lineOrPosition,
          editor = characterOrEditor as vscode.TextEditor ?? Context.current.editor;

    roundUp = editorOrRoundUp as boolean ?? false;

    const text = editor.document.lineAt(position.line).text;

    return new vscode.Position(
      position.line, getCharacter(text, position.character, editor, roundUp));
  }
}

/**
 * Same as `Lines.length`, but also increases the count according to tab
 * characters so that the result matches the rendered view.
 *
 * @see Lines.length
 */
export function columns(
  line: number | vscode.Position,
  editor: Pick<vscode.TextEditor, "document" | "options"> = Context.current.editor,
): number {
  if (typeof line !== "number") {
    line = line.line;
  }

  const text = editor.document.lineAt(line).text;

  return text.length + diffAddedByTabs(text, editor);
}
