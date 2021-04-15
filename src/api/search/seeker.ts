import * as vscode from "vscode";

import { Context } from "../context";

/**
 * A set of characters.
 */
export class CharacterSet {
  private constructor(
    /**
     * A list of characters.
     */
    public readonly characters: ReadonlySet<number> = new Set(),

    /**
     * A list of `[inclusiveStart, inclusiveEnd]` ranges.
     */
    public readonly ranges: readonly number[] = [],

    /**
     * Whether the results of calling `has` should be inversed.
     */
    public readonly inverse: boolean = false,

    /**
     * A fallback `RegExp` for matching characters. Should only be used to match
     * Unicode character classes.
     */
    public readonly fallback?: RegExp,
  ) {}

  /**
   * An empty set.
   */
  public static positiveEmpty = new CharacterSet();

  /**
   * An empty set that matches any character.
   */
  public static negativeEmpty = new CharacterSet(new Set(), [], true);

  /**
   * Returns a new `CharacterSet` extended with the given character codes.
   */
  public with(...charCodes: number[]) {
    const characters = new Set(this.characters);

    for (let i = 0; i < charCodes.length; i++) {
      characters.add(charCodes[i]);
    }

    return new CharacterSet(characters, this.ranges, this.inverse, this.fallback);
  }

  /**
   * Returns a new `CharacterSet` extended with the characters of the given
   * strings.
   */
  public withCharacter(...strings: string[]) {
    const characters = new Set(this.characters);

    for (let i = 0; i < strings.length; i++) {
      const string = strings[i];

      for (let j = 0; j < string.length; j++) {
        characters.add(string.charCodeAt(j));
      }
    }

    return new CharacterSet(characters, this.ranges, this.inverse, this.fallback);
  }

  /**
   * Returns a new `CharacterSet` extended with the given character range.
   */
  public withRange(start: number, end: number) {
    const ranges = this.ranges.slice();

    ranges.push(start, end);

    return new CharacterSet(this.characters, ranges, this.inverse, this.fallback);
  }

  /**
   * Returns a new `CharacterSet` extended with the given character range.
   */
  public withCharacterClass(name: string) {
    const existingFallback = this.fallback,
          fallback = existingFallback === undefined
            ? new RegExp(`^\\p{${name}}$`, "u")
            : new RegExp(existingFallback.source + `|^\\p{${name}}$`, "u");

    return new CharacterSet(this.characters, this.ranges, this.inverse, fallback);
  }

  /**
   * Returns an inversed version of the current `CharacterSet`.
   */
  public inversed() {
    return new CharacterSet(this.characters, this.ranges, !this.inverse, this.fallback);
  }

  /**
   * Returns `true` if the first character of the given string is in the
   * character set, and `false` otherwise.
   */
  public hasCharacter(character: string) {
    return this.has(character.charCodeAt(0));
  }

  /**
   * Returns `true` if the character with the given character code is in the
   * character set, and `false` otherwise.
   */
  public has(charCode: number) {
    const ifFound = !this.inverse;

    if (this.characters.has(charCode)) {
      return ifFound;
    }

    const ranges = this.ranges;

    for (let i = 0, len = ranges.length; i < len; i += 2) {
      if (ranges[i] <= charCode && charCode <= ranges[i + 1]) {
        return ifFound;
      }
    }

    const fallback = this.fallback;

    if (fallback !== undefined && fallback.test(String.fromCharCode(charCode))) {
      return ifFound;
    }

    return !ifFound;
  }

  /**
   * Builds a character set from the start of a string.
   */
  public static fromStart(value: string) {
    return;
  }
}

/**
 * A class used to seek to parts of the document based on some patterns.
 */
export class Seeker {
  public pair(open: string, close: string): this;
  public pair(open: RegExp, openChar: string, close: RegExp, closeChar: string): this;

  public pair() {

    return new Seeker();
  }
}

const seekerPerDocument = new WeakMap<vscode.TextDocument, Seeker>();

/**
 * Returns a `Seeker` with patterns defined for the current document.
 *
 * @see Seeker
 */
export function seeker(context = Context.current) {
  let seeker = seekerPerDocument.get(context.document);

  if (seeker === undefined) {
    seekerPerDocument.set(context.document, seeker = new Seeker());
  }

  return seeker;
}
