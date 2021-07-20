import type { Argument } from ".";
import { Context, rotate } from "../api";

/**
 * Rotate selection indices and contents.
 */
declare module "./selections.rotate";

/**
 * Rotate selections clockwise.
 *
 * @keys `(` (normal)
 *
 * The following keybinding is also available:
 *
 * | Title                               | Identifier     | Keybinding   | Command                                          |
 * | ----------------------------------- | -------------- | ------------ | ------------------------------------------------ |
 * | Rotate selections counter-clockwise | `both.reverse` | `)` (normal) | `[".selections.rotate.both", { reverse: true }]` |
 */
export function both(_: Context, repetitions: number, reverse: Argument<boolean> = false) {
  if (reverse) {
    repetitions = -repetitions;
  }

  return rotate(repetitions);
}

/**
 * Rotate selections clockwise (contents only).
 *
 * The following command is also available:
 *
 * | Title                                               | Identifier         | Command                                              |
 * | --------------------------------------------------- | ------------------ | ---------------------------------------------------- |
 * | Rotate selections counter-clockwise (contents only) | `contents.reverse` | `[".selections.rotate.contents", { reverse: true }]` |
 */
export function contents(_: Context, repetitions: number, reverse: Argument<boolean> = false) {
  if (reverse) {
    repetitions = -repetitions;
  }

  return rotate.contentsOnly(repetitions);
}

/**
 * Rotate selections clockwise (selections only).
 *
 * @keys `a-(` (normal)
 *
 * The following keybinding is also available:
 *
 * | Title                                                 | Identifier           | Keybinding     | Command                                                |
 * | ----------------------------------------------------- | -------------------- | -------------- | ------------------------------------------------------ |
 * | Rotate selections counter-clockwise (selections only) | `selections.reverse` | `a-)` (normal) | `[".selections.rotate.selections", { reverse: true }]` |
 */
export function selections(_: Context, repetitions: number, reverse: Argument<boolean> = false) {
  if (reverse) {
    repetitions = -repetitions;
  }

  return rotate.selectionsOnly(repetitions);
}
