import * as vscode from "vscode";

/**
 * A VS Code `Position`, `Range` or `Selection`.
 */
export type PRS = vscode.Position | vscode.Range | vscode.Selection;

/**
 * A VS Code `Position` or `Selection`.
 */
export type PS = vscode.Position | vscode.Selection;

/**
 * Returns whether the given value is a `vscode.Position` object.
 *
 * ### Example
 *
 * ```js
 * const position = new vscode.Position(0, 0),
 *       range = new vscode.Range(position, position),
 *       selection = new vscode.Selection(position, position);
 *
 * expect(isPosition(position), "to be true");
 * expect(isPosition(range), "to be false");
 * expect(isPosition(selection), "to be false");
 * ```
 */
export function isPosition(x: unknown): x is vscode.Position {
  return x != null && (x as object).constructor === vscode.Position;
}

/**
 * Returns whether the given value is a `vscode.Range` object.
 *
 * ### Example
 *
 * ```js
 * const position = new vscode.Position(0, 0),
 *       range = new vscode.Range(position, position),
 *       selection = new vscode.Selection(position, position);
 *
 * expect(isRange(position), "to be false");
 * expect(isRange(range), "to be true");
 * expect(isRange(selection), "to be false");
 * ```
 */
export function isRange(x: unknown): x is vscode.Range {
  return x != null && (x as object).constructor === vscode.Range;
}

/**
 * Returns whether the given value is a `vscode.Selection` object.
 *
 * ### Example
 *
 * ```js
 * const position = new vscode.Position(0, 0),
 *       range = new vscode.Range(position, position),
 *       selection = new vscode.Selection(position, position);
 *
 * expect(isSelection(position) , "to be false");
 * expect(isSelection(range)    , "to be false");
 * expect(isSelection(selection), "to be true");
 * ```
 */
export function isSelection(x: unknown): x is vscode.Selection {
  return x != null && (x as object).constructor === vscode.Selection;
}

/**
 * Returns a `PRS` whose start position is mapped using the given function.
 *
 * ### Example
 *
 * ```js
 * const p1 = new vscode.Position(0, 0),
 *       p2 = new vscode.Position(0, 1);
 *
 * expect(
 *   mapStart(p1, (x) => x.translate(1)),
 *   "to equal",
 *   new vscode.Position(1, 0),
 * );
 * expect(
 *   mapStart(new vscode.Range(p1, p2), (x) => x.translate(1)),
 *   "to equal",
 *   new vscode.Range(p2, new vscode.Position(1, 0)),
 * );
 * expect(
 *   mapStart(new vscode.Selection(p1, p2), (x) => x.translate(1)),
 *   "to equal",
 *   new vscode.Selection(new vscode.Position(1, 0), p2),
 * );
 * expect(
 *   mapStart(new vscode.Selection(p2, p1), (x) => x.translate(1)),
 *   "to equal",
 *   new vscode.Selection(p2, new vscode.Position(1, 0)),
 * );
 * ```
 */
export function mapStart<T extends PRS>(x: T, f: (_: vscode.Position) => vscode.Position) {
  if (isSelection(x)) {
    return x.start === x.anchor
      ? new vscode.Selection(f(x.start), x.end) as T
      : new vscode.Selection(x.end, f(x.start)) as T;
  }

  if (isRange(x)) {
    return new vscode.Range(f(x.start), x.end) as T;
  }

  return f(x as vscode.Position) as T;
}

/**
 * Returns a `PRS` whose end position is mapped using the given function.
 *
 * ### Example
 *
 * ```js
 * const p1 = new vscode.Position(0, 0),
 *       p2 = new vscode.Position(0, 1);
 *
 * expect(
 *   mapEnd(p1, (x) => x.translate(1)),
 *   "to equal",
 *   new vscode.Position(1, 0),
 * );
 * expect(
 *   mapEnd(new vscode.Range(p1, p2), (x) => x.translate(1)),
 *   "to equal",
 *   new vscode.Range(p1, new vscode.Position(1, 1)),
 * );
 * expect(
 *   mapEnd(new vscode.Selection(p1, p2), (x) => x.translate(1)),
 *   "to equal",
 *   new vscode.Selection(p1, new vscode.Position(1, 1)),
 * );
 * expect(
 *   mapEnd(new vscode.Selection(p2, p1), (x) => x.translate(1)),
 *   "to equal",
 *   new vscode.Selection(new vscode.Position(1, 1), p1),
 * );
 * ```
 */
export function mapEnd<T extends PRS>(x: T, f: (_: vscode.Position) => vscode.Position) {
  if (isSelection(x)) {
    return x.start === x.anchor
      ? new vscode.Selection(x.start, f(x.end)) as T
      : new vscode.Selection(f(x.end), x.start) as T;
  }

  if (isRange(x)) {
    return new vscode.Range(x.start, f(x.end)) as T;
  }

  return f(x as vscode.Position) as T;
}

/**
 * Returns a `PS` whose active position is mapped using the given function.
 *
 * ### Example
 *
 * ```js
 * const p1 = new vscode.Position(0, 0),
 *       p2 = new vscode.Position(0, 1);
 *
 * expect(
 *   mapActive(p1, (x) => x.translate(1)),
 *   "to equal",
 *   new vscode.Position(1, 0),
 * );
 * expect(
 *   mapActive(new vscode.Selection(p1, p2), (x) => x.translate(1)),
 *   "to equal",
 *   new vscode.Selection(p1, new vscode.Position(1, 1)),
 * );
 * ```
 */
export function mapActive<T extends PS>(x: T, f: (_: vscode.Position) => vscode.Position) {
  if (isSelection(x)) {
    return new vscode.Selection(x.anchor, f(x.active)) as T;
  }

  return f(x as vscode.Position) as T;
}

/**
 * Returns a `PRS` whose start and end positions are mapped using the given
 * function.
 *
 * ### Example
 *
 * ```js
 * const p1 = new vscode.Position(0, 0),
 *       p2 = new vscode.Position(0, 1);
 *
 * expect(
 *   mapBoth(p1, (x) => x.translate(1)),
 *   "to equal",
 *   new vscode.Position(1, 0),
 * );
 * expect(
 *   mapBoth(new vscode.Range(p1, p2), (x) => x.translate(1)),
 *   "to equal",
 *   new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 1)),
 * );
 * expect(
 *   mapBoth(new vscode.Selection(p1, p2), (x) => x.translate(1)),
 *   "to equal",
 *   new vscode.Selection(new vscode.Position(1, 0), new vscode.Position(1, 1)),
 * );
 * expect(
 *   mapBoth(new vscode.Selection(p2, p1), (x) => x.translate(1)),
 *   "to equal",
 *   new vscode.Selection(new vscode.Position(1, 1), new vscode.Position(1, 0)),
 * );
 * ```
 */
export function mapBoth<T extends PRS>(x: T, f: (_: vscode.Position) => vscode.Position) {
  if (isSelection(x)) {
    return new vscode.Selection(f(x.anchor), f(x.active)) as T;
  }

  if (isRange(x)) {
    return new vscode.Range(f(x.start), f(x.end)) as T;
  }

  return f(x as vscode.Position) as T;
}

/**
 * Given a function type with at least one parameter, returns a pair of all the
 * argument types except the last one, and then the last argument type.
 */
export type SplitParameters<F> = F extends (...args: infer AllArgs) => any
  ? AllArgs extends [...infer Args, infer LastArg] ? [Args, LastArg] : never
  : never;

/**
 * Returns a function that takes the `n - 1` first parameters of `f`, and
 * returns yet another function that takes the last parameter of `f`, and
 * returns `f(...args, lastArg)`.
 *
 * ### Example
 *
 * ```js
 * const add2 = (a, b) => a + b,
 *       add3 = (a, b, c) => a + b + c;
 *
 * expect(add2(1, 2)).to.be.equal(3);
 * expect(add3(1, 2, 3)).to.be.equal(6);
 *
 * expect(curry(add2)(1)(2)).to.be.equal(3);
 * expect(curry(add3)(1, 2)(3)).to.be.equal(6);
 * ```
 */
export function curry<F extends (...allArgs: any) => any>(f: F, ...counts: number[]) {
  if (counts.length === 0) {
    return (...args: SplitParameters<F>[0]) => (lastArg: SplitParameters<F>[1]) => {
      return f(...args, lastArg);
    };
  }

  // TODO: review this
  let curried: any = f;

  for (let i = counts.length - 1; i >= 0; i--) {
    const prev = curried,
          len = counts[i];

    curried = (...args: any[]) => (...newArgs: any[]) => {
      const allArgs = args;
      let i = 0;

      for (; i < newArgs.length && i < len; i++) {
        allArgs.push(newArgs[i]);
      }

      for (; i < len; i++) {
        allArgs.push(undefined);
      }

      return prev(...allArgs);
    };
  }

  return curried;
}

/* eslint-disable max-len */

// In case we need `pipe` for more than 10 functions:
//
// Array.from({ length: 10 }, (_, n) => {
//   const lo = n => String.fromCharCode(97 + n),
//         hi = n => String.fromCharCode(65 + n);
//
//   return `
// /**
//  * Returns a function that maps all non-\`undefined\` values
//  * through the given function and returns the remaining results.
//  */
// export function pipe<${
// Array.from({ length: n + 2 }, (_, i) => hi(i)).join(", ")
// }>(${
// Array.from({ length: n + 1 }, (_, i) => `${lo(i)}: (_: ${hi(i)}) => ${hi(i + 1)} | undefined`).join(", ")
// }): (values: readonly A[]) => ${hi(n + 1)}[];`;
// }).join("\n")

/**
 * Returns a function that maps all non-`undefined` values
 * through the given function and returns the remaining results.
 */
export function pipe<A, B>(a: (_: A) => B | undefined): (values: readonly A[]) => B[];

/**
 * Returns a function that maps all non-`undefined` values
 * through the given function and returns the remaining results.
 *
 * ### Example
 *
 * ```js
 * const doubleNumbers = pipe((n) => typeof n === "number" ? n : undefined,
 *                            (n) => n * 2);
 *
 * expect(
 *   doubleNumbers([1, "a", 2, null, 3, {}]),
 *   "to equal",
 *   [2, 4, 6],
 * );
 * ```
 */
export function pipe<A, B, C>(a: (_: A) => B | undefined, b: (_: B) => C | undefined): (values: readonly A[]) => C[];

/**
 * Returns a function that maps all non-`undefined` values
 * through the given function and returns the remaining results.
 */
export function pipe<A, B, C, D>(a: (_: A) => B | undefined, b: (_: B) => C | undefined, c: (_: C) => D | undefined): (values: readonly A[]) => D[];

/**
 * Returns a function that maps all non-`undefined` values
 * through the given function and returns the remaining results.
 */
export function pipe<A, B, C, D, E>(a: (_: A) => B | undefined, b: (_: B) => C | undefined, c: (_: C) => D | undefined, d: (_: D) => E | undefined): (values: readonly A[]) => E[];

/**
 * Returns a function that maps all non-`undefined` values
 * through the given function and returns the remaining results.
 */
export function pipe<A, B, C, D, E, F>(a: (_: A) => B | undefined, b: (_: B) => C | undefined, c: (_: C) => D | undefined, d: (_: D) => E | undefined, e: (_: E) => F | undefined): (values: readonly A[]) => F[];

/**
 * Returns a function that maps all non-`undefined` values
 * through the given function and returns the remaining results.
 */
export function pipe<A, B, C, D, E, F, G>(a: (_: A) => B | undefined, b: (_: B) => C | undefined, c: (_: C) => D | undefined, d: (_: D) => E | undefined, e: (_: E) => F | undefined, f: (_: F) => G | undefined): (values: readonly A[]) => G[];

/**
 * Returns a function that maps all non-`undefined` values
 * through the given function and returns the remaining results.
 */
export function pipe<A, B, C, D, E, F, G, H>(a: (_: A) => B | undefined, b: (_: B) => C | undefined, c: (_: C) => D | undefined, d: (_: D) => E | undefined, e: (_: E) => F | undefined, f: (_: F) => G | undefined, g: (_: G) => H | undefined): (values: readonly A[]) => H[];

/**
 * Returns a function that maps all non-`undefined` values
 * through the given function and returns the remaining results.
 */
export function pipe<A, B, C, D, E, F, G, H, I>(a: (_: A) => B | undefined, b: (_: B) => C | undefined, c: (_: C) => D | undefined, d: (_: D) => E | undefined, e: (_: E) => F | undefined, f: (_: F) => G | undefined, g: (_: G) => H | undefined, h: (_: H) => I | undefined): (values: readonly A[]) => I[];

/**
 * Returns a function that maps all non-`undefined` values
 * through the given function and returns the remaining results.
 */
export function pipe<A, B, C, D, E, F, G, H, I, J>(a: (_: A) => B | undefined, b: (_: B) => C | undefined, c: (_: C) => D | undefined, d: (_: D) => E | undefined, e: (_: E) => F | undefined, f: (_: F) => G | undefined, g: (_: G) => H | undefined, h: (_: H) => I | undefined, i: (_: I) => J | undefined): (values: readonly A[]) => J[];

/**
 * Returns a function that maps all non-`undefined` values
 * through the given function and returns the remaining results.
 */
export function pipe<A, B, C, D, E, F, G, H, I, J, K>(a: (_: A) => B | undefined, b: (_: B) => C | undefined, c: (_: C) => D | undefined, d: (_: D) => E | undefined, e: (_: E) => F | undefined, f: (_: F) => G | undefined, g: (_: G) => H | undefined, h: (_: H) => I | undefined, i: (_: I) => J | undefined, j: (_: J) => K | undefined): (values: readonly A[]) => K[];
/* eslint-enable max-len */

export function pipe(...functions: ((_: unknown) => unknown)[]) {
  return (values: readonly unknown[]) => {
    const results = [],
          vlen = values.length,
          flen = functions.length;

    for (let i = 0; i < vlen; i++) {
      let value = values[i];

      for (let j = 0; value !== undefined && j < flen; j++) {
        value = functions[j](value);
      }

      if (value !== undefined) {
        results.push(value);
      }
    }

    return results;
  };
}

/**
 * Same as `pipe`, but also works with async functions.
 */
export function pipeAsync(...functions: ((_: unknown) => unknown)[]) {
  return async (values: readonly unknown[]) => {
    const results = [],
          vlen = values.length,
          flen = functions.length;

    for (let i = 0; i < vlen; i++) {
      let value = values[i];

      for (let j = 0; value !== undefined && j < flen; j++) {
        value = await functions[j](value);
      }

      if (value !== undefined) {
        results.push(value);
      }
    }

    return results;
  };
}
