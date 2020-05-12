import * as vscode from 'vscode'

import { CommandState } from '../commands'
import { EditorState }       from '../state/editor'
import { SelectionBehavior } from '../state/extension'

export const DocumentStart = new vscode.Position(0, 0)

/**
 * Direction of an operation.
 */
export const enum Direction {
  /** Forward direction (`1`). */
  Forward = 1,
  /** Backward direction (`-1`). */
  Backward = -1,
}

/**
 * Whether or not an operation should expend a selection.
 */
export type ExtendBehavior = boolean

/** Forward direction. */
export const Forward = Direction.Forward
/** Backward direction. */
export const Backward = Direction.Backward

/** Do extend. */
export const Extend = true as ExtendBehavior
/** Do not extend. */
export const DoNotExtend = false as ExtendBehavior

export class SelectionHelper<State extends { selectionBehavior: SelectionBehavior }> {
  static for(editorState: EditorState): SelectionHelper<EditorState>
  static for<State extends { selectionBehavior: SelectionBehavior }>(editorState: EditorState, state: State): SelectionHelper<State>

  static for(editorState: EditorState, state?: any) {
    // TODO: Caching
    return new SelectionHelper(editorState, state ?? editorState)
  }

  readonly selectionBehavior = this.state.selectionBehavior

  /**
   * Get the "cursor active" Coord of a selection.
   *
   * In other words, the basis Coord for moving, etc. of the selection. This
   * method handles special cases for non-directional selections correctly.
   * @param selection
   */
  activeCoord(selection: vscode.Selection): Coord {
    if (this.selectionBehavior === SelectionBehavior.Caret ||
        selection.active.isEqual(DocumentStart) ||
        selection.isEmpty || selection.isReversed)
      return selection.active
    return this.coordAt(this.offsetAt(selection.active) - 1)
  }

  /**
   * Apply a transformation to each selection.
   *
   * If all selections are to be removed, an alert will be raised and selections
   * are left untouched (or replaced by fallback, if provided).
   *
   * @param mapper a function takes the old selection and return a new one or
   *               `{remove: true}` with optional fallback.
   *
   * @see moveActiveCoord,jumpTo,seekToRange for utilities to create mappers for
   *                                         common select operations
  */
  mapEach(mapper: SelectionMapper<State>): void {
    const newSelections: vscode.Selection[] = []
    const editor = this.editor
    let acceptFallback = true
    const len = editor.selections.length
    for (let i = 0; i < len; i++) {
      const moveResult = mapper(editor.selections[i], this, i)
      if (moveResult === RemoveSelection || 'remove' in moveResult) {
        if (acceptFallback)
          newSelections.push(moveResult.fallback || editor.selections[i])
      } else {
        if (acceptFallback) {
          newSelections.length = 0 // Clear all fallback selections so far.
          acceptFallback = false
        }
        newSelections.push(moveResult)
      }
    }
    if (acceptFallback) {
      vscode.window.showErrorMessage('No selections remaining.')
      // Or show error in the status bar? VSCode does not have a way to dismiss
      // messages, but they recommend setting the status bar instead.
      // See: https://github.com/Microsoft/vscode/issues/2732
    }
    editor.selections = newSelections
  }

  /**
   * Return a selection that spans from and to (both inclusive).
   * @param from the coordinate of the starting symbol to include
   * @param to the coordinate of the ending symbol to include
   * @param singleCharDirection the direction of selection when from equals to
   */
  selectionBetween(from: Coord, to: Coord, singleCharDirection: Direction = Forward): vscode.Selection {
    // TODO: Remove this.coordAt and this.offsetAt. Use lineAt for shifting to
    // the next position.
    if (from.isBefore(to) ||
        (from.isEqual(to) && singleCharDirection === Forward)) {
      // Forward: 0123456 ==select(1, 4)=> 0<1234|56
      // Need to increment `to` to include the last character.
      const active = this.coordAt(this.offsetAt(to) + 1)
      return new vscode.Selection(from, active)
    } else {
      // Reverse: 0123456 ==select(4, 1)=> 0|1234>56
      // Need to increment `from` to include the last character.
      const anchor = this.coordAt(this.offsetAt(from) + 1)
      return new vscode.Selection(anchor, to)
    }
  }

  extend(oldSelection: vscode.Selection, to: Coord): vscode.Selection {
    // TODO: Remove this.coordAt and this.offsetAt. Use lineAt for shifting to
    // the next / previous position.
    let { anchor } = oldSelection
    if (anchor.isBeforeOrEqual(to)) {
      // The resulting selection will be forward-facing.
      if (this.selectionBehavior === SelectionBehavior.Character && oldSelection.isReversed) {
        // Flipping selections in the opposite direction: 0|1>2345 to 0<12345|
        // Need to push anchor backwards so that the first symbol is included.
        anchor = this.coordAt(this.offsetAt(anchor) - 1)
      }
      if (this.selectionBehavior === SelectionBehavior.Character || to.isAfterOrEqual(oldSelection.active)) {
        // Moving forward (or non-directional): 01|23>456 ==(to 4)==> 01|234>56
        // Need to increment to include the the symbol at `to`.
        const active = this.coordAt(this.offsetAt(to) + 1)
        return new vscode.Selection(anchor, active)
      } else {
        // Moving backwards: 01|23>456 ==(to 2)==> 01|>23456
        // The symbol at `to` is excluded in this case, since we're
        // "deselecting" that character.
        return new vscode.Selection(anchor, to)
      }
    } else {
      // The resulting selection will be (most likely) backwards-facing.
      const afterTo = this.coordAt(this.offsetAt(to) + 1)
      if (this.selectionBehavior === SelectionBehavior.Character) {
        if ((!oldSelection.isReversed && oldSelection.anchor.isEqual(to)) ||
            (oldSelection.isReversed && oldSelection.anchor.isEqual(afterTo))) {
          // Special case one character selections to face forward:
          return new vscode.Selection(to, afterTo)
        } else if (!oldSelection.isReversed) {
          // Flipping selections in the opposite direction: 0123<4|5 to |01234>5
          // Need to push anchor forward so that the last symbol is included.
          anchor = this.coordAt(this.offsetAt(anchor) + 1)
        }
      }
      if (this.selectionBehavior === SelectionBehavior.Character || to.isBeforeOrEqual(oldSelection.active)) {
        // Moving backward (or non-directional): 012<34|5 ==(to 2)==> 01<234|5
        // Include the symbol at `to`.
        return new vscode.Selection(anchor, to)
      } else {
        // Moving forward (or non-directional): 012<34|5 ==(to 4)==> 01234<|5
        // The symbol at `to` is excluded in this case, since we're
        // "deselecting" that character.
        return new vscode.Selection(anchor, afterTo)
      }
    }
  }

  /** Get the next position in document. */
  nextPos(pos: vscode.Position): vscode.Position {
    // TODO: Optimize
    return this.coordAt(this.offsetAt(pos) + 1)
  }

  /** Get the previous position in document. */
  prevPos(pos: vscode.Position): vscode.Position {
    // TODO: Optimize
    return this.coordAt(this.offsetAt(pos) - 1)
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

  endLine(selection: vscode.Selection) {
    if (this.selectionBehavior === SelectionBehavior.Character && selection.end === selection.active && selection.end.character === 0)
      return selection.end.line - 1
    else
      return selection.end.line
  }

  activeLine(selection: vscode.Selection) {
    if (this.selectionBehavior === SelectionBehavior.Character && selection.end === selection.active && selection.end.character === 0)
      return selection.active.line - 1
    else
      return selection.active.line
  }

  endCharacter(selection: vscode.Selection, forPositionConstructor = false) {
    if (this.selectionBehavior === SelectionBehavior.Character && selection.end === selection.active && selection.end.character === 0)
      return forPositionConstructor ? Number.MAX_SAFE_INTEGER : this.editor.document.lineAt(selection.end.line - 1).text.length + 1
    else
      return selection.end.character
  }

  activeCharacter(selection: vscode.Selection, forPositionConstructor = false) {
    if (this.selectionBehavior === SelectionBehavior.Character && selection.end === selection.active && selection.active.character === 0)
      return forPositionConstructor ? Number.MAX_SAFE_INTEGER : this.editor.document.lineAt(selection.active.line - 1).text.length + 1
    else
      return selection.active.character
  }

  isSingleLine(selection: vscode.Selection) {
    return selection.isSingleLine || selection.start.line === this.endLine(selection)
  }

  isEntireLine(selection: vscode.Selection) {
    return selection.start.character === 0 && selection.end.character === 0 && selection.start.line === selection.end.line - 1
  }

  /**
   * The selection length of the given selection, as defined by `offsetAt(active) - offsetAt(anchor)`.
   *
   * If the selection is reversed, the selection length is negative.
   */
  selectionLength(selection: vscode.Selection) {
    if (selection.isSingleLine)
      return selection.active.character - selection.anchor.character

    return this.offsetAt(selection.active) - this.offsetAt(selection.anchor)
  }

  selectionFromLength(anchorCoord: Coord, length: number) {
    return new vscode.Selection(anchorCoord, this.coordAt(this.offsetAt(anchorCoord) + length))
  }

  lastCoord(): Coord {
    const document = this.editor.document
    const lastLineText = document.lineAt(document.lineCount - 1).text
    if (lastLineText.length > 0)
      return new Coord(document.lineCount - 1, lastLineText.length - 1)
    if (document.lineCount >= 2)
      return new Coord(document.lineCount - 2, document.lineAt(document.lineCount - 2).text.length)
    return DocumentStart
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
    let visualLine
    if (coord.character === text.length) {
      visualLine = text + '⏎'
    } else {
      visualLine = text.substr(0, coord.character) + `[${text[coord.character]}]` + text.substr(coord.character + 1)
    }
    return `L${coord.line}:  ${visualLine}`
  }

  readonly editor: vscode.TextEditor

  private constructor(public readonly editorState: EditorState, public readonly state: State) {
    this.editor = editorState.editor
  }
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

export type SelectionMapper<State extends {selectionBehavior: SelectionBehavior} = CommandState> =
    (selection: vscode.Selection, helper: SelectionHelper<State>, i: number) => vscode.Selection | {remove: true, fallback?: vscode.Selection}
export type CoordMapper = (oldActive: Coord, helper: SelectionHelper<CommandState>, i: number) => Coord | typeof RemoveSelection
export type SeekFunc = (oldActive: Coord, helper: SelectionHelper<CommandState>, i: number) => [Coord, Coord] | {remove: true, fallback?: [Coord | undefined, Coord]}

export const RemoveSelection: {remove: true} = { remove: true }

/**
 * Create a SelectionMapper that moves selection's active to a new coordinate.
 *
 * @summary The mapper created is useful for commands that "drags" to a
 * character such as `f` (selectTo) without moving anchor.
 *
 * When extending, the new selection will keep the same anchor caret /
 * character (depending on `this.selectionBehavior`). When not extending, the
 * new selection anchors to the old active caret / character. Either way,
 * the new active will always sweep over the symbol at the coordinate
 * returned, selecting or deselecting it as appropriate.
 *
 * @param activeMapper a function that takes an old active coordinate and return
 *                     the Coord of the symbol to move to or `RemoveSelection`
 * @param extend if Extend, the new selection will keep the anchor caret /
 *               character. Otherwise, it is anchored to old active.
 * @returns a SelectionMapper that is suitable for SelectionHelper#mapEach
 */
export function moveActiveCoord(activeMapper: CoordMapper, extend: ExtendBehavior): SelectionMapper {
  return (selection, helper, i) => {
    const oldActive = helper.activeCoord(selection)
    const newActive = activeMapper(oldActive, helper, i)
    if ('remove' in newActive) return RemoveSelection

    if (extend)
      return helper.extend(selection, newActive)

    if (helper.selectionBehavior === SelectionBehavior.Caret) {
      // TODO: Optimize to avoid coordAt / offsetAt.
      let activePos = selection.active.isBeforeOrEqual(newActive) ?
        helper.coordAt(helper.offsetAt(newActive) + 1) : newActive
      return new vscode.Selection(selection.active, activePos)
    }
    return helper.selectionBetween(oldActive, newActive)
  }
}

/**
 * Create a SelectionMapper that jump / extend the selection to a new position
 * (caret or coordinate, depending on `this.selectionBehavior`).
 *
 * @summary The mapper created is useful for commands that "jump" to a place
 * without dragging to it, such as `gg` (gotoFirstLine) or arrows (`hjkl`).
 *
 * When `this.selectionBehavior` is Caret, the new active will be at the caret
 * at the result Position. When not extending, the anchor is moved there as
 * well, creating an empty selection on that spot.
 *
 * When `this.selectionBehavior` is Character and extending, new active always
 * include the symbol at Position. When not extending, the new selection will
 * contain exactly one symbol under the result Position.
 *
 * @param activeMapper a function that takes an old active coordinate and return
 *                     the caret / character move to or `RemoveSelection`.
 * @param extend if Extend, the new selection will keep the anchor caret /
 *               character. Otherwise, it is anchored to old active.
 * @returns a SelectionMapper that is suitable for SelectionHelper#mapEach
 */
export function jumpTo(activeMapper: CoordMapper, extend: ExtendBehavior): SelectionMapper {
  return (selection, helper, i) => {
    const oldActive = helper.activeCoord(selection)
    const newActive = activeMapper(oldActive, helper, i)
    if ('remove' in newActive) return RemoveSelection

    if (helper.selectionBehavior === SelectionBehavior.Caret)
      return new vscode.Selection(extend ? selection.anchor : newActive, newActive)

    if (extend)
      return helper.extend(selection, newActive)

    return helper.selectionBetween(newActive, newActive)
  }
}

/**
 * Create a SelectionMapper that change / extend the selection to a new
 * character range (including starting and ending characters).
 *
 * @summary The mapper created is useful for commands that "seeks" to a range of
 * characters and re-anchor, such as `w` (selectWord) or `m` (selectMatching).
 *
 * The seek function returns two Coords, start and end, both inclusive. If not
 * extending, a new selection will be created that includes both symbols under
 * start and end. (The selection will be reversed if start is after end). When
 * extending, start is ignored and the old extension is extended to sweep over
 * the end symbol, selecting or deselecting it as appropriate.
 *
 * @param seekFunc a function that takes an old active coordinate and return
 *                 the range ([start, end]) to seek to, or remove.
 * @param extend if Extend, the new selection will keep the anchor caret /
 *               character. Otherwise, the new selection is anchored to start.
 * @returns a SelectionMapper that is suitable for SelectionHelper#mapEach
 */
export function seekToRange(seek: SeekFunc, extend: ExtendBehavior): SelectionMapper {
  return (selection, helper, i) => {
    const oldActive = helper.activeCoord(selection)
    const seekResult = seek(oldActive, helper, i)
    let remove = false
    let start: Coord | undefined,
        end: Coord

    if ('remove' in seekResult) {
      if (!seekResult.fallback) return RemoveSelection
      // Avoid array destructuring which is not fully optimized yet in V8.
      // See: http://bit.ly/array-destructuring-for-multi-value-returns
      start = seekResult.fallback[0]
      end = seekResult.fallback[1]
      remove = true
    } else {
      start = seekResult[0]
      end = seekResult[1]
    }

    let newSelection
    if (!start || extend) {
      newSelection = helper.extend(selection, end)
    } else {
      let singleCharDirection = Forward
      if (helper.selectionBehavior === SelectionBehavior.Caret &&
          end.isBefore(selection.active)) {
        // When moving backwards creates a single character selection, make sure
        // the selection is backwards. This is important so that the active
        // position is where the user expect it to be.
        singleCharDirection = Backward
      }
      newSelection = helper.selectionBetween(start, end, singleCharDirection)
    }

    if (remove)
      return { remove, fallback: newSelection }
    else
      return newSelection
  }
}
