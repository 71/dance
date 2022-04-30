import * as vscode from "vscode";

import { search } from ".";
import { Context } from "../context";
import * as Positions from "../positions";
import { Direction } from "../types";
import { escapeForRegExp } from "../../utils/regexp";

/**
 * Moves the given position towards the given direction until the given string
 * is found. If found, its start position will be returned; otherwise,
 * `undefined` will be returned.
 *
 * When navigating backward, the returned position **will include** the given
 * input, which is not the case when navigating forward. Please make sure that
 * this is what you want.
 */
export function moveTo(
  direction: Direction,
  string: string,
  origin: vscode.Position,
  document = Context.current.document,
) {
  if (direction === Direction.Backward) {
    origin = Positions.offsetOrEdge(origin, string.length, document);
  }

  return search(direction, new RegExp(escapeForRegExp(string)), origin, undefined, document)?.[0];
}

/**
 * Same as {@link moveTo}, but also ensures that the result is excluded by
 * translating the resulting position by `input.length` when going backward.
 */
export function moveToExcluded(
  direction: Direction,
  string: string,
  origin: vscode.Position,
  document?: vscode.TextDocument,
) {
  const result = moveTo(direction, string, origin, document);

  if (result !== undefined && direction === Direction.Backward) {
    return Positions.offset(result, string.length, document);
  }

  return result;
}

/**
 * Same as {@link moveTo}, but also ensures that the result is included by
 * translating the resulting position by `input.length` when going forward.
 */
export function moveToIncluded(
  direction: Direction,
  string: string,
  origin: vscode.Position,
  document?: vscode.TextDocument,
) {
  const result = moveTo(direction, string, origin, document);

  if (result !== undefined && direction === Direction.Forward) {
    return Positions.offset(result, string.length, document);
  }

  return result;
}
