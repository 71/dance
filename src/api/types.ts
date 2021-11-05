/**
 * Direction of an operation.
 */
export const enum Direction {
  /**
   * Forward direction (`1`).
   */
  Forward = 1,

  /**
   * Backward direction (`-1`).
   */
  Backward = -1,
}

/**
 * Behavior of a shift.
 */
export const enum Shift {
  /**
   * Jump to the position.
   */
  Jump,

  /**
   * Select to the position.
   */
  Select,

  /**
   * Extend to the position.
   */
  Extend,
}

/**
 * Selection behavior of an operation.
 */
export const enum SelectionBehavior {
  /**
   * VS Code-like caret selections.
   */
  Caret = 1,
  /**
   * Kakoune-like character selections.
   */
  Character = 2,
}

export const Forward = Direction.Forward,
             Backward = Direction.Backward,
             Jump = Shift.Jump,
             Select = Shift.Select,
             Extend = Shift.Extend;
