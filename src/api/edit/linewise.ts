import * as vscode from "vscode";

import { Context, edit } from "..";
import { blankCharacters } from "../../utils/charset";

/**
 * Increases the indentation of the given lines by the given count.
 *
 * ### Example
 * ```js
 * await indentLines([0, 1, 3]);
 * ```
 *
 * Before:
 * ```
 * a
 *
 * c
 * d
 * ```
 *
 * After:
 * ```
 *   a
 *
 * c
 *   d
 * ```
 *
 * ### Example
 * ```js
 * await indentLines([0], 2);
 * ```
 *
 * Before:
 * ```
 * a
 * ```
 *
 * After:
 * ```
 *     a
 * ```
 *
 * ### Example
 * ```js
 * await indentLines([0, 1], 1, true);
 * ```
 *
 * Before:
 * ```
 * a
 *
 * ```
 *
 * After:
 * ```
 *   a
 * ··
 * ```
 */
export function indentLines(lines: Iterable<number>, times = 1, indentEmpty = false) {
  const options = Context.current.editor.options,
        indent = options.insertSpaces
          ? " ".repeat(options.tabSize as number * times)
          : "\t".repeat(times);

  if (indentEmpty) {
    return edit((editBuilder) => {
      const seen = new Set<number>();

      for (const line of lines) {
        const cnt = seen.size;

        if (seen.add(line).size === cnt) {
          // Avoid indenting the same line more than once.
          continue;
        }

        editBuilder.insert(new vscode.Position(line, 0), indent);
      }
    });
  } else {
    return edit((editBuilder, _, document) => {
      const seen = new Set<number>();

      for (const line of lines) {
        const cnt = seen.size;

        if (seen.add(line).size === cnt || document.lineAt(line).isEmptyOrWhitespace) {
          // Avoid indenting empty lines or the same line more than once.
          continue;
        }

        editBuilder.insert(new vscode.Position(line, 0), indent);
      }
    });
  }
}

/**
 * Decreases the indentation of the given lines by the given count.
 *
 * ### Example
 * ```js
 * await deindentLines([0, 1, 3]);
 * ```
 *
 * Before:
 * ```
 *   a
 * ··
 *     c
 *     d
 * ```
 *
 * After:
 * ```
 * a
 *
 *     c
 *   d
 * ```
 *
 * ### Example
 * ```js
 * await deindentLines([0, 1, 3], 2);
 * ```
 *
 * Before:
 * ```
 *   a
 * ··
 *     c
 *     d
 * ```
 *
 * After:
 * ```
 * a
 *
 *     c
 * d
 * ```
 */
export function deindentLines(lines: Iterable<number>, times = 1, deindentIncomplete = true) {
  return edit((editBuilder, _, document) => {
    const tabSize = Context.current.editor.options.tabSize as number,
          needed = times * tabSize,
          seen = new Set<number>();

    for (const line of lines) {
      const cnt = seen.size;

      if (seen.add(line).size === cnt) {
        // Avoid deindenting the same line more than once.
        continue;
      }

      const textLine = document.lineAt(line),
            text = textLine.text;

      let column = 0,  // Column, accounting for tab size.
          j = 0;       // Index in source line, and number of characters to remove.

      for (; column < needed; j++) {
        const char = text[j];

        if (char === "\t") {
          column += tabSize;
        } else if (char === " ") {
          column++;
        } else {
          break;
        }
      }

      if (!deindentIncomplete && j < text.length) {
        j -= j % tabSize;
      }

      if (j !== 0) {
        editBuilder.delete(textLine.range.with(undefined, textLine.range.start.translate(0, j)));
      }
    }
  });
}

/**
 * Joins all consecutive lines in the given list together with the given
 * separator.
 *
 * ### Example
 * ```js
 * await joinLines([0]);
 * ```
 *
 * Before:
 * ```
 * a b
 * c d
 * e f
 * g h
 * ```
 *
 * After:
 * ```
 * a b c d
 * e f
 * g h
 * ```
 *
 * ### Example
 * ```js
 * await joinLines([0, 1]);
 * ```
 *
 * Before:
 * ```
 * a b
 * c d
 * e f
 * g h
 * ```
 *
 * After:
 * ```
 * a b c d
 * e f
 * g h
 * ```
 *
 * ### Example
 * ```js
 * await joinLines([0, 2]);
 * ```
 *
 * Before:
 * ```
 * a b
 * c d
 * e f
 * g h
 * ```
 *
 * After:
 * ```
 * a b c d
 * e f g h
 * ```
 *
 * ### Example
 * ```js
 * await joinLines([1], "    ");
 * ```
 *
 * Before:
 * ```
 * a b
 * c d
 * e f
 * g h
 * ```
 *
 * After:
 * ```
 * a b
 * c d    e f
 * g h
 * ```
 */
export function joinLines(lines: Iterable<number>, separator: string = " ") {
  // Sort lines (no need to dedup).
  const sortedLines = [...lines].sort((a, b) => a - b);

  if (sortedLines.length === 0) {
    return Context.current.wrap(Promise.resolve([]));
  }

  // Determine all ranges; (range[i], range[i + 1]) <=> (startLine, length).
  const ranges = [sortedLines[0], 0] as number[];

  for (let i = 1, len = sortedLines.length; i < len; i++) {
    const line = sortedLines[i],
          lastLine = sortedLines[i - 1];

    if (line === lastLine) {
      continue;
    } else if (line === lastLine + 1) {
      ranges[ranges.length - 1]++;
    } else {
      ranges.push(line, 0);
    }
  }

  return edit((editBuilder, _, document) => {
    let diff = 0;
    const selections = [] as vscode.Selection[];

    // Perform edit on each line.
    for (let i = 0, len = ranges.length; i < len; i += 2) {
      const startLine = ranges[i],
            count = ranges[i + 1] || 1;
      let prevLine = document.lineAt(startLine),
          currentEnd = 0;

      for (let j = 0; j < count; j++) {
        const nextLine = document.lineAt(startLine + j + 1);

        // Find index of last non-whitespace character.
        let endCharacter = prevLine.text.length;

        while (endCharacter > 0) {
          if (!blankCharacters.includes(prevLine.text[endCharacter - 1])) {
            break;
          }

          endCharacter--;
        }

        const start = new vscode.Position(prevLine.lineNumber, endCharacter),
              end = new vscode.Position(nextLine.lineNumber,
                                        nextLine.firstNonWhitespaceCharacterIndex),
              finalCharacter = currentEnd + endCharacter,
              finalStart = new vscode.Position(startLine - diff, finalCharacter),
              finalEnd = new vscode.Position(startLine - diff, finalCharacter + separator.length);

        editBuilder.replace(new vscode.Range(start, end), separator);
        selections.push(new vscode.Selection(finalStart, finalEnd));
        prevLine = nextLine;
        currentEnd = finalCharacter + separator.length - nextLine.firstNonWhitespaceCharacterIndex;
      }

      diff += count;
    }

    return selections;
  });
}
