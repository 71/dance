import * as vscode from 'vscode'

import { Extension } from '../extension'
import { EIDRM } from 'constants'

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

  get character() {
    return this.textLine.text.charCodeAt(this.position.character)
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
          { line, character } = position

    if (direction === Forward) {
      if (character === this.textLine.range.end.character) {
        if (line === position.set.document.lineCount - 1) {
          return false
        }

        this.textLine = position.set.document.lineAt(line + 1)
        position.updateForNewPositionFast(offset, this.textLine.range.start)
      } else {
        position.updateForNewPositionFast(offset, new vscode.Position(line, character + 1))
      }
    } else {
      if (character === 0) {
        if (line === 0) {
          return false
        }

        this.textLine = position.set.document.lineAt(line - 1)
        position.updateForNewPositionFast(offset, this.textLine.range.end)
      } else {
        position.updateForNewPositionFast(offset, new vscode.Position(line, character - 1))
      }
    }

    return true
  }

  /**
   * Skips characters in the given direction until the given condition is false. If the condition is always
   * met until either the start or the end of the document, `false` is returned.
   */
  skipWhile(direction: Direction, condition: (charCode: number, offset: number, line: number, char: number) => boolean, includeCurrentCharacter = true, limitToCurrentLine = LimitToCurrentLine.No) {
    if (!includeCurrentCharacter && !this.skip(direction))
      return false

    const { position } = this,
          { document } = position.set

    let { textLine } = this,
        { line, character, offset } = position

    if (direction === Forward) {
      const lineCount = document.lineCount

      for (;;) {
        const { text } = textLine

        while (character < text.length) {
          if (!condition(text.charCodeAt(character), offset, line, character)) {
            this.position.updateForNewPositionFast(offset, new vscode.Position(line, character))

            return true
          }

          character++
          offset++
        }

        if (limitToCurrentLine === LimitToCurrentLine.Accept) {
          this.position.updateForNewPositionFast(offset - 1, new vscode.Position(line, character - 1))

          return true
        }

        if (line === lineCount - 1 || limitToCurrentLine === LimitToCurrentLine.Cancel)
          break

        textLine = this.textLine = document.lineAt(++line)
        offset++
        character = 0
      }
    } else {
      for (;;) {
        const { text } = textLine

        while (character >= 0) {
          if (!condition(text.charCodeAt(character), offset, line, character)) {
            this.position.updateForNewPositionFast(offset, new vscode.Position(line, character))

            return true
          }

          character--
          offset--
        }

        if (limitToCurrentLine === LimitToCurrentLine.Accept) {
          this.position.updateForNewPositionFast(offset + 1, new vscode.Position(line, character + 1))

          return true
        }

        if (line === 0 || limitToCurrentLine === LimitToCurrentLine.Cancel)
          break

        textLine = this.textLine = document.lineAt(--line)
        character = textLine.text.length - 1
        offset--
      }
    }

    this.position.updateForNewPositionFast(offset, new vscode.Position(line, character))

    return false
  }

  /**
   * Skips characters in the given direction until the given condition is met. If the condition
   * is never met, `false` is returned and the position is restored.
   */
  skipUntil(direction: Direction, condition: (charCode: number, offset: number, line: number, char: number) => boolean, includeCurrentCharacter = true, limitToCurrentLine = LimitToCurrentLine.No) {
    const offset = this.position.offset,
          position = this.position.asPosition()

    if (!this.skipWhile(direction, (ch, offset, line, char) => !condition(ch, offset, line, char), includeCurrentCharacter, limitToCurrentLine)) {
      this.position.updateForNewPositionFast(offset, position)

      return false
    }

    return true
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
    this.lineOffset = -origin.character
    this.lineEnd = this.textLine.text.length + 1 - origin.character
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
    const doc = this.origin.set.document

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

    return isNaN(charCode) ? 27 : charCode
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

    return isNaN(charCode) ? 27 : charCode
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

    this.origin.updateForNewPositionFast(this.offset(offset), position)
  }
}

/**
 * A wrapper around a VS Code position that is tracked and optimized for Kakoune-like operations.
 */
export class Position {
  static readonly Cursor = Cursor
  static readonly OffsetCursor = OffsetCursor

  private _position: vscode.Position
  private _offset: number

  private constructor(
    readonly set: SelectionSet,
    position: vscode.Position,
    offset: number,
  ) {
    this._position = position
    this._offset = offset
  }

  static from(set: SelectionSet, position: vscode.Position | number) {
    if (typeof position === 'number')
      return new Position(set, set.document.positionAt(position), position)
    else
      return new Position(set, position, set.document.offsetAt(position))
  }

  static fromFast(set: SelectionSet, offset: number, position: vscode.Position) {
    return new Position(set, position, offset)
  }

  get line() {
    return this._position.line
  }

  get character() {
    return this._position.character
  }

  get offset() {
    return this._offset
  }

  get lineOffset() {
    return this._offset - this._position.character
  }

  isLineStart() {
    return this.character === 0
  }

  isLineEnd() {
    return this.character === this.lineText().length
  }

  isLineBreak(otherPositionInSelection: Position) {
    return this.character === 0 && otherPositionInSelection.offset < this.offset
  }

  isFirstLine() {
    return this.line === 0
  }

  isLastLine() {
    return this.line === this.set.document.lineCount - 1
  }

  textLine() {
    return this.set.document.lineAt(this.line)
  }

  lineText() {
    return this.textLine().text
  }

  lineEndOffset() {
    return this.offset + this.textLine().range.end.character - this._position.character
  }

  asPosition() {
    return this._position
  }

  copy(set: SelectionSet) {
    return new Position(set, this._position, this._offset)
  }

  eq(position: vscode.Position | Position) {
    return position.line === this.line && position.character === this.character
  }

  /**
   * Returns the disance between this position and the given position.
   *
   * Note: for performance reasons, `Math.sqrt` is not called on the result.
   */
  distance(position: vscode.Position) {
    const x = Math.abs(this.character - position.character)
    const y = Math.abs(this.line - position.line)

    return x * x + y * y
  }

  /**
   * Swaps the position and offset of this `LivingPosition` with the given one.
   */
  swap(other: Position) {
    const offset = this._offset,
          position = this._position

    this.updateForNewPositionFast(other._offset, other._position)
    other.updateForNewPositionFast(offset, position)
  }

  /**
   * Updates the `LivingPosition` to a new position.
   *
   * If the offset can be inferred from the position (or the position from the offset) in
   * the context of the caller, `updateForNewPositionFast` should be used instead.
   */
  updateForNewPosition(position: vscode.Position | number) {
    if (typeof position === 'number') {
      this._offset = position
      this._position = this.set.document.positionAt(position)
    } else {
      this._offset = this.set.document.offsetAt(position)
      this._position = this.set.document.positionAt(this._offset)
    }
  }

  /**
   * Updates the `LivingPosition` to a new position, without implicit computation.
   *
   * This function should be used instead of `updateForNewPosition` when the computation
   * of the offset can be easily performed from the position (or vice-versa) in the
   * context of the caller, in order to avoid possibly expensive computations performed
   * in `updateForNewPosition`.
   */
  updateForNewPositionFast(offset: number, position: vscode.Position) {
    this._offset = offset
    this._position = position

    if (true) {
      const document = this.set.document,
            offsetFromGivenPosition = document.offsetAt(position),
            positionFromGivenOffset = document.positionAt(offset)

      console.assert(offsetFromGivenPosition === offset,
                     `Computation of offset was invalid.`, {
                       offset,
                       position: `${position.line}:${position.character}`,
                       offsetFromGivenPosition,
                       positionFromGivenOffset: `${positionFromGivenOffset.line}:${positionFromGivenOffset.character}`,
                     })

      this._offset = offsetFromGivenPosition
    }
  }

  /**
   * Inherits the offset and position from another `LivingPosition`.
   */
  inheritPosition(position: Position) {
    this._offset = position._offset
    this._position = position._position
  }

  /**
   * Updates the position to be at the start of the line.
   */
  toLineStart() {
    const pos = this._position

    this.updateForNewPositionFast(this.lineOffset, new vscode.Position(pos.line, 0))
  }

  /**
   * Updates the position to be at the first non-whitespace character of the line.
   */
  toLineFirstNonWhitespaceCharacter() {
    const pos = this._position
    const newCharacter = this.textLine().firstNonWhitespaceCharacterIndex

    this.updateForNewPositionFast(this._offset - pos.character + newCharacter, new vscode.Position(pos.line, newCharacter))
  }

  /**
   * Updates the position to be after the last character of the line, excluding the line break.
   */
  toLineEnd() {
    const pos = this._position
    const end = this.textLine().range.end.character

    this.updateForNewPositionFast(this._offset + end - pos.character, new vscode.Position(pos.line, end))
  }

  /**
   * Updates the position to be after the last character of the line.
   */
  toLineEndIncludingLineBreak() {
    if (this.isLastLine())
      return this.toLineEnd()

    const pos = this._position
    const textLine = this.textLine()

    this.updateForNewPositionFast(this._offset + textLine.text.length - pos.character + 1, new vscode.Position(pos.line + 1, 0))
  }

  /**
   * Updates the position to be at then end of previous line.
   */
  toPreviousLineEnd() {
    this.updateForNewPosition(this._offset - this._position.character - 1)
  }

  /**
   * Updates the position to be at the start of the next line.
   */
  toNextLineStart() {
    this.updateForNewPosition(this._position.translate(1, 0))
  }

  /**
   * Updates the position to be at the start of the document.
   */
  toDocumentStart() {
    this.updateForNewPositionFast(0, new vscode.Position(0, 0))
  }

  /**
   * Updates the position to be at the end of the document.
   */
  toDocumentEnd() {
    const set = this.set

    this.updateForNewPositionFast(set.endOffset, set.end)
  }

  /** Move left, stopping if the position reaches the start of the line. */
  moveLeftOrStop(offset = 1) {
    const { character, line } = this

    if (character < offset)
      this.updateForNewPositionFast(this.offset - character, new vscode.Position(line, 0))
    else
      this.updateForNewPositionFast(this.offset - offset, new vscode.Position(line, character - offset))
  }

  /** Move left, going up if the position reaches the start of the line. */
  moveLeftOrGoUp(offset = 1) {
    if (this.offset > offset)
      this.updateForNewPosition(this.offset - offset)
    else
      this.updateForNewPositionFast(0, new vscode.Position(0, 0))
  }

  /** Move right, stopping if the position reaches the end of the line. */
  moveRightOrStop(offset = 1) {
    const lineLength = this.lineText().length,
          requestedCharacter = this.character + offset

    if (lineLength >= requestedCharacter)
      this.updateForNewPositionFast(this.offset + offset, new vscode.Position(this.line, requestedCharacter))
    else
      this.updateForNewPositionFast(this.offset + lineLength - this.character, new vscode.Position(this.line, lineLength))
  }

  /** Move right, going down if the position reaches the end of the line. */
  moveRightOrGoDown(offset = 1) {
    const lineLength = this.lineText().length,
          requestedCharacter = this.character + offset

    if (lineLength >= requestedCharacter)
      this.updateForNewPositionFast(this.offset + offset, new vscode.Position(this.line, requestedCharacter))
    else
      this.updateForNewPosition(this.offset + offset)
  }

  /** Moves the position in the given direction, stopping if the character goes out of the line. */
  moveOrStop(offset: number, direction: Direction) {
    if (direction === Backward) {
      this.moveLeftOrStop(offset)
    } else {
      this.moveRightOrStop(offset)
    }
  }

  /** Moves the position in the given direction, continuing if the character goes out of the line. */
  moveOrContinue(offset: number, direction: Direction) {
    if (direction === Backward) {
      this.moveLeftOrGoUp(offset)
    } else {
      this.moveRightOrGoDown(offset)
    }
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

  save(): Position.Save {
    return { offset: this._offset, position: this._position }
  }

  restore(save: Position.Save) {
    this._offset = save.offset
    this._position = save.position
  }
}

type Cursor_ = Cursor
type OffsetCursor_ = OffsetCursor

export namespace Position {
  export interface Save {
    readonly offset: number
    readonly position: vscode.Position
  }

  export type Cursor = Cursor_
  export type OffsetCursor = OffsetCursor_
}

/**
 * Flags for specifying the behavior of `Selection.collapseToActive`.
 */
export const enum CollapseFlags {
  /**
   * Do not move the active position.
   */
  DoNotMoveActive = 1,

  /**
   * Move the active position one character after the anchor.
   */
  MoveActiveAfter = 2,
}

/**
 * A wrapper around a VS Code selection that is tracked and optimized for Kakoune-like operations.
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

  get isActiveLineBreak() {
    return this.active.character === 0 && this.anchor.offset < this.active.offset
  }

  get isAnchorLineBreak() {
    return this.anchor.character === 0 && this.anchor.offset > this.active.offset
  }

  get start() {
    return this.anchor.offset > this.active.offset ? this.active : this.anchor
  }

  get end() {
    return this.anchor.offset > this.active.offset ? this.anchor : this.active
  }

  /** Returns the line of the `active` position, adjusting the result when a full line is selected. */
  get activeLine() {
    if (this.isActiveLineBreak)
      return this.active.line - 1
    else
      return this.active.line
  }

  /** Returns the line of the `anchor` position, adjusting the result when a full line is selected. */
  get anchorLine() {
    if (this.isAnchorLineBreak)
      return this.anchor.line - 1
    else
      return this.anchor.line
  }

  /** Returns the line of the `start` position. */
  get startLine() {
    return this.start.line
  }

  /** Returns the line of the `end` position, adjusting the result if the line break is selected. */
  get endLine() {
    const { character, line } = this.end.asPosition()

    if (character === 0 && line > 0 && !this.isEmpty)
      return line - 1
    else
      return line
  }

  activeTextLine() {
    return this.document.lineAt(this.activeLine)
  }

  anchorTextLine() {
    return this.document.lineAt(this.anchorLine)
  }

  startTextLine() {
    return this.document.lineAt(this.startLine)
  }

  endTextLine() {
    return this.document.lineAt(this.endLine)
  }

  activeLineOffset() {
    const { character, line } = this.active.asPosition()

    if (character === 0 && line > 0 && this.active.offset > this.anchor.offset && !this.canBeEmpty)
      return this.active.offset - this.document.lineAt(line - 1).text.length
    else
      return this.active.offset
  }

  get length() {
    return this.end.offset - this.start.offset
  }

  set length(value: number) {
    const length = this.start.offset + value

    if (this.length !== length)
      this.end.updateForNewPosition(length)
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

  /** Returns whether the selection is empty (`active` === `anchor`). */
  get isEmpty() {
    return this.active.offset === this.anchor.offset
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

  copy(set: SelectionSet) {
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
  collapseToActive(flags: CollapseFlags) {
    this.anchor.inheritPosition(this.active)

    if (this.canBeEmpty) {
      return
    }

    if (flags === CollapseFlags.DoNotMoveActive) {
      this.anchor.moveLeftOrGoUp()
    } else {
      this.active.moveRightOrGoDown()
    }
  }

  /**
   * Reduces the selection to the active position, adjusting the selection so
   * that it remains non-empty if the user prefers so.
   */
  reduceToActive_() {
    const { active, anchor } = this

    if (this.set.enforceNonEmptySelections) {
      const { line, character, offset } = active

      if (active.isLineStart()) {
        anchor.inheritPosition(active)
        active.updateForNewPositionFast(offset + 1, new vscode.Position(line, character + 1))
      } else {
        anchor.updateForNewPositionFast(offset - 1, new vscode.Position(line, character - 1))
      }
    } else {
      anchor.inheritPosition(active)
    }
  }

  /**
   * Prepares the selection for an extension in the given direction.
   *
   * If the selection is non-directional, the active and anchor positions will satisfy
   * these properties:
   * - When extending forward, the anchor will always be _before_ the active position.
   * - When extending backward, the anchor will always be _after_ the active position.
   */
  prepareExtensionTowards(direction: Direction) {
    if (this.isNonDirectional && this.anchor.offset === this.active.offset + direction) {
      this.reverse()
    }
  }

  /**
   * Prepares the selection for a selection in the given direction.
   *
   * If the selection is non-directional, the active and anchor positions will satisfy
   * these properties:
   * - When selecting forward, the anchor will always be _after_ the active position.
   * - When selecting backward, the anchor will always be _before_ the active position.
   */
  prepareSelectionTowards(direction: Direction) {
    if (this.isNonDirectional && this.anchor.offset === this.active.offset + direction) {
      this.reverse()
    }
  }

  getText() {
    return this.document.getText(this.asRange())
  }

  asRange() {
    return new vscode.Range(this.start.asPosition(), this.end.asPosition())
  }

  asSelection() {
    return new vscode.Selection(this.anchor.asPosition(), this.active.asPosition())
  }

  asChange(replaceBy: string): vscode.TextDocumentContentChangeEvent {
    return { range: this.asRange(), rangeLength: this.getText().length, rangeOffset: this.start.offset, text: replaceBy }
  }

  eq(selection: vscode.Selection | Selection) {
    return this.anchor.eq(selection.anchor) && this.active.eq(selection.active)
  }

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

  static from(set: SelectionSet, selection: vscode.Selection) {
    return new Selection(set, Position.from(set, selection.anchor), Position.from(set, selection.active))
  }

  static fromFast(anchor: Position, active: Position) {
    return new Selection(anchor.set, anchor, active)
  }

  updateAfterDocumentChanged(e: vscode.TextDocumentContentChangeEvent) {
    if (e.rangeOffset > this.end.offset)
      return

    const diff = e.text.length - e.rangeLength

    if (diff === 0)
      return

    const { start, end } = this

    if (e.rangeOffset < start.offset) {
      start.updateForNewPosition(start.offset + diff)
    }

    end.updateForNewPosition(end.offset + diff)
  }

  updateForNewSelection(selection: vscode.Selection) {
    this.anchor.updateForNewPosition(selection.anchor)
    this.active.updateForNewPosition(selection.active)
  }
}

export namespace Selection {
  export interface Save {
    readonly active: Position.Save
    readonly anchor: Position.Save
  }
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
  private _changingDocument = false

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

    set.selections.push(...editor.selections.map(x => Selection.from(set, x)))

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
    return true// !this.extension.allowEmptySelections
  }

  /**
   * Commits all changes to the given editor.
   */
  commit(editor: vscode.TextEditor) {
    this._committing = true
    editor.selections = this.selections.map(selection => selection.asSelection())
    this._committing = false
  }

  /**
   * Returns whether or not the given editor is the one this `SelectionSet` was built for.
   */
  forEditor(editor: vscode.TextEditor) {
    return editor.document === this.document && (editor as any).id === this._id
  }

  updateAfterSelectionsChanged(e: vscode.TextEditorSelectionChangeEvent) {
    if (this._committing || this._changingDocument)
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

        nextSelection.updateForNewSelection(incomingSelection)
        nextSelections[i] = nextSelection

        currentSelectionsLen--
      } else {
        nextSelections[i] = Selection.from(this, incomingSelection)
      }
    }

    this.selections.push(...nextSelections as Selection[])
  }

  /**
   * Notifies that the corresponding document changed, updating positions and
   * offsets.
   */
  updateAfterDocumentChanged(e: vscode.TextDocumentChangeEvent) {
    this._end = e.document.lineAt(e.document.lineCount - 1).range.end
    this._endOffset = e.document.offsetAt(this._end)

    if (!this._changingDocument) {
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
  updateEach(editor: vscode.TextEditor, f: (selection: Selection, i: number) => void) {
    const selections = this.selections,
          len = selections.length

    for (let i = 0; i < len; i++) {
      f(selections[i], i)
    }

    this.commit(editor)
  }

  /**
   * Performs an update on all selections using the provided function.
   */
  updateAll(editor: vscode.TextEditor, f: (selections: Selection[]) => void) {
    f(this.selections)

    this.commit(editor)
  }

  /**
   * Reduces the selection set to its main selection.
   */
  reduceToMainSelection(editor: vscode.TextEditor) {
    this.selections.length = 1
    this.commit(editor)
  }

  /**
   * Performs an update on all selections using the provided function, additionally passing a `TextEditorEdit`
   * to allow for modifications.
   */
  private async updateWithBuilder(editor: vscode.TextEditor, f: (selection: Selection, i: number) => vscode.TextDocumentContentChangeEvent[]) {
    this._changingDocument = true

    try {
      const didPerformEdit = await editor.edit(builder => {
        const selections = this.selections,
              len = selections.length

        for (let i = 0; i < len; i++) {
          const changes = f(selections[i], i)

          if (changes !== undefined) {
            const changesLen = changes.length

            for (let j = 0; j < changesLen; j++) {
              const change = changes[j]

              builder.replace(change.range, change.text)
            }
          }
        }
      })

      if (didPerformEdit) {
        const selections = this.selections,
              len = selections.length

        for (let i = 0; i < len; i++) {
          selections[i].updateForNewSelection(editor.selections[i])
        }
      }
    } finally {
      this._changingDocument = false
    }
  }

  /**
   * Asynchronously performs an update on all selections using the provided function.
   */
  updateAsync(editor: vscode.TextEditor, f: (selection: Selection, i: number) => Promise<void>) {
    const selections = this.selections,
          len = selections.length,
          promises = [] as Promise<any>[]

    for (let i = 0; i < len; i++) {
      const promise = f(selections[i], i)

      if (typeof promise.then === 'function') {
        promises.push(promise)
      }
    }

    return Promise.all(promises).then(() => this.commit(editor))
  }

  /**
   * Modifies the existing selections of the set, possibly removing existing or adding new selections.
   */
  modify(editor: vscode.TextEditor, f: (selection: Selection, idx: number, newSelections: Selection[]) => void) {
    const selections = this.selections,
          len = selections.length,
          newSelections = [] as Selection[]

    for (let i = 0; i < len; i++) {
      f(selections[i], i, newSelections)
    }

    if (newSelections.length > 0) {
      this.selections.splice(0, len, ...newSelections)
    }

    this.commit(editor)
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
