import { Argument } from ".";
import { Extension } from "../state/extension";
import { SelectionBehavior } from "../state/modes";

/**
 * Developer utilities for Dance.
 */
declare module "./dev";

/**
 * Set the selection behavior of the specified mode.
 */
export function setSelectionBehavior(
  extension: Extension,

  mode: Argument<string>,
  value: Argument<"caret" | "character">,
) {
  extension.modes.get(mode)?.update(
    "_selectionBehavior",
    value === "character" ? SelectionBehavior.Character : SelectionBehavior.Caret,
  );
}
