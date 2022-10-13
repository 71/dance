import { text } from "stream/consumers";
import * as vscode from "vscode";

import type { Argument, InputOr, RegisterOr } from ".";
import { insert as apiInsert, Context, deindentLines, edit, indentLines, insertByIndex, insertByIndexWithFullLines, insertFlagsAtEdge, joinLines, keypress, Positions, prompt, replace, replaceByIndex, Selections, Shift, Direction, moveToExcluded } from "../api";
import type { Register } from "../state/registers";
import { LengthMismatchError } from "../utils/errors";
import { insert } from "./edit";
import { escapeForRegExp, execRange } from "../utils/regexp";
import { select } from "./selections";
import { openMenu } from "./misc";
// import { closestSurroundedBy, Context, Direction, keypress, Lines, moveToExcluded, moveWhileBackward, moveWhileForward, Objects, Pair, pair, Positions, prompt, search, SelectionBehavior, Selections, Shift, surroundedBy, wordBoundary } from "../api";

/**
 * Match menu.
 *
 * | Title                   | Keybinding   | Command                                                         |
 * | ----------------------- | ------------ | --------------------------------------------------------------- |
 * | Show match menu         | `m` (normal) | `[".openMenu", { menu: "match" }]`                              |
 * | Show match menu         | `m` (visual) | `[".openMenu", { menu: "match", pass: [{ shift: "extend" }] }]` |
 */
declare module "./match";

/**
 * Replace stuff sorround
 *
 */
export async function sorroundreplace(
  _: Context,
  selections: readonly vscode.Selection[],
  inputOr: InputOr<"input", string>,
) {
  const inputFind = await inputOr(() => keypress(_));
  const inputReplace = await inputOr(() => keypress(_));

  const positions = Selections.mapByIndex((_i, selection, document) => {

    const pos = Selections.seekFrom(selection, Direction.Backward);
    const pos2 = Selections.seekFrom(selection, Direction.Backward);

    const asdd = moveToExcluded(Direction.Forward, inputFind, pos, document);
    const asddd = moveToExcluded(Direction.Backward, inputFind, pos2, document);

    throw new Error("Bla: " + JSON.stringify(selection.active, null, 2) + " " +  JSON.stringify(pos, null, 2)
    + " " +  JSON.stringify(asdd, null, 2) + " " +  JSON.stringify(asddd, null, 2));
    return [asdd, asddd];
  });

  const flatPositions = [...positions.flat()];

  // Check if any position of found target is the same
  // TODO: Optimize. Theres probably an easier/faster way...
  flatPositions.forEach((outer, i) => {
    flatPositions.forEach((inner, o) => {
      if (i === o) {
        return false;
      }
      if (inner?.line === outer?.line && inner?.character === outer?.character) {
        throw new Error("Cursors overlap for a single sorround pair range");
      }
      return;
    });
  });


  return _.run(() => edit((editBuilder, selections, document) => {
    for (const pos of positions) {

      const balala1 = new vscode.Range(pos[0]!, new vscode.Position(pos[0]!.line, pos[0]?.character! + 1));
      const balala2 = new vscode.Range(pos[1]!, new vscode.Position(pos[1]!.line, pos[1]?.character! - 1));

      editBuilder.replace(balala1 , inputReplace);
      editBuilder.replace(balala2, inputReplace);

    }
  }));
}

/**
 * Add stuff sorround
 *
 */
export async function sorround(
  _: Context,
  selections: readonly vscode.Selection[],
  register: RegisterOr<"dquote", Register.Flags.CanRead>,
  inputOr: InputOr<"input", string>,
) {
  const input = await inputOr(() => keypress(_));

  // const languageConfig = vscode.workspace.getConfiguration("editor.language", _.document),
  //       bracketsConfig = languageConfig.get<readonly [string, string][]>("brackets");
  // TODO: investigate why this always seems to return null. Static list is good enough for now

  const specialCharIndex = defaultEnclosingPatterns.findIndex((x => x.some(symbol => symbol === input)));

  let startText;
  let endText;
  if (specialCharIndex !== -1) {
    startText = defaultEnclosingPatterns[specialCharIndex][0];
    endText = defaultEnclosingPatterns[specialCharIndex][1];
  } else {
    startText = input;
    endText = input;
  }

  await insert(_, selections, register, true, false, 0, false, undefined, endText, "end");
  await insert(_, selections, register, true, false, 0, false, undefined, startText, "start");

}

const defaultEnclosingPatterns = [
  ["[", "]"],
  ["(", ")"],
  ["{", "}"],
  ["<", ">"],
];