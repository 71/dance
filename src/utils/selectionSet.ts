import * as vscode from 'vscode'

import { assert } from './assert'
import { Extension } from '../extension'
import { selectionsAlign, selectToIncluded } from '../../commands'
import { Mode, remainingNormalCommands } from '../commands'


const DEBUG = true

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

/**
 * Behavior when limiting skipping to the current line in `Cursor`.
 */
export const enum LimitToCurrentLine {
  /** Do not limit to current line. */
  No = 0,

  /** Return `false` and cancel operation if the current line is left. */
  Cancel = 1,

  /** Return `true` and save position if the current line is left. */
  Accept = 2,

  /** Return `true` and go to next or previous line in given direction if the current line is left. */
  AcceptNext = 3,
}

export namespace Cursor {
  /**
   * Options passed to `Cursor.skipWhile` and `Cursor.skipUntil`.
   */
  export interface SkipOptions {
    /** Also include the current character. Default: `true`. */
    readonly includeCurrentCharacter?: boolean
    /** How the last character should be selected. Default: `Next`. */
    readonly select?: Select
    /** Behavior when limiting to current line. Default: `No`. */
    readonly limitToCurrentLine?: LimitToCurrentLine
    /** Restore the position before the skip operation if the predicate never returns true. Default: `false`. */
    readonly restorePositionIfNeverSatisfied?: boolean
  }

  /**
   * The character to select after skipping.
   */
  export const enum Select {
    /**
     * Select the current character, that is, the last character that matched the given condition.
     */
    Current,
    /**
     * Select the character right before the current character in the given direction, that is, the second-to-last
     * character that matched the given condition.
     */
    Previous,
    /**
     * Select the character right after the current character in the given direction, that is,
     * the first character that did not match the given condition.
     */
    Next,
  }
}

/**
 * A class used to operate on text surrounding a position.
 *
 * Operations on this class cache text lines, which means that `Cursor`s are
 * invalidated when the document on which they operate changes.
 */
export class Cursor {
  textLine: vscode.TextLine

  constructor(readonly position: Position) {
    this.textLine = position.textLine()
  }

  /**
   * The character code of the character under the cursor.
   */
  get charCode() {
    return this.textLine.text.charCodeAt(this.position.column)
  }

  /**
   * Skips one character in the given direction.
   *
   * @returns Whether the character could be skipped. This can only be false when
   * the start or the end of the document is reached.
   */
  skip(direction: Direction) {
    const position = this.position,
          offset = position.offset + direction,
          { line, column: character } = position

    if (direction === Forward) {
      if (character === this.textLine.range.end.character) {
        if (line === position.set.document.lineCount - 1) {
          return false
        }

        this.textLine = position.set.document.lineAt(line + 1)
        position.updateFast(offset, line, 0)
      } else {
        position.updateFast(offset, line, character + 1)
      }
    } else {
      if (character === 0) {
        if (line === 0) {
          return false
        }

        this.textLine = position.set.document.lineAt(line - 1)
        position.updateFast(offset, line - 1, this.textLine.text.length)
      } else {
        position.updateFast(offset, line, character - 1)
      }
    }

    return true
  }

  /**
   * Skips characters in the given direction until the given condition is false. If the condition is always
   * met until either the start or the end of the document, `false` is returned.
   */
  skipWhile(direction: Direction, condition: (charCode: number, offset: number, line: number, char: number) => boolean, options?: Cursor.SkipOptions) {
    const {
      select = Cursor.Select.Current,
      includeCurrentCharacter = true,
      limitToCurrentLine = LimitToCurrentLine.No,
      restorePositionIfNeverSatisfied = false,
    } = options ?? {}

    const save = restorePositionIfNeverSatisfied ? this.position.save() : undefined

    if (!includeCurrentCharacter && !this.skip(direction))
      return false

    const { position } = this,
          { document } = position.set

    let { textLine } = this,
        { line, column, offset } = position

    if (direction === Forward) {
      const lineCount = document.lineCount
      let validColumn = column

      for (;;) {
        const { text } = textLine

        while (column < text.length) {
          if (!condition(text.charCodeAt(column), offset, line, column)) {
            if (select === Cursor.Select.Next) {
              this.position.updateFast(offset, line, column)
            } else {
              this.position.updateFast(offset - 1, validColumn === 0 ? line - 1 : line, validColumn)

              if (select === Cursor.Select.Previous) {
                this.position.moveLeftOrGoUp()
              }

              this.textLine = this.position.textLine()
            }

            return true
          }

          validColumn = column++
          offset++
        }

        if (limitToCurrentLine === LimitToCurrentLine.Accept) {
          this.position.updateFast(offset, line, column)

          return true
        }
        if (limitToCurrentLine === LimitToCurrentLine.AcceptNext) {
          this.position.toFirstCharacter(line + 1)
          this.textLine = this.position.textLine()

          return true
        }

        if (line === lineCount - 1 || limitToCurrentLine === LimitToCurrentLine.Cancel)
          break

        textLine = this.textLine = document.lineAt(++line)
        offset++
        column = 0
      }
    } else {
      for (;;) {
        const { text } = textLine

        while (column >= 0) {
          if (!condition(text.charCodeAt(column), offset, line, column)) {
            this.position.updateFast(offset, line, column)

            if (select !== Cursor.Select.Next) {
              this.position.moveRightOrGoDown()

              if (select === Cursor.Select.Previous) {
                this.position.moveRightOrGoDown()
              }

              this.textLine = this.position.textLine()
            }

            return true
          }

          column--
          offset--
        }

        if (limitToCurrentLine === LimitToCurrentLine.Accept) {
          this.position.updateFast(offset + 1, line, 0)

          return true
        }
        if (limitToCurrentLine === LimitToCurrentLine.AcceptNext) {
          this.position.toLineBreak(line - 1)
          this.textLine = this.position.textLine()

          return true
        }

        if (line === 0 || limitToCurrentLine === LimitToCurrentLine.Cancel)
          break

        textLine = this.textLine = document.lineAt(--line)
        column = textLine.text.length - 1
        offset--
      }
    }

    if (save !== undefined)
      this.position.restore(save)
    else
      this.position.updateFast(offset, line, column)

    return false
  }

  /**
   * Updates the text buffer after updating its underlying position.
   */
  notifyPositionUpdated() {
    const newLineNumber = this.position.line

    if (this.textLine.lineNumber !== newLineNumber)
      this.textLine = this.position.textLine()
  }
}

/**
 * A class used to operate on text surrounding a position based on the offset from
 * that position.
 */
export class OffsetCursor {
  private lineOffset: number
  private lineEnd: number
  private textLine: vscode.TextLine

  /**
   * Creates a new `OffsetCursor` that operates from the given origin.
   */
  constructor(readonly origin: Position) {
    this.textLine = origin.set.document.lineAt(origin.line)
    this.lineOffset = -origin.column
    this.lineEnd = this.textLine.text.length + 1 - origin.column
  }

  /**
   * Returns the character at the given offset with respect to the originally
   * provided origin.
   *
   * If outside of the document, `0` will be returned.
   *
   * This method is optimized to work well for recurring calls on incrementing indices.
   *
   * Note that line endings (`\n`, no matter the platform) are automatically inserted.
   */
  char(offset: number) {
    const doc = this.origin.document

    if (offset < this.lineOffset) {
      // Character is before current line.
      let line = this.textLine.lineNumber

      while (offset < this.lineOffset) {
        if (line === 0)
          return 0

        this.textLine = doc.lineAt(--line)
        this.lineOffset -= this.textLine.text.length + 1
        this.lineEnd = this.lineOffset + this.textLine.text.length + 1
      }
    } else if (offset >= this.lineEnd) {
      // Character is after current line.
      let line = this.textLine.lineNumber
      const lastLine = doc.lineCount - 1

      while (offset >= this.lineEnd) {
        if (line === lastLine)
          return 0

        this.lineOffset += this.textLine.text.length + 1
        this.textLine = doc.lineAt(++line)
        this.lineEnd = this.lineOffset + this.textLine.text.length + 1
      }
    }

    // Character is in the right range.
    const charCode = this.textLine.text.charCodeAt(offset - this.lineOffset)

    return isNaN(charCode) ? 10 : charCode
  }

  /**
   * Returns the character at the given offset with respect to the originally
   * provided origin.
   *
   * If outside of the line, `0` will be returned.
   */
  charInLine(offset: number) {
    if (offset < this.lineOffset || offset >= this.lineEnd)
      return 0

    const charCode = this.textLine.text.charCodeAt(offset - this.lineOffset)

    return isNaN(charCode) ? 10 : charCode
  }

  /**
   * Returns the position of the character at the given offset with respect to the originally
   * provided origin, or `undefined` if the given offset is out of range.
   */
  position(offset: number) {
    if (this.char(offset) === 0) // Update current line to make sure lineOffset corresponds to given offset.
      // Return if invalid offset.
      return undefined

    return new vscode.Position(this.textLine.lineNumber, offset - this.lineOffset)
  }

  /**
   * Returns the absolute offset of the character at the given offset with respect to the originally
   * provided origin.
   */
  offset(offset: number) {
    return this.origin.offset + offset
  }

  /**
   * Updates the originally provided origin to be at the given position. This will make all subsequent
   * operations start at the new origin.
   */
  commit(offset: number) {
    const position = this.position(offset)

    if (position === undefined)
      throw new RangeError('Offset out of range.')

    this.origin.updateFast(this.offset(offset), position.line, position.character)
  }
}

/**
 * The position of a character.
 *
 * Unlike the native `vscode.Position`, this position tracks a *character*,
 * rather than the position between two characters. Because of this, positions cannot be
 * trivially converted to `vscode.Position`, but can be easily manipulated to work with
 * Kakoune.
 */
export class Position {
  static readonly Cursor = Cursor
  static readonly OffsetCursor = OffsetCursor

  private _line: number
  private _column: number
  private _offset: number

  /** @private */
  constructor(
    readonly set: SelectionSet,

    line: number,
    column: number,
    offset: number,
  ) {
    this._line = line
    this._column = column
    this._offset = offset
  }

  static fromOffset(set: SelectionSet, offset: number) {
    const { line, character } = set.document.positionAt(offset)

    return new this(set, line, character, offset)
  }

  static fromCoord(set: SelectionSet, line: number, column: number) {
    return new this(set, line, column, set.document.offsetAt(new vscode.Position(line, column)))
  }

  static fromPosition(set: SelectionSet, position: vscode.Position) {
    return new this(set, position.line, position.character, set.document.offsetAt(position))
  }

  static fromFast(set: SelectionSet, offset: number, line: number, column: number) {
    return new this(set, line, column, offset)
  }

  /**
   * The line of the position, starting at 0.
   */
  get line() {
    return this._line
  }

  /**
   * The column of the position, starting at 0.
   */
  get column() {
    return this._column
  }

  /**
   * The offset of the position from the beginning of the file.
   */
  get offset() {
    return this._offset
  }

  /**
   * The offset of the beginning of the position's line.
   */
  get lineOffset() {
    return this._offset - this._column
  }

  /**
   * The document in which that selection is.
   */
  get document() {
    return this.set.document
  }

  /**
   * Returns whether this position is empty.
   */
  get isEmpty() {
    return this.set.endOffset === 0
  }

  /**
   * Returns whether this position is the position of the first character of the line.
   */
  isFirstCharacter() {
    return this.column === 0
  }

  /**
   * Returns whether this position is the position of the last character of the line.
   */
  isLastCharacter() {
    return this.column === this.lineText().length - 1
  }

  /**
   * Returns whether this position is the position of the line break at the end of the line.
   */
  isLineBreak() {
    return this.column === this.lineText().length
  }

  /**
   * Returns whether this position is on the first line.
   */
  isFirstLine() {
    return this.line === 0
  }

  /**
   * Returns whether this position is on the last line.
   */
  isLastLine() {
    return this.line === this.document.lineCount - 1
  }

  /**
   * Returns whether this position is on the very first character of the document.
   */
  isFirstDocumentCharacter() {
    return this.isFirstLine() && this.isFirstCharacter()
  }

  /**
   * Returns whether this position is on the very last character of the document.
   */
  isLastDocumentCharacter() {
    return this.isLastLine() && this.isLastCharacter()
  }

  /**
   * Returns the `vscode.TextLine` of the line of the character.
   */
  textLine() {
    try {
      return this.set.document.lineAt(this.line)
    } catch (e) {
      // Stub this out to avoid errors thrown during command prework.
      console.error(e.message)
      return this.set.document.lineAt(0)
    }
  }

  /**
   * Returns the text of the line of the character.
   */
  lineText() {
    return this.textLine().text
  }

  /**
   * Returns the character code of the character.
   */
  charCode(lineBreakCharCode = 10) {
    const text = this.lineText(),
          column = this._column

    if (text.length === column)
      return lineBreakCharCode

    return text.charCodeAt(column)
  }

  /**
   * Returns a copy of the position.
   */
  copy(set = this.set) {
    return new Position(set, this._line, this._column, this._offset)
  }

  /**
   * Returns whether the given position is equal to this position.
   */
  eq(position: Position) {
    return position._offset === this._offset
  }

  /**
   * Returns the coordinate-wise distance squared between this position and the given position.
   */
  distance(position: vscode.Position) {
    const x = Math.abs(this.column - position.character)
    const y = Math.abs(this.line - position.line)

    return x * x + y * y
  }

  /**
   * Swaps the position and offset of this `LivingPosition` with the given one.
   */
  swap(other: Position) {
    const { offset, line, column } = other

    this.inheritPosition(other)
    other.updateFast(offset, line, column)
  }

  /**
   * Updates the coordinates of the location, automatically updating their offset.
   */
  update(line: number, column: number, force = false) {
    if (line === this._line && column === this._column && !force)
      return

    const position = this.document.validatePosition(new vscode.Position(line, column)),
          offset = this.document.offsetAt(position)

    this._line = position.line
    this._column = position.character
    this._offset = offset
  }

  /**
   * Updates the offset of the position, automatically updating its line and column.
   */
  updateOffset(offset: number, force = false) {
    if (offset === this._offset && !force)
      return

    const validOffset = Math.min(Math.max(0, offset), this.set.endOffset),
          position = this.document.positionAt(validOffset)

    this._offset = validOffset
    this._line = position.line
    this._column = position.character
  }

  /**
   * Updates the `Position` to a new position, without implicit computation.
   */
  updateFast(offset: number, line: number, column: number) {
    this._offset = offset
    this._line = line
    this._column = column

    if (DEBUG) {
      assert(offset === this.document.offsetAt(new vscode.Position(line, column)))
    }
  }

  /**
   * Updates the coordinates and offset of the position to point at the character right
   * after the given `vscode.Position`.
   */
  updateFromPosition(position: vscode.Position, force = false) {
    this.update(position.line, position.character, force)
  }

  /**
   * Inherits the offset and coordinates from another `Position`.
   */
  inheritPosition(position: Position) {
    this._offset = position._offset
    this._line = position._line
    this._column = position._column
  }

  /**
   * Updates the position to be at the start of the line.
   */
  toFirstCharacter(line = this._line) {
    if (line === this._line)
      this.updateFast(this._line - this._column, this._line, 0)
    else
      this.update(line, 0)
  }

  /**
   * Updates the position to be at the first non-whitespace character of the line.
   */
  toFirstNonWhitespaceCharacter(line = this._line) {
    if (line === this._line) {
      const newCharacter = this.textLine().firstNonWhitespaceCharacterIndex

      this.updateFast(this._offset - this._column + newCharacter, this._line, newCharacter)
    } else {
      const textLine = this.document.lineAt(line),
            startIndex = textLine.firstNonWhitespaceCharacterIndex,
            offset = this.document.offsetAt(new vscode.Position(line, 0))

      this.updateFast(offset + startIndex, line, startIndex)
    }
  }

  /**
   * Updates the position to be after the last character of the line, excluding the line break.
   */
  toEndCharacter(line = this._line) {
    if (line === this._line) {
      const end = Math.max(0, this.lineText().length - 1)

      this.updateFast(this._offset - this._column + end, this._line, end)
    } else {
      const end = Math.max(0, this.document.lineAt(line).text.length - 1)

      this.update(line, end)
    }
  }

  /**
   * Updates the position to be after the last character of the line.
   */
  toLineBreak(line = this._line) {
    if (line === this._line) {
      if (this.isLastLine()) {
        this.toEndCharacter()

        return false
      }

      const end = this.lineText().length

      this.updateFast(this._offset - this._column + end, this._line, end)
    } else {
      if (line >= this.document.lineCount) {
        this.toEndCharacter(line)

        return false
      }

      const end = this.document.lineAt(line).text.length,
            offset = this.document.offsetAt(new vscode.Position(line, 0))

      this.updateFast(offset + end, line, end)
    }

    return true
  }

  /**
   * Updates the position to be at then end of previous line.
   */
  toPreviousLineBreak() {
    if (this.isFirstLine()) {
      this.toFirstCharacter()

      return false
    }

    this.updateOffset(this.lineOffset - 1)

    return true
  }

  /**
   * Updates the position to be at the start of the next line.
   */
  toNextLineFirstCharacter() {
    if (this.isLastLine()) {
      this.toEndCharacter()

      return false
    }

    this.update(this._line + 1, 0)

    return true
  }

  /**
   * Updates the position to be at the start of the document.
   */
  toDocumentFirstCharacter() {
    this.updateFast(0, 0, 0)
  }

  /**
   * Updates the position to be at the end of the document.
   */
  toDocumentLastCharacter() {
    const set = this.set

    this.updateFast(set.endOffset, set.end.line, set.end.character)
  }

  /**
   * Move left, stopping if the position reaches the start of the line.
   */
  moveLeftOrStop(offset = 1) {
    const { column, line } = this

    if (column < offset)
      this.updateFast(this.offset - column, line, 0)
    else
      this.updateFast(this.offset - offset, line, column - offset)
  }

  /**
   * Move left, going up if the position reaches the start of the line.
   */
  moveLeftOrGoUp(offset = 1) {
    this.updateOffset(this.offset - offset)
  }

  /**
   * Move right, stopping if the position reaches the end of the line.
   */
  moveRightOrStop(offset = 1) {
    const lineLength = this.lineText().length,
          requestedCharacter = this.column + offset

    if (lineLength >= requestedCharacter)
      this.updateFast(this.offset + offset, this.line, requestedCharacter)
    else
      this.updateFast(this.offset + lineLength - this.column, this.line, lineLength)
  }

  /**
   * Move right, going down if the position reaches the end of the line.
   */
  moveRightOrGoDown(offset = 1) {
    const lineLength = this.lineText().length,
          requestedCharacter = this.column + offset

    if (lineLength >= requestedCharacter)
      this.updateFast(this.offset + offset, this.line, requestedCharacter)
    else
      this.updateOffset(this.offset + offset)
  }

  /**
   * Moves the position in the given direction, stopping if the character goes out of the line.
   */
  moveOrStop(offset: number, direction: Direction) {
    if (direction === Backward) {
      this.moveLeftOrStop(offset)
    } else {
      this.moveRightOrStop(offset)
    }
  }

  /**
   * Moves the position in the given direction, continuing if the character goes out of the line.
   */
  moveOrContinue(offset: number, direction: Direction) {
    if (direction === Backward) {
      this.moveLeftOrGoUp(offset)
    } else {
      this.moveRightOrGoDown(offset)
    }
  }

  /**
   * Returns the `vscode.Position` right before the character.
   */
  beforePosition() {
    return new vscode.Position(this._line, this._column)
  }

  /**
   * Returns the `vscode.Position` right after the character, or `undefined` if after the end of the document.
   */
  afterPosition(): vscode.Position | undefined

  /**
   * Returns the `vscode.Position` right after the character, or `afterDocumentEnd` if after the end of the document.
   */
  afterPosition<T>(afterDocumentEnd: T): vscode.Position | T

  afterPosition(afterDocumentEnd?: any) {
    if (!this.isLineBreak())
      return new vscode.Position(this._line, this._column + 1)
    if (!this.isLastLine())
      return new vscode.Position(this._line + 1, 0)

    return afterDocumentEnd
  }

  /**
   * Returns the `vscode.Position`s before and after the character.
   */
  beforeAndAfterPositions(): [vscode.Position, vscode.Position | undefined] {
    return [this.beforePosition(), this.afterPosition()]
  }

  /**
   * Returns the `Cursor` starting at this position.
   */
  cursor() {
    return new Cursor(this)
  }

  /**
   * Returns the `OffsetCursor` with this position as the origin.
   */
  offsetCursor() {
    return new OffsetCursor(this)
  }

  /**
   * Saves the state of the position into a variable so that it can be
   * easily restored later.
   */
  save(): Position.Save {
    return { offset: this._offset, line: this._line, column: this._column }
  }

  /**
   * Restores the position from a restore point it previously created.
   */
  restore(save: Position.Save) {
    this._offset = save.offset
    this._line = save.line
    this._column = save.column
  }
}

/**
 * An empty position similar to a `vscode.Position`, in that it represents
 * the position between two characters, rather than a character itself.
 */
export class EmptyPosition extends Position {
  get isEmpty() {
    return true
  }

  afterPosition() {
    return this.beforePosition()
  }
}

type Cursor_ = Cursor
type OffsetCursor_ = OffsetCursor

export namespace Position {
  export interface Save {
    readonly offset: number
    readonly line: number
    readonly column: number
  }

  export type Cursor = Cursor_
  export type OffsetCursor = OffsetCursor_
}


/**
 * Flags for specifying the behavior of `Selection.collapseToActive`.
 */
export const enum CollapseFlags {
  /**
   * Collapse to the active position.
   */
  Include = 1,

  /**
   * Collapse to the character before or after the active position, depending
   * on the current position.
   */
  Exclude = 2,
}

/**
 * A selection.
 */
export class Selection {
  private constructor(
    readonly set: SelectionSet,

    readonly anchor: Position,
    readonly active: Position,
  ) {}

  /**
   * Returns whether the selection can be non-directional (i.e. empty selections are disallowed).
   */
  get canBeNonDirectional() {
    return this.set.enforceNonEmptySelections
  }

  /**
   * Returns whether the selection can be empty (in which case it cannot be non-directional).
   */
  get canBeEmpty() {
    return !this.set.enforceNonEmptySelections
  }

  get start() {
    return this.anchor.offset > this.active.offset ? this.active : this.anchor
  }

  get end() {
    return this.anchor.offset > this.active.offset ? this.anchor : this.active
  }

  get length() {
    return this.end.offset - this.start.offset
  }

  set length(value: number) {
    this.end.updateOffset(this.start.offset + value)
  }

  get direction() {
    return this.isReversed ? Direction.Backward : Direction.Forward
  }

  set direction(value: Direction) {
    if (value === this.direction)
      return

    this.anchor.swap(this.active)
  }

  get document() {
    return this.set.document
  }

  /** Returns whether the selection is a single character selection. */
  get isSingleCharacter() {
    return Math.abs(this.start.offset - this.end.offset) === 1
  }

  /** Returns whether the selection is an empty or single character selection. */
  get isEmptyOrSingleCharacter() {
    return Math.abs(this.start.offset - this.end.offset) <= 1
  }

  /**
   * Returns whether the selection is empty (`active` === `anchor`).
   */
  get isEmpty() {
    return (this.canBeEmpty && this.active.offset === this.anchor.offset)
        || (this.document.lineCount === 1 && this.document.lineAt(0).text.length === 0)
  }

  /**
   * Returns whether the selection is directional (see `isNonDirectional`).
   */
  get isDirectional() {
    return !this.isSingleCharacter || !this.set.enforceNonEmptySelections
  }

  /**
   * Returns whether the selection is non-directional, that is, it is a single-character
   * selection and empty selections are forbidden.
   */
  get isNonDirectional() {
    return this.isSingleCharacter && this.set.enforceNonEmptySelections
  }

  /**
   * Whether the selection is reversed, which also means the following:
   * - The anchor is after the active position.
   * - `start === active` and `end === anchor`.
   */
  get isReversed() {
    return this.anchor.offset > this.active.offset
  }

  set isReversed(value: boolean) {
    if (value === this.isReversed)
      return

    this.anchor.swap(this.active)
  }

  /**
   * Returns whether the selection fits in a single line.
   */
  get isSingleLine() {
    return this.anchor.line === this.active.line
  }

  /** Alias for `isReversed`. */
  get anchorAfterActive() {
    return this.isReversed
  }

  set anchorAfterActive(value: boolean) {
    this.isReversed = value
  }

  get startLine() {
    return this.start.line
  }

  get endLine() {
    return this.end.line
  }

  get activeLine() {
    return this.active.line
  }

  get anchorLine() {
    return this.anchor.line
  }

  copy(set = this.set) {
    return new Selection(set, this.anchor.copy(set), this.active.copy(set))
  }

  /** Move left, stopping if the position reaches the start of the line. */
  moveLeftOrStop(offset = 1) {
    this.anchor.inheritPosition(this.active)
    this.active.moveLeftOrStop(offset)
  }

  /** Extend left, stopping if the position reaches the start of the line. */
  extendLeftOrStop(offset = 1) {
    this.active.moveLeftOrStop(offset)
  }

  /** Move left, going up if the position reaches the start of the line. */
  moveLeftOrGoUp(offset = 1) {
    this.anchor.inheritPosition(this.active)
    this.active.moveLeftOrGoUp(offset)
  }

  /** Extend left, going up if the position reaches the start of the line. */
  extendLeftOrGoUp(offset = 1) {
    this.active.moveLeftOrGoUp(offset)
  }

  /** Move right, stopping if the position reaches the end of the line. */
  moveRightOrStop(offset = 1) {
    this.anchor.inheritPosition(this.active)
    this.active.moveRightOrStop(offset)
  }

  /** Extend right, stopping if the position reaches the end of the line. */
  extendRightOrStop(offset = 1) {
    this.active.moveRightOrStop(offset)
  }

  /** Move right, going down if the position reaches the end of the line. */
  moveRightOrGoDown(offset = 1) {
    this.anchor.inheritPosition(this.active)
    this.active.moveRightOrGoDown(offset)
  }

  /** Extend right, going down if the position reaches the end of the line. */
  extendRightOrGoDown(offset = 1) {
    this.active.moveRightOrGoDown(offset)
  }

  /** Updates (moves or extends) the selection in the given direction, stopping if the character goes out of the line. */
  updateOrStop(offset: number, extend: ExtendBehavior, direction: Direction) {
    if (!extend)
      this.anchor.inheritPosition(this.active)

    if (direction === Backward) {
      this.active.moveLeftOrStop(offset)
    } else {
      this.active.moveRightOrStop(offset)
    }
  }

  /** Updates (moves or extends) the selection in the given direction, continuing if the character goes out of the line. */
  updateOrContinue(offset: number, extend: ExtendBehavior, direction: Direction) {
    if (!extend)
      this.anchor.inheritPosition(this.active)

    if (direction === Backward) {
      this.active.moveLeftOrGoUp(offset)
    } else {
      this.active.moveRightOrGoDown(offset)
    }
  }

  /** Reverses the selection, swapping the active and anchor positions. */
  reverse() {
    this.active.swap(this.anchor)
  }

  /**
   * Collapses the selection to the active position according to a given
   * behavior.
   */
  collapseToActive(flags = CollapseFlags.Include) {
    const direction = this.direction

    this.anchor.inheritPosition(this.active)

    if (flags === CollapseFlags.Exclude) {
      this.anchor.moveOrContinue(1, direction)
    }
  }

  getText() {
    return this.document.getText(this.asRange())
  }

  asRange() {
    if (this.isEmpty) {
      const start = this.start.beforePosition(),
            end = start

      return new vscode.Range(start, end)
    }

    const start = this.start.beforePosition(),
          end = this.end.afterPosition() ?? this.end.beforePosition()

    return new vscode.Range(start, end)
  }

  asSelection() {
    if (this.isEmpty) {
      // Empty selection? Then the document is empty, and we also return an empty selection.
      const anchor = this.anchor.beforePosition(),
            active = anchor

      return new vscode.Selection(anchor, active)
    }

    if (this.anchor.eq(this.active) && this.active.textLine().text.length === 0) {
      // Same character on same line, but line only has one character? Then we select
      // to the next line.
      const line = this.anchor.line,
            anchor = new vscode.Position(line, 0),
            active = new vscode.Position(line + 1, 0)

      return new vscode.Selection(anchor, active)
    }

    if (this.isSingleLine && this.anchor.column === this.active.column + 1) {
      const anchor = this.anchor.afterPosition() ?? this.anchor.beforePosition(),
            active = this.active.beforePosition()

      return new vscode.Selection(anchor, active)
    }

    if (this.isReversed) {
      const anchor = this.anchor.afterPosition() ?? this.anchor.beforePosition(),
            active = this.active.beforePosition()

      return new vscode.Selection(anchor, active)
    }

    const anchor = this.anchor.beforePosition(),
          active = this.active.afterPosition() ?? this.active.beforePosition()

    return new vscode.Selection(anchor, active)
  }

  eq(selection: Selection | vscode.Selection) {
    if (selection instanceof Selection)
      return this.anchor.eq(selection.anchor) && this.active.eq(selection.active)

    // For empty selections, equality is trivial.
    if (this.isEmpty)
      return selection.isEmpty && selection.start.line === 0 && selection.start.character === 0

    // We must adapt the selection for comparison.
    return this.asSelection().isEqual(selection)
  }

  /**
   * Returns the sum of the distances of the anchor and active positions of this selection and the given selection.
   */
  distance(selection: vscode.Selection) {
    return this.anchor.distance(selection.anchor) + this.active.distance(selection.active)
  }

  save(): Selection.Save {
    return { active: this.active.save(), anchor: this.anchor.save() }
  }

  restore(save: Selection.Save) {
    this.active.restore(save.active)
    this.anchor.restore(save.anchor)
  }

  static fromSelection(set: SelectionSet, selection: vscode.Selection) {
    return new Selection(set, Position.fromPosition(set, selection.anchor), Position.fromPosition(set, selection.active))
  }

  static fromFast(anchor: Position, active: Position) {
    return new Selection(anchor.set, anchor, active)
  }

  /**
   * Updates the selection from a `vscode.Selection`, normalizing it if needed.
   */
  updateFromSelection(selection: vscode.Selection) {
    let { anchor, active } = selection

    if (!this.canBeEmpty && !selection.isEmpty) {
      if (active === selection.end) {
        if (active.character > 0)
          // Active position is also the end position, so we must
          // reduce it by one character to normalize it.
          active = new vscode.Position(active.line, active.character - 1)
      } else {
        if (anchor.character > 0)
          // Anchor position is also the end position, so we must
          // reduce it by one character to normalize it.
          anchor = new vscode.Position(anchor.line, anchor.character - 1)
      }
    }

    this.anchor.updateFromPosition(anchor, true)
    this.active.updateFromPosition(active, true)
  }

  /**
   * Updates the selection do reflect a change in its document.
   */
  updateAfterDocumentChanged(e: vscode.TextDocumentContentChangeEvent) {
    if (e.rangeOffset > this.end.offset)
      return

    const diff = e.text.length - e.rangeLength
    const { start, end } = this

    if (e.rangeOffset <= start.offset) {
      start.updateOffset(start.offset + diff, true)
    }

    end.updateOffset(end.offset + diff, true)
  }
}

export namespace Selection {
  export interface Save {
    readonly active: Position.Save
    readonly anchor: Position.Save
  }
}


/**
 * The behavior to take when seeking with `Selection.updateEachPosition`.
 */
export const enum Anchor {
  /**
   * Extend the anchor (the anchor will not move).
   */
  Extend,

  /**
   * Select starting at the active position (included).
   */
  IncludeActive,

  /**
   * Select starting at the active position (excluded).
   */
  ExcludeActive,

  /**
   * Inherit active position after selecting.
   */
  InheritActive,
}

/**
 * A set of all the `Selection`s in a text editor.
 *
 * There might be multiple `Selection`s for a single document, e.g. to save selections.
 * Changes made on a `SelectionSet`'s `Selection`s are not immediately applied. Call
 * `commit` to apply them all at once.
 */
export class SelectionSet {
  private readonly _copies = [] as SelectionSet.Copy[]

  private _end: vscode.Position
  private _endOffset: number

  private _committing = false

  readonly selections = [] as Selection[]

  protected constructor(
    readonly extension: Extension,
    readonly document: vscode.TextDocument,
    private _id: any,
  ) {
    this._end = document.lineAt(document.lineCount - 1).range.end
    this._endOffset = document.offsetAt(this._end)
  }

  static from(extension: Extension, editor: vscode.TextEditor) {
    const set = new SelectionSet(extension, editor.document, (editor as any).id)
    const selections = editor.selections.map(x => Selection.fromSelection(set, x))

    editor.selections = selections.map(selection => selection.asSelection())
    set.selections.push(...selections)

    return set
  }

  /** The start position of the document. */
  get start() {
    return new vscode.Position(0, 0)
  }

  /** The end position of the document. */
  get end() {
    return this._end
  }

  /** The offset of the end position of the document. */
  get endOffset() {
    return this._endOffset
  }

  /** Whether empty-selections should be transformed into single-character, non-directional selections. */
  get enforceNonEmptySelections() {
    return !this.extension.allowEmptySelections
  }

  /**
   * Commits all changes to the given editor.
   */
  commit(editor: vscode.TextEditor, insert?: 'before' | 'after') {
    this._committing = true

    if (insert === undefined)
      editor.selections = this.selections.map(selection => selection.asSelection())
    else if (insert === 'before')
      editor.selections = this.selections.map(selection => {
        const position = selection.start.beforePosition()

        return new vscode.Selection(position, position)
      })
    else
      editor.selections = this.selections.map(selection => {
        const position = selection.end.afterPosition() ?? selection.end.beforePosition()

        return new vscode.Selection(position, position)
      })

    this._committing = false
  }

  /**
   * Returns whether or not the given editor is the one this `SelectionSet` was built for.
   */
  forEditor(editor: vscode.TextEditor) {
    return editor.document === this.document && (editor as any).id === this._id
  }

  /**
   * Reduces the selection set to its main selection.
   */
  reduceToMainSelection(editor: vscode.TextEditor) {
    this.selections.length = 1
    this.commit(editor)
  }

  updateAfterSelectionsChanged(e: vscode.TextEditorSelectionChangeEvent) {
    if (this._committing)
      // We made those changes, so we don't have to update anything.
      return

    // Typically, a user change (not triggered by Kakoune) is only
    // triggered when adding new selections, removing previous selections,
    // or changing multiple selections. Thinks like rotating selections shouldn't happen.
    const incomingSelections = e.selections.slice() as (vscode.Selection | undefined)[],
          currentSelections = this.selections.splice(0, this.selections.length),
          nextSelections = Array.from({ length: incomingSelections.length }, () => undefined as Selection | undefined)

    const incomingSelectionsLen = incomingSelections.length

    let currentSelectionsLen = currentSelections.length

    // First, find all equal selections and just recycle what we can.
    for (let i = 0; i < incomingSelectionsLen; i++) {
      const incomingSelection = incomingSelections[i]

      for (let j = 0; j < currentSelectionsLen; j++) {
        const currentSelection = currentSelections[j]

        if (incomingSelection !== undefined && currentSelection.eq(incomingSelection)) {
          incomingSelections[i] = undefined
          nextSelections[i] = currentSelection

          currentSelections.splice(j, 1)
          currentSelectionsLen--

          break
        }
      }
    }

    // Finally, assign closest selections together and fill in the blanks,
    // starting at the end*.
    //
    // *: In the case where new selections have been added, they will be added
    // at the beginning of the selections array. Therefore they will be processed
    // last, and will be assigned a new LivingSelection.
    for (let i = incomingSelectionsLen - 1; i >= 0; i--) {
      const incomingSelection = incomingSelections[i]

      if (incomingSelection === undefined) {
        continue
      } else if (currentSelectionsLen > 0) {
        let shortestDistance = currentSelections[0].distance(incomingSelection),
            shortestDistanceIdx = 0

        for (let j = 1; j < currentSelectionsLen; j++) {
          const distance = currentSelections[j].distance(incomingSelection)

          if (distance < shortestDistance) {
            shortestDistanceIdx = j
            shortestDistance = distance
          }
        }

        const nextSelection = currentSelections.splice(shortestDistanceIdx, 1)[0]

        nextSelection.updateFromSelection(incomingSelection)
        nextSelections[i] = nextSelection

        currentSelectionsLen--
      } else {
        nextSelections[i] = Selection.fromSelection(this, incomingSelection)
      }
    }

    this.selections.push(...nextSelections as Selection[])

    // Selections may need to be normalized, so we re-set them.
    if (this.extension.getMode() === Mode.Normal && remainingNormalCommands === 0) {
      let nativeSelections: vscode.Selection[] | undefined

      for (let i = 0; i < nextSelections.length; i++) {
        const nativeSelection = nextSelections[i]!.asSelection()

        if (nativeSelection.isEqual(e.selections[i])) {
          if (nativeSelections === undefined)
            continue
        } else {
          if (nativeSelections === undefined)
            nativeSelections = e.selections.slice(0, i)
        }

        nativeSelections.push(nativeSelection)
      }

      if (nativeSelections !== undefined) {
        this._committing = true
        e.textEditor.selections = nativeSelections
        this._committing = false
      }
    }
  }

  /**
   * Notifies that the corresponding document changed, updating positions and
   * offsets.
   */
  updateAfterDocumentChanged(e: vscode.TextDocumentChangeEvent) {
    this._end = e.document.lineAt(e.document.lineCount - 1).range.end
    this._endOffset = e.document.offsetAt(this._end)

    const changes = e.contentChanges,
          changesLen = changes.length,
          selections = this.selections,
          selectionsLen = selections.length

    for (let i = 0; i < selectionsLen; i++) {
      const selection = selections[i]

      for (let j = 0; j < changesLen; j++) {
        selection.updateAfterDocumentChanged(changes[j])
      }
    }

    const copies = this._copies,
          copiesLen = copies.length

    for (let i = 0; i < copiesLen; i++) {
      copies[i].updateAfterDocumentChanged(e)
    }
  }

  /**
   * Performs an update on each selection using the provided function.
   */
  updateEach(f: (selection: Selection, i: number) => void) {
    const selections = this.selections,
          len = selections.length

    for (let i = 0; i < len; i++) {
      f(selections[i], i)
    }
  }

  /**
   * Updates each active position, updating the anchor using the given behavior.
   *
   * If `f` returns `false`, the operation will not be performed.
   */
  updateEachPosition(anchor: Anchor, f: (position: Position, i: number) => boolean | void) {
    const selections = this.selections,
          len = selections.length

    for (let i = 0; i < len; i++) {
      const selection = selections[i],
            active = selection.active,
            activeSave = active.save()

      const cancel = f(active, i)

      if (cancel === false)
        continue

      switch (anchor) {
        case Anchor.ExcludeActive:
          selection.anchor.restore(activeSave)
          selection.anchor.moveOrContinue(1, -selection.direction)
          break

        case Anchor.IncludeActive:
          selection.anchor.restore(activeSave)
          break

        case Anchor.InheritActive:
          selection.anchor.inheritPosition(active)
          break

        case Anchor.Extend:
          break
      }
    }
  }

  /**
   * Performs an update on all selections using the provided function.
   */
  updateAll(f: (selections: Selection[]) => void) {
    f(this.selections)
  }

  /**
   * Rebuilds the selections from a new empty array.
   */
  updateWithBuilder(f: (builder: Selection[], selection: Selection, index: number) => void) {
    const selections = this.selections,
          len = selections.length,
          newSelections = [] as Selection[]

    for (let i = 0; i < len; i++) {
      f(newSelections, selections[i], i)
    }

    if (newSelections.length > 0) {
      this.selections.splice(0, len, ...newSelections)
    }
  }

  /**
   * Asynchronously performs an update on all selections using the provided function.
   */
  updateEachAsync(f: (selection: Selection, i: number) => Promise<void>) {
    const selections = this.selections,
          len = selections.length,
          promises = [] as Promise<any>[]

    for (let i = 0; i < len; i++) {
      const promise = f(selections[i], i)

      if (typeof promise.then === 'function') {
        promises.push(promise)
      }
    }

    return Promise.all(promises)
  }

  /**
   * Shortcut for `this.selections.map` which does not perform unnecessary allocations.
   */
  map<T>(f: (selection: Selection, idx: number, selections: readonly Selection[]) => T) {
    const selections = this.selections,
          len = selections.length,
          result = [] as T[]

    for (let i = 0; i < len; i++) {
      result.push(f(selections[i], i, selections))
    }

    return result
  }

  /**
   * Restores the selections from the given copy.
   */
  restore(copy: SelectionSet.Copy) {
    this.selections.splice(0, this.selections.length, ...copy.selections.map(selection => selection.copy(this)))
  }

  /**
   * Returns a copy of the selection set which will be updated when its backing editor changes,
   * but which is not considered the main selection set for its editor.
   */
  copy() {
    class SelectionSetCopy extends SelectionSet {
      constructor(
        /** The original `SelectionSet` from which this copy is made. */
        readonly original: SelectionSet,
      ) {
        super(original.extension, original.document, original._id)

        this.selections.push(...original.selections.map(x => x.copy(this)))
      }

      /**
       * Forgets about this copy, stopping it from being tracked.
       */
      forget() {
        const copies = this.original._copies,
              index = copies.indexOf(this)

        if (index !== -1)
          copies.splice(index, 1)
      }
    }

    return new SelectionSetCopy(this)
  }
}

export namespace SelectionSet {
  /**
   * A copy of a `SelectionSet`, returned by `copy`.
   *
   * It is not considered as an editor's current selection, but is still tracked and updated.
   */
  export type Copy = ReturnType<SelectionSet['copy']>
}
