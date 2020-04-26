import * as vscode from 'vscode'
import { CommandState } from '../commands'
import { ExtendBehavior } from './selectionSet'

export class SelectionHelper {
  static for(editor: vscode.TextEditor, state: CommandState): SelectionHelper {
    // TODO: Caching
    return new SelectionHelper(editor, state)
  }
  get allowEmpty(): boolean {
    return this.state.allowEmptySelections
  }
  get allowNonDirectional(): boolean {
    return !this.state.allowEmptySelections
  }

  /**
   * Get the "cursor active" Coord of a selection.
   *
   * In other words, the basis Coord for moving, etc. of the selection. This
   * method handles special cases for non-directional selections correctly.
   * @param selection
   */
  activeCoord(selection: vscode.Selection): Coord {
    if (!this.allowNonDirectional) return selection.active
    if (selection.isEmpty) return selection.active
    if (selection.isReversed) {
      return selection.active
    } else {
      return this.coordAt(this.offsetAt(selection.active) - 1)
    }
  }

  moveEach(mode: MoveMode, skip: SkipFunc, select: SelectFunc, extend: ExtendBehavior): void {
    const newSelections: vscode.Selection[] = []
    const editor = this.editor
    for (let i = 0; i < editor.selections.length; i++) {
      const startAt = this.activeCoord(editor.selections[i])
      console.log('START', this._visualizeCoord(startAt))
      const skipTo = skip(startAt, this, i)
      console.log(' SKIP', this._visualizeCoord(skipTo))
      const endAt = select(skipTo, this, i)
      console.log(' END-', this._visualizeCoord(endAt))
      if (extend) {
        newSelections.push(this.extend(editor.selections[i], mode, endAt))
      } else {
        // TODO: Optimize
        const skipCoordOffset = this.offsetAt(skipTo)
        newSelections.push(this.extend(
          new vscode.Selection(skipTo, this.allowEmpty
            ? skipTo : this.coordAt(skipCoordOffset + 1)),
          mode,
          endAt))
      }
    }
    editor.selections = newSelections
  }

  extend(oldSelection: vscode.Selection, mode: MoveMode, toCoord: Coord): vscode.Selection {
    const active = this.offsetAt(toCoord)
    const document = this.editor.document
    const oldAnchorOffset = document.offsetAt(oldSelection.anchor)
    if (oldAnchorOffset <= active) {
      const shouldCoverActive = (mode === MoveMode.ToCoverChar || (mode === MoveMode.To && !this.allowEmpty))
      const offset = shouldCoverActive ? 1 : 0
      if (oldSelection.isReversed && this.allowNonDirectional) {
        // BEFORE: |abc>de ==> AFTER: ab<cd|e or ab<c|de (single char forward).
        // Note that we need to decrement anchor to include the first char.
        const newAnchor = document.positionAt(oldAnchorOffset - 1)
        return new vscode.Selection(newAnchor, document.positionAt(active + offset))
      } else {
        // BEFORE:    |abc>de ==> AFTER: abc<d|e or abc<|de (empty).
        // OR BEFORE: <abc|de ==> AFTER: <abcd|e.
        return new vscode.Selection(oldSelection.anchor, document.positionAt(active + offset))
      }
    } else {
      const shouldCoverActive = (mode === MoveMode.ToCoverChar || mode === MoveMode.To)
      const offset = shouldCoverActive ? 0 : 1
      if (!oldSelection.isReversed && this.allowNonDirectional) {
        // BEFORE: ab<cd|e ==> AFTER: a|bc>de.
        // Note that we need to increment anchor to include the last char.
        const newAnchor = document.positionAt(oldAnchorOffset + 1)
        return new vscode.Selection(newAnchor, document.positionAt(active + offset))
      } else if (oldAnchorOffset === active + 1 && this.allowNonDirectional) {
        // BEFORE: a|bc>de ==> AFTER: ab<c|de (FORCE single char forward).
        return new vscode.Selection(document.positionAt(active + offset), oldSelection.anchor)
      } else {
        // BEFORE:    ab<cd|e ==> AFTER: a|b>cde.
        // OR BEFORE: ab|cd>e ==> AFTER: a|bcd>e.
        return new vscode.Selection(oldSelection.anchor, document.positionAt(active + offset))
      }
    }
  }

  /**
   * Get the line and character of an offset in the document.
   *
   * This should be used instead of `this.coordAt` to make
   * the intention clear and also allow future optimization like caching.
   * @param coordOffset the nth symbol (or line break) in the document
   */
  coordAt(coordOffset: number): Coord {
    // TODO: Caching
    return this.editor.document.positionAt(coordOffset)
  }

  /**
   * Get the total sequence number of symbol (or line break) in the document.
   *
   * This should be used instead of `this.offsetAt` to make
   * the intention clear and also allow future optimization like caching.
   * @param coord the line and character of the symbol in the document
   */
  offsetAt(coord: Coord): CoordOffset {
    // TODO: Caching
    return this.editor.document.offsetAt(coord)
  }

  /** DEBUG ONLY method to visualize an offset. DO NOT leave calls in code. */
  _visualizeOffset(offset: number): string {
    const position = this.coordAt(offset)
    return this._visualizePosition(position)
  }

  /** DEBUG ONLY method to visualize a position. DO NOT leave calls in code. */
  _visualizePosition(position: vscode.Position): string {
    const text = this.editor.document.lineAt(position.line).text
    return position.line + ':  ' + text.substr(0, position.character) + '|' + text.substr(position.character)
  }

  /** DEBUG ONLY method to visualize a Coord. DO NOT leave calls in code. */
  _visualizeCoord(coord: Coord): string {
    const text = this.editor.document.lineAt(coord.line).text
    const c = text[coord.character]
    return coord.line + ':  ' + text.substr(0, coord.character) + `[${c}]` + text.substr(coord.character + 1)
  }

  private constructor( public readonly editor: vscode.TextEditor, public readonly state: CommandState) {}
}

/**
 * A coordinate (line, character) in the document. It stands for the c-th
 * text symbol at the l-th line in the document (both zero-indexed).
 *
 * Note that a Coord should always be interpreted to be pointed at a text symbol
 * or the line break at the end of the current line (e.g. the 'b' in 'abc').
 * It should not be mistaken for a Position between symbols (a|bc in 'abc').
 */
export interface Coord extends vscode.Position {
  // Dummy interface so that it shows as its type in generated docs, IDE hover
  // tooltips, etc. Do not add fields here.
}
export const Coord = vscode.Position // To allow sugar like `new Coord(1, 2)`.
export type CoordOffset = number

export type SkipFunc = (from: Coord, helper: SelectionHelper, i: number) => Coord;
export type SelectFunc = (from: Coord, helper: SelectionHelper, i: number) => Coord;

export enum MoveMode {
  /** Move to cover the character at offset / after position. */
  ToCoverChar,
  /** Move to touch, but not cover the character at offset / after position. */
  UntilChar,
  /**
   * Move so that:
   * - If !allowEmpty, exactly the same as ToCoverChar.
   * - If allowEmpty, active is exactly at position / offset. (The selection may
   *   or may not cover the character at offset / after position, depending on
   *   the direction of the selection.)
   */
  To,
}
