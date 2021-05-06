import * as vscode from "vscode";
import { search } from ".";
import { Direction } from "..";
import { anyRegExp, escapeForRegExp } from "../../utils/regexp";
import { Context } from "../context";
import { ArgumentError } from "../errors";
import { Positions } from "../positions";

/**
 * A pair of opening and closing patterns.
 */
export class Pair {
  private readonly _re: RegExp;
  private readonly _closeGroup: number;

  public constructor(
    public readonly open: RegExp,
    public readonly close: RegExp,
  ) {
    const [re, group] = anyRegExp(open, close);

    this._re = re;
    this._closeGroup = group;
  }

  public searchMatching(
    direction: Direction,
    searchOrigin: vscode.Position,
    balance = 1,
  ): search.Result {
    ArgumentError.validate("balance", balance !== 0, "balance cannot be null");

    const re = this._re,
          closeGroup = this._closeGroup;

    for (;;) {
      const result = search(direction, re, searchOrigin);

      if (result === undefined) {
        return undefined;
      }

      const match = result[1];

      if (match[closeGroup] === undefined) {
        // Opening pattern matched.
        balance++;
      } else {
        // Closing pattern matched.
        balance--;
      }

      if (balance === 0) {
        return result;
      }

      if (direction === Direction.Forward) {
        searchOrigin = Positions.offset(result[0], match[0].length)!;
      } else {
        searchOrigin = result[0];
      }
    }
  }

  public findMatching(
    direction: Direction,
    searchOrigin: vscode.Position,
    balance = 1,
    included = true,
  ) {
    const result = this.searchMatching(direction, searchOrigin, balance);

    if (result === undefined) {
      return undefined;
    }

    if (direction === Direction.Backward) {
      return included ? result[0] : Positions.offset(result[0], result[1][0].length)!;
    }

    return included ? Positions.offset(result[0], result[1][0].length)! : result[0];
  }

  public searchOpening(
    searchOrigin: vscode.Position,
    balance = -1,
  ): search.Result {
    return this.searchMatching(Direction.Backward, searchOrigin, balance);
  }

  public searchClosing(
    searchOrigin: vscode.Position,
    balance = this.open.source === this.close.source ? -1 : 1,
  ): search.Result {
    return this.searchMatching(Direction.Forward, searchOrigin, balance);
  }
}

/**
 * Returns a new `Pair`.
 */
export function pair(open: string | RegExp, close: string | RegExp): Pair {
  if (typeof open === "string") {
    open = new RegExp(escapeForRegExp(open), "um");
  }
  if (typeof close === "string") {
    close = new RegExp(escapeForRegExp(close), "um");
  }

  return new Pair(open, close);
}

/**
 * Returns the selection enclosed in one of the given pairs and containing
 * the given position.
 */
export function surroundedBy(
  pairs: readonly Pair[],
  searchOrigin: vscode.Position,
  open = true,
  document = Context.current.document,
) {
  let pair: Pair;

  if (pairs.length === 1) {
    pair = pairs[0];
  } else {
    pair = new Pair(
      new RegExp(pairs.map((p) => `(${p.open.source})`).join("|"), "u"),
      new RegExp(pairs.map((p) => `(${p.close.source})`).join("|"), "u"),
    );
  }

  const startResult = pair.searchOpening(searchOrigin);

  if (startResult === undefined) {
    return undefined;
  }

  const innerStart = Positions.offset(startResult[0], startResult[1][0].length, document)!,
        endResult = pair.searchClosing(innerStart);

  if (endResult === undefined) {
    return undefined;
  }

  if (open) {
    return new vscode.Selection(
      startResult[0],
      Positions.offset(endResult[0], endResult[1][0].length, document)!,
    );
  }

  return new vscode.Selection(innerStart, endResult[0]);
}

/**
 * Returns the next selection enclosed in one of the given pairs. The resulting
 * selection is anchored on the first closing or opening pattern encountered in
 * the given direction, and its cursor will be on its matching pattern.
 */
export function closestSurroundedBy(
  pairs: readonly Pair[],
  direction: Direction,
  searchOrigin: vscode.Position,
  open = true,
  document = Context.current.document,
) {
  const re = new RegExp(pairs.map((p) => `(${p.open.source})|(${p.close.source})`).join("|"), "u"),
        anchorSearch = search(direction, re, searchOrigin);

  if (anchorSearch === undefined) {
    return undefined;
  }

  const match = anchorSearch[1],
        index = match.findIndex((x, i) => i > 0 && x !== undefined) - 1,
        pairIndex = index >> 1,
        pair = pairs[pairIndex];

  // Then, find the matching char of the anchor.
  let anchor = anchorSearch[0],
      active: vscode.Position;

  if (index & 1) {
    // Index is odd
    //     <=> match is for closing pattern
    //     <=> we go backward looking for the opening pattern
    const activeSearch = pair.searchOpening(anchor);

    if (activeSearch === undefined) {
      return undefined;
    }

    if (open) {
      anchor = Positions.offset(anchor, match[0].length, document)!;
      active = activeSearch[0];
    } else {
      active = Positions.offset(activeSearch[0], activeSearch[1][0].length, document)!;
    }
  } else {
    // Index is even
    //     <=> match is for opening pattern
    //     <=> we go forward looking for the closing pattern
    const searchAnchor = Positions.offset(anchor, match[0].length, document)!,
          activeSearch = pair.searchClosing(searchAnchor);

    if (activeSearch === undefined) {
      return undefined;
    }

    if (open) {
      active = Positions.offset(activeSearch[0], activeSearch[1][0].length, document)!;
    } else {
      anchor = searchAnchor;
      active = activeSearch[0];
    }
  }

  return new vscode.Selection(anchor, active);
}
