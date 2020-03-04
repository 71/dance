import * as vscode from 'vscode'

/**
 * Returns the position at the given offset (given by a string) from the given position.
 */
export function offsetPosition(document: vscode.TextDocument, text: string, position: vscode.Position, forwards: boolean) {
  if (forwards) {
    let line = position.line
    let char = position.character

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\r') {
        line++
        i++
        char = 0
      } else if (text[i] === '\n') {
        line++
        char = 0
      } else {
        char++
      }
    }

    return new vscode.Position(line, char)
  } else {
    let line = position.line
    let char = position.character

    for (let i = text.length - 1; i >= 0; i--) {
      if (text[i] === '\r') {
        line--
        i--
        char = document.lineAt(line).range.end.character
      } else if (text[i] === '\n') {
        line--
        char = document.lineAt(line).range.end.character
      } else {
        char--
      }
    }

    return new vscode.Position(line, char)
  }
}

/**
 * Returns a selection with the given start and end positions, possibly reversing it.
 */
export function makeSelection(start: vscode.Position, end: vscode.Position, isReversed: boolean | vscode.Selection) {
  if (typeof isReversed !== 'boolean')
    isReversed = isReversed.isReversed

  return isReversed ? new vscode.Selection(end, start) : new vscode.Selection(start, end)
}
