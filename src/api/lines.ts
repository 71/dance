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
