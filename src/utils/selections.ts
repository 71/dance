import * as vscode from 'vscode'

/**
 * Direction of an operation.
 */
export const enum Direction {
  /** Forward direction (`1`). */
  Forward = 1,
  /** Backward direction (`-1`). */
  Backward = -1,
}

export const Forward = Direction.Forward
export const Backward = Direction.Backward

/**
 * Returns the position at the given offset (given by a string) from the given position.
 */
export function offsetPosition(document: vscode.TextDocument, text: string, position: vscode.Position, direction: Direction) {
  if (direction === Forward) {
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

/**
 * Gets the anchor of a selection for extending the selection in the given direction.
 *
 * This function treats single-character selections as non-directional.
 */
export function getAnchorForExtending(selection: vscode.Selection, direction: Direction) {
  if (selection.isEmpty)
    return selection.anchor
  if (selection.isSingleLine && selection.anchor.character === selection.active.character + direction)
    return selection.active
  else
    return selection.anchor
}

/**
 * Gets the active position of a selection for extending the selection in the given direction.
 *
 * This function treats single-character selections as non-directional.
 */
export function getActiveForExtending(selection: vscode.Selection, direction: Direction) {
  if (selection.isEmpty)
    return selection.active
  if (selection.isSingleLine && selection.active.character === selection.anchor.character + direction)
    return selection.anchor
  else
    return selection.active
}

/**
 * Returns the given selection, possibly reversed to extend in some direction.
 *
 * This function treats single-character selections as non-directional.
 */
export function forExtending(selection: vscode.Selection, direction: Direction) {
  if (!selection.isEmpty && selection.isSingleLine && selection.active.character === selection.anchor.character + direction)
    return new vscode.Selection(selection.active, selection.anchor)
  else
    return selection
}
