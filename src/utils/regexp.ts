import { assert } from "./errors";

/**
 * Returns whether this `RegExp` may match on a string that contains a `\n`
 * character.
 *
 * @see https://tc39.es/ecma262/#sec-regexp-regular-expression-objects
 */
export function canMatchLineFeed(re: RegExp) {
  // The functions defined below return an integer >= 0 to indicate "keep
  // processing at index `i`", and -1 to indicate "a line feed character may be
  // matched by this RegExp".
  return groupCanMatchLineFeed(0, re, false) === -1;
}

function groupCanMatchLineFeed(i: number, re: RegExp, inverse: boolean) {
  for (const src = re.source; i !== -1 && i < src.length;) {
    switch (src.charCodeAt(i)) {
    case 41:  // ')'
      return i + 1;  // End of a group we're processing.

    case 40:  // '('
      if (src.charCodeAt(i + 1) === 63 /* ? */) {
        const next = src.charCodeAt(i + 2);

        if (next === 33 /* ! */) {
          i = groupCanMatchLineFeed(i + 3, re, !inverse);
          continue;
        } else if (next === 61 /* = */ || next === 58 /* : */) {
          i += 2;
        } else if (next === 60 /* < */) {
          i += 3;

          if (src.charCodeAt(i) === 33 /* ! */) {
            i = groupCanMatchLineFeed(i + 1, re, !inverse);
            continue;
          } else if (src.charCodeAt(i) === 61 /* = */) {
            i++;
          } else {
            while (src.charCodeAt(i) !== 62 /* > */) {
              i++;
            }
          }
        } else {
          assert(false);
        }
      }
      i = groupCanMatchLineFeed(i + 1, re, inverse);
      break;

    case 92:  // '\'
      i = escapedCharacterCanMatchLineFeed(i + 1, re, inverse);
      break;

    case 91:  // '['
      i = characterSetCanMatchLineFeed(i + 1, re, inverse);
      break;

    case 46:  // '.'
      if (re.dotAll || inverse) {
        return -1;
      }
      i++;
      break;

    case 43:  // '+'
    case 42:  // '*'
    case 63:  // '?'
    case 124:  // '|'
      i++;
      break;

    case 123:  // '{'
      i++;
      while (src.charCodeAt(i - 1) !== 125 /* } */) {
        i++;
      }
      break;

    case 93:  // ']'
    case 125:  // '}'
      assert(false);
      break;

    case 36:  // '$'
    case 94:  // '^'
    case 10:  // '\n'
      if (!inverse) {
        return -1;
      }
      i++;
      break;

    default:
      if (inverse) {
        return -1;
      }
      i++;
      break;
    }
  }

  return i;
}

function isDigit(charCode: number) {
  return charCode >= 48 /* 0 */ && charCode <= 57 /* 9 */;
}

function isRange(src: string, i: number, n: number, startInclusive: number, endInclusive: number) {
  if (i + n >= src.length) {
    return false;
  }

  for (let j = 0; j < n; j++) {
    const chr = src.charCodeAt(i + j);

    if (chr < startInclusive || chr > endInclusive) {
      return false;
    }
  }

  return true;
}

function isHex(src: string, i: number, n: number) {
  if (i + n >= src.length) {
    return false;
  }

  for (let j = 0; j < n; j++) {
    const c = src.charCodeAt(i + j);

    //        '0'        '9'          'a'        'f'           'A'        'F'
    if ((c >= 48 && c <= 57) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70)) {
      continue;
    }

    return false;
  }

  return true;
}

function escapedCharacterCanMatchLineFeed(i: number, re: RegExp, inverse: boolean) {
  const src = re.source,
        chr = src.charCodeAt(i);

  switch (chr) {
  case 110:  // 'n'
  case 115:  // 's'
  case 66:  // 'B'
  case 68:  // 'D'
  case 87:  // 'W'
    return inverse ? i + 1 : -1;

  case 48:  // '0'
    if (!isRange(src, i + 1, 2, 48 /* 0 */, 55 /* 7 */)) {
      return inverse ? -1 : i + 1;
    }
    if (src.charCodeAt(i + 1) === 49 /* 1 */ && src.charCodeAt(i + 2) === 50 /* 2 */) {
      // 012 = 10 = '\n'
      return inverse ? i + 3 : -1;
    }
    return inverse ? -1 : i + 3;

  case 99:  // 'c'
    const controlCharacter = src.charCodeAt(i + 1);

    if (controlCharacter === 74 /* J */ || controlCharacter === 106 /* j */) {
      return inverse ? i + 2 : -1;
    }
    return inverse ? -1 : i + 2;

  case 120:  // 'x'
    if (!isHex(src, i + 1, 2)) {
      return inverse ? -1 : i + 1;
    }
    if (src.charCodeAt(i + 1) === 48 /* 0 */) {
      const next = src.charCodeAt(i + 2);

      if (next === 97 /* a */ || next === 65 /* A */) {
        // 0x0A = 10 = \n
        return inverse ? i + 3 : -1;
      }
    }
    return inverse ? -1 : i + 3;

  case 117:  // 'u'
    if (src.charCodeAt(i + 1) === 123 /* { */) {
      i += 2;

      let x = 0;

      for (let ch = src.charCodeAt(i); ch !== 125 /* } */; i++) {
        const v = ch >= 48 /* 0 */ && ch <= 57 /* 9 */
          ? ch - 48 /* 0 */
          : ch >= 97 /* a */ && ch <= 102 /* f */
            ? 10 + ch - 97 /* a */
            : 10 + ch - 65 /* A */;

        x = x * 16 + v;
      }

      if (x === 10 /* \n */) {
        return inverse ? i + 1 : -1;
      }
      return inverse ? -1 : i + 1;
    }
    if (!isHex(src, i + 1, 4)) {
      return inverse ? -1 : i + 1;
    }
    if (src.charCodeAt(i + 1) === 48 /* 0 */
        && src.charCodeAt(i + 2) === 48 /* 0 */
        && src.charCodeAt(i + 3) === 48 /* 0 */) {
      const next = src.charCodeAt(i + 4);

      if (next === 97 /* a */ || next === 65 /* A */) {
        // 0x000A = 10 = \n
        return inverse ? i + 5 : -1;
      }
    }
    return inverse ? -1 : i + 5;

  // @ts-ignore
  case 80:  // 'P'
    if (!re.unicode) {
      return inverse ? -1 : i + 1;
    }
    inverse = !inverse;
    // fallthrough

  case 112:  // 'p'
    if (!re.unicode) {
      return inverse ? -1 : i + 1;
    }
    const start = i - 1;

    i += 2;  // Skip over 'p{'.

    while (src.charCodeAt(i) !== 125 /* } */) {
      i++;
    }

    i++;  // Skip over '}'.

    const testRegExpString = src.slice(start, i),
          testRegExp = new RegExp(testRegExpString, "u");

    if (testRegExp.test("\n")) {
      return inverse ? i : -1;
    }
    return inverse ? -1 : i;

  default:
    if (chr > 48 /* 0 */ && chr <= 57 /* 9 */) {
      // Back-reference is treated by the rest of the processing.
      i++;

      while (isDigit(src.charCodeAt(i))) {
        i++;
      }

      return i;
    }

    return inverse ? -1 : i + 1;
  }
}

function characterSetCanMatchLineFeed(i: number, re: RegExp, inverse: boolean) {
  const src = re.source,
        start = i - 1;

  if (src.charCodeAt(i) === 94 /* ^ */) {
    if (src.charCodeAt(i + 1) === 93 /* ] */) {
      return inverse ? i + 2 : -1;
    }

    i++;
    inverse = !inverse;
  }

  for (let mayHaveRange = false;;) {
    switch (src.charCodeAt(i)) {
    case 93:  // ']'
      if (mayHaveRange) {
        // The test below handles inversions, so we must toggle `inverse` if we
        // toggled it earlier.
        if (src.charCodeAt(start + 2) === 94 /* ^ */) {
          inverse = !inverse;
        }

        const testRegExpString = src.slice(start, i + 1),
              testRegExp = new RegExp(testRegExpString, re.flags);

        if (testRegExp.test("\n")) {
          if (!inverse) {
            return -1;
          }
        } else if (inverse) {
          return -1;
        }
      }
      return i + 1;

    case 92:  // '\'
      i = escapedCharacterCanMatchLineFeed(i + 1, re, inverse);
      if (i === -1) {
        return -1;
      }
      break;

    case 10:  // '\n'
      if (!inverse) {
        return -1;
      }
      i++;
      break;

    case 45:  // '-'
      mayHaveRange = true;
      break;

    default:
      if (inverse) {
        return -1;
      }
      i++;
      break;
    }
  }
}

const mustBeEscapedToBeStatic =
        new Uint8Array([..."()[]{}*+?^$."].map((c) => c.charCodeAt(0))),
      mustNotBeEscapedToBeStatic =
        new Uint8Array([..."123456789wWdDsSpPbBu"].map((c) => c.charCodeAt(0)));

/**
 * Returns the set of strings that the specified `RegExp` may match. If
 * `undefined`, this `RegExp` can match dynamic strings.
 */
export function matchesStaticStrings(re: RegExp) {
  const alternatives = [] as string[],
        source = re.source;
  let alt = "";

  for (let i = 0, len = source.length; i < len; i++) {
    const ch = source.charCodeAt(i);

    if (ch === 124 /* | */) {
      if (!alternatives.includes(alt)) {
        alternatives.push(alt);
      }

      alt = "";
    } else if (ch === 92 /* \ */) {
      i++;

      if (i === source.length) {
        break;
      }

      const next = source.charCodeAt(i);

      switch (next) {
      case 110: // n
        alt += "\n";
        break;
      case 114: // r
        alt += "\r";
        break;
      case 116: // t
        alt += "\t";
        break;
      case 102: // f
        alt += "\f";
        break;
      case 118: // v
        alt += "\v";
        break;

      case 99: // c
        const controlCh = source.charCodeAt(i + 1),
              isUpper = 65 <= controlCh && controlCh <= 90,
              offset = (isUpper ? 65 /* A */ : 107 /* a */) - 1;

        alt += String.fromCharCode(controlCh - offset);
        break;

      case 48: // 0
        if (isRange(source, i + 1, 2, 48 /* 0 */, 55 /* 7 */)) {
          alt += String.fromCharCode(parseInt(source.substr(i + 1, 2), 8));
          i += 2;
        } else {
          alt += "\0";
        }
        break;

      case 120: // x
        if (isHex(source, i + 1, 2)) {
          alt += String.fromCharCode(parseInt(source.substr(i + 1, 2), 16));
          i += 2;
        } else {
          alt += "x";
        }
        break;

      case 117: // u
        if (source.charCodeAt(i + 1) === 123 /* { */) {
          const end = source.indexOf("}", i + 2);

          if (end === -1) {
            return;
          }

          alt += String.fromCharCode(parseInt(source.slice(i + 2, end), 16));
          i = end + 1;
        } else if (isHex(source, i + 1, 4)) {
          alt += String.fromCharCode(parseInt(source.substr(i + 1, 4), 16));
          i += 4;
        } else {
          alt += "u";
        }
        return;

      default:
        if (mustNotBeEscapedToBeStatic.indexOf(next) !== -1) {
          return;
        }

        alt += source[i];
        break;
      }
    } else {
      if (mustBeEscapedToBeStatic.indexOf(ch) !== -1) {
        return;
      }

      alt += source[i];
    }
  }

  if (!alternatives.includes(alt)) {
    alternatives.push(alt);
  }

  return alternatives;
}

export interface Node<To extends Node<To>> {
  toString(): string;

  firstCharacter(): CharacterSet | undefined;
  reverse(state: Node.ReverseState): To;
}

export declare namespace Node {
  export type Inner<T extends Node<any>> = T extends Node<infer R> ? R : never;

  export interface ReverseState {
    readonly expression: Expression;
    readonly reversedGroups: (Group | undefined)[];
  }
}

export class Sequence implements Node<Sequence> {
  public constructor(
    public readonly nodes: readonly Sequence.Node[],
  ) {}

  public toString() {
    return this.nodes.join("");
  }

  public reverse(state: Node.ReverseState): Sequence {
    return new Sequence([...this.nodes.map((n) => n.reverse(state))].reverse());
  }

  public firstCharacter() {
    for (const node of this.nodes) {
      const firstCharacter = node.firstCharacter();

      if (firstCharacter !== undefined) {
        return firstCharacter;
      }
    }

    return undefined;
  }
}

export declare namespace Sequence {
  export type Node = Repeat | Anchor;
}

export abstract class Disjunction<To extends Node<To>> implements Node<To> {
  public constructor(
    public readonly alternatives: readonly Sequence[],
  ) {}

  protected prefix() {
    return "(";
  }

  protected suffix() {
    return ")";
  }

  public toString() {
    return this.prefix() + this.alternatives.join() + this.suffix();
  }

  public firstCharacter(): CharacterSet | undefined {
    const firstCharacters = this.alternatives
      .map((a) => a.firstCharacter())
      .filter((x) => x !== undefined) as CharacterSet[];

    if (firstCharacters.length === 0) {
      return undefined;
    }

    return firstCharacters[0].merge(...firstCharacters.slice(1));
  }

  public abstract reverse(state: Node.ReverseState): To;
}

export class Group extends Disjunction<Group | NumericEscape | Backreference> {
  public constructor(
    alternatives: readonly Sequence[],
    public readonly index?: number,
    public readonly name?: string,
  ) {
    super(alternatives);
  }

  protected override prefix() {
    if (this.name !== undefined) {
      return "(?<" + this.name + ">";
    }
    if (this.index === undefined) {
      return "(?:";
    }
    return "(";
  }

  public reverse(state: Node.ReverseState): Group | NumericEscape | Backreference {
    if (this.index !== undefined && state.reversedGroups[this.index - 1] !== undefined) {
      return new NumericEscape(this.index);
    }

    return new Group(
      this.alternatives.map((a) => a.reverse(state) as Sequence),
      this.index,
      this.name,
    );
  }
}

export class Raw implements Node<Raw> {
  public constructor(
    public readonly string: string,
  ) {}

  public toString() {
    return this.string.replace(/[()[\]{}*+?^$.]/g, "\\$&");
  }

  public reverse() {
    return new Raw([...this.string].reverse().join());
  }

  public firstCharacter() {
    return new CharacterSet([this], false);
  }

  public static readonly a = new Raw("a");
  public static readonly z = new Raw("z");
  public static readonly A = new Raw("A");
  public static readonly Z = new Raw("Z");
  public static readonly _ = new Raw("_");
  public static readonly _0 = new Raw("0");
  public static readonly _9 = new Raw("9");
  public static readonly newLine = new Raw("\n");
}

export class CharacterSet implements Node<CharacterSet> {
  public constructor(
    public readonly alternatives: readonly CharacterSet.Alternative[],
    public readonly isNegated: boolean,
  ) {}

  public toString() {
    if (this === CharacterSet.digit) {
      return "\\d";
    }
    if (this === CharacterSet.notDigit) {
      return "\\D";
    }
    if (this === CharacterSet.word) {
      return "\\w";
    }
    if (this === CharacterSet.notWord) {
      return "\\W";
    }
    if (this === CharacterSet.whitespace) {
      return "\\s";
    }
    if (this === CharacterSet.notWhitespace) {
      return "\\S";
    }

    const contents = this.alternatives.map(
      (c) => Array.isArray(c) ? `${c[0]}-${c[1]}` : c.toString(),
    ).join("");

    return `[${this.isNegated ? "^" : ""}${contents}]`;
  }

  public negate() {
    return new CharacterSet(this.alternatives, !this.isNegated);
  }

  public makePositive(hasUnicodeFlag?: boolean) {
    if (!this.isNegated) {
      return this;
    }

    const characterClasses = [] as CharacterClass[],
          ranges = [0, hasUnicodeFlag ? 0x10FFFF : 0xFFFF];

    for (let alternative of this.alternatives) {
      if (!Array.isArray(alternative)) {
        if (alternative instanceof CharacterClass) {
          characterClasses.push(alternative.negate());
          continue;
        }

        alternative = [alternative, alternative];
      }

      const [alt0, alt1] = alternative,
            negStart = alt0 instanceof Raw ? alt0.string.charCodeAt(0) : alt0.value,  // S
            negEnd = alt1 instanceof Raw ? alt1.string.charCodeAt(0) : alt1.value;  // E

      for (let i = 0; i < ranges.length; i += 2) {
        // Let's consider that the range we need to erase is S -> E, and the
        // positive range we're erasing from is s -> e.
        const posStart = ranges[i],  // s
              posEnd = ranges[i + 1];  // e

        if (negEnd < posStart || negStart > posEnd) {
          // S E s e          or  s e S E
          // ^^^                      ^^^  nothing to erase
        } else if (negStart <= posStart) {
          // S s ...
          if (negEnd >= posEnd) {
            // S s e E
            // ^^^^^^^  erased
            ranges.splice(i, 2);
            i -= 2;
          } else {
            // S s E e
            // ^^^^^    erased, s becomes E + 1
            ranges[i] = negEnd + 1;
          }
        } else if (negEnd >= posEnd) {
          // s S e E
          //   ^^^^^ erased, e becomes S - 1
          ranges[i + 1] = negStart - 1;
        } else {
          // s S E e
          //   ^^^    erase, e becomes S - 1 and a new range is added
          ranges[i + 1] = negStart - 1;
          ranges.splice(i + 2, 0, negEnd + 1, posEnd);
        }
      }
    }

    const alternatives = characterClasses as CharacterSet.Alternative[];

    for (let i = 0; i < ranges.length; i += 2) {
      const rangeStart = ranges[i],
            rangeEnd = ranges[i + 1];

      if (rangeStart === rangeEnd) {
        alternatives.push(Escaped.fromCharCode(rangeStart));
      } else {
        alternatives.push(Escaped.fromCharCode(rangeStart), Escaped.fromCharCode(rangeEnd));
      }
    }

    alternatives.push(...characterClasses);

    return new CharacterSet(alternatives, false);
  }

  public merge(...others: readonly CharacterSet[]) {
    const alternatives =
      this.makePositive().alternatives.slice() as CharacterSet.Alternative[];

    for (const other of others) {
      for (const alternative of other.makePositive().alternatives) {
        if (alternatives.indexOf(alternative) === -1) {
          alternatives.push(alternative);
        }
      }
    }

    return new CharacterSet(alternatives, false);
  }

  public reverse() {
    return this;
  }

  public firstCharacter() {
    return this;
  }

  public static readonly digit = new CharacterSet([[Raw._0, Raw._9]], false);
  public static readonly word = new CharacterSet(
    [[Raw._0, Raw._9], [Raw.a, Raw.z], [Raw.A, Raw.Z], Raw._], false);
  public static readonly whitespace = new CharacterSet(
    [..."\t\n\v\f\r \u00a0\u2000\u2001\u2002\u2003\u2004\u2005",
      ..."\u2006\u2007\u2008\u2009\u200a\u200b\u2028\u2029\u3000"].map((c) => new Raw(c)), false);

  public static readonly notDigit = new CharacterSet(CharacterSet.digit.alternatives, true);
  public static readonly notWord = new CharacterSet(CharacterSet.word.alternatives, true);
  public static readonly notWhitespace = new CharacterSet(
    CharacterSet.whitespace.alternatives, true);
}

export declare namespace CharacterSet {
  export type AlternativeAtom = Raw | Escaped;
  export type Alternative = AlternativeAtom | CharacterClass | [AlternativeAtom, AlternativeAtom];
}

export class Escaped implements Node<Escaped> {
  public constructor(
    public readonly type: "x" | "u" | "c" | "0",
    public readonly value: number,
  ) {}

  public toString() {
    const type = this.type,
          value = this.value,
          str = type === "0"
            ? value.toString(8).padStart(2, "0")
            : type === "c"
              ? String.fromCharCode(65 + value)
              : type === "x"
                ? value.toString(16).padStart(2, "0")
                : value <= 0xFFFF
                  ? value.toString(16).padStart(4, "0")
                  : "{" + value.toString(16) + "}";

    return "\\" + type + str;
  }

  public reverse() {
    return this;
  }

  public firstCharacter() {
    return new CharacterSet([this], false);
  }

  public static fromCharCode(charCode: number) {
    if (charCode >= 32 && charCode <= 126) {
      return new Raw(String.fromCharCode(charCode));
    }
    if (charCode < 0xFF) {
      return new Escaped("x", charCode);
    }
    return new Escaped("u", charCode);
  }
}

export class Dot implements Node<Dot> {
  private constructor(
    public readonly includesNewLine: boolean,
  ) {}

  public toString() {
    return ".";
  }

  public reverse() {
    return this;
  }

  public firstCharacter() {
    return new CharacterSet(this.includesNewLine ? [] : [Raw.newLine], true);
  }

  public static readonly includingNewLine = new Dot(true);
  public static readonly excludingNewLine = new Dot(false);
}

export class CharacterClass implements Node<CharacterClass> {
  public constructor(
    public readonly characterClass: string,
    public readonly isNegative: boolean,
  ) {}

  public toString() {
    return `\\${this.isNegative ? "P" : "p"}{${this.characterClass}}`;
  }

  public negate() {
    return new CharacterClass(this.characterClass, !this.isNegative);
  }

  public reverse() {
    return this;
  }

  public firstCharacter() {
    return new CharacterSet([this], false);
  }
}

const enum AnchorKind {
  Start,
  End,
  Boundary,
  NotBoundary,
}

export class Anchor implements Node<Anchor> {
  private constructor(
    public readonly kind: Anchor.Kind,
    public readonly string: string,
  ) {}

  public toString() {
    return this.string;
  }

  public reverse() {
    return this;
  }

  public firstCharacter() {
    return undefined;
  }

  public static readonly start = new Anchor(AnchorKind.Start, "^");
  public static readonly end = new Anchor(AnchorKind.End, "$");
  public static readonly boundary = new Anchor(AnchorKind.Boundary, "\\b");
  public static readonly notBoundary = new Anchor(AnchorKind.NotBoundary, "\\B");
}

export class Lookaround extends Disjunction<Lookaround> {
  public constructor(
    alternatives: readonly Sequence[],
    public readonly isNegative: boolean,
    public readonly isLookbehind: boolean,
  ) {
    super(alternatives);
  }

  protected override prefix() {
    return "(?" + (this.isLookbehind ? "<" : "") + (this.isNegative ? "!" : "=");
  }

  public reverse(state: Node.ReverseState) {
    return new Lookaround(
      this.alternatives.map((a) => a.reverse(state)),
      this.isNegative,
      this.isLookbehind,
    );
  }
}

export declare namespace Anchor {
  export type Kind = AnchorKind;
}

export class Repeat<T extends Repeat.Node = Repeat.Node> implements Node<Repeat> {
  public constructor(
    public readonly node: T,
    public readonly min?: number,
    public readonly max?: number,
    public readonly lazy = false,
  ) {}

  public get isStar() {
    return this.min === undefined && this.max === undefined;
  }

  public get isPlus() {
    return this.min === 1 && this.max === undefined;
  }

  public get isOptional() {
    return this.min === undefined && this.max === 1;
  }

  public get isNonRepeated() {
    return this.min === 1 && this.max === 1 && !this.lazy;
  }

  public toString() {
    const node = this.node.toString(),
          lazy = this.lazy ? "?" : "";

    if (this.isOptional) {
      return node + "?" + lazy;
    }

    if (this.isPlus) {
      return node + "+" + lazy;
    }

    if (this.isStar) {
      return node + "*" + lazy;
    }

    return `${node}{${this.min ?? ""},${this.max ?? ""}}${lazy}`;
  }

  public reverse(state: Node.ReverseState): Repeat<Node.Inner<T>> {
    const reversed = this.node.reverse(state) as any;

    if (reversed === this.node) {
      return this as any;
    }

    return new Repeat(reversed, this.min, this.max, this.lazy);
  }

  public firstCharacter() {
    return this.node.firstCharacter();
  }
}

export declare namespace Repeat {
  export type Node = Group | Lookaround | CharacterSet | Raw | Escaped | CharacterClass | Dot
                   | NumericEscape | Backreference;
}

export class NumericEscape implements Node<Group | NumericEscape | Backreference> {
  public constructor(
    public n: number,
  ) {
    assert(n > 0);
  }

  public toString() {
    return "\\" + this.n;
  }

  public reverse(state: Node.ReverseState) {
    const i = this.n - 1;

    if (i >= state.reversedGroups.length || state.reversedGroups[i] !== undefined) {
      return this;
    }

    const group = state.expression.groups[i];

    return state.reversedGroups[i] = new Group(
      group.alternatives.map((a) => a.reverse(state)),
      group.index,
      group.name,
    );
  }

  public firstCharacter() {
    return undefined;
  }
}

export class Backreference implements Node<Group | NumericEscape | Backreference> {
  public constructor(
    public readonly name: string,
  ) {}

  public toString() {
    return "\\k<" + this.name + ">";
  }

  public reverse(state: Node.ReverseState) {
    const n = state.expression.groups.findIndex((g) => g.name === this.name);

    assert(n !== -1);

    if (state.reversedGroups[n] !== undefined) {
      return this;
    }

    const group = state.expression.groups[n];

    return state.reversedGroups[n] = new Group(
      group.alternatives.map((a) => a.reverse(state)),
      group.index,
      group.name,
    );
  }

  public firstCharacter() {
    return undefined;
  }
}

export class Expression extends Disjunction<Expression> {
  public constructor(
    public readonly re: RegExp,
    public readonly groups: readonly Group[],
    alternatives: readonly Sequence[],
  ) {
    super(alternatives);
  }

  protected override prefix() {
    return "";
  }

  protected override suffix() {
    return "";
  }

  public reverse(state?: Node.ReverseState) {
    if (state === undefined) {
      state = {
        expression: this,
        reversedGroups: Array.from(this.groups, () => undefined),
      };
    }

    const alternatives = this.alternatives.map((a) => a.reverse(state!)),
          re = new RegExp(alternatives.join(""), this.re.flags);

    assert(state.reversedGroups.indexOf(undefined) === -1);

    return new Expression(re, state.reversedGroups as Group[], alternatives);
  }
}

export const enum CharCodes {
  LF = 10,
  Bang = 33,
  Dollar = 36,
  LParen = 40,
  RParen = 41,
  Star = 42,
  Plus = 43,
  Comma = 44,
  Minus = 45,
  Dot = 46,
  Colon = 58,
  LAngle = 60,
  Eq = 61,
  RAngle = 62,
  Question = 63,
  LBracket = 91,
  Backslash = 92,
  RBracket = 93,
  Caret = 94,
  LCurly = 123,
  Pipe = 124,
  RCurly = 125,
}

/**
 * Returns the AST of the given `RegExp`.
 */
export function parse(re: RegExp) {
  const dummyGroup = new Group([], undefined);

  const src = re.source,
        groups = [] as Group[];
  let i = 0;

  function repeat<T extends Repeat.Node>(node: T) {
    const ch = src.charCodeAt(i);
    let min: number | undefined,
        max: number | undefined;

    if (ch === CharCodes.Star) {
      i++;
      min = 0;
    } else if (ch === CharCodes.Plus) {
      i++;
      min = 1;
    } else if (ch === CharCodes.LCurly) {
      i++;

      const start = i;

      for (;;) {
        const ch = src.charCodeAt(i++);

        if (isDigit(ch)) {
          continue;
        }

        if (ch === CharCodes.RCurly) {
          min = max = +src.slice(start, i - 1);
          break;
        }

        if (ch === CharCodes.Comma) {
          min = +src.slice(start, i - 1);

          const end = i;

          for (;;) {
            const ch = src.charCodeAt(i++);

            if (isDigit(ch)) {
              continue;
            }

            if (ch === CharCodes.RCurly) {
              max = +src.slice(end, i - 1);
              break;
            }

            i = start - 1;

            return new Repeat(node, 1, 1, false);
          }

          break;
        }

        i = start - 1;

        return new Repeat(node, 1, 1, false);
      }
    } else if (ch === CharCodes.Question) {
      i++;
      min = 0;
      max = 1;
    } else {
      return new Repeat(node, 1, 1, false);
    }

    let lazy = false;

    if (src.charCodeAt(i) === CharCodes.Question) {
      lazy = true;
      i++;
    }

    return new Repeat(node, min, max, lazy);
  }

  function escapedCharacter<InCharSet extends boolean>(
    inCharSet: InCharSet,
  ): Raw | CharacterSet | Escaped | CharacterClass
   | (InCharSet extends true ? never : NumericEscape | Backreference) {
    switch (src.charCodeAt(i++)) {
    case 110: // n
      return new Raw("\n");
    case 114: // r
      return new Raw("\r");
    case 116: // t
      return new Raw("\t");
    case 102: // f
      return new Raw("\f");
    case 118: // v
      return new Raw("\n");

    case 119: // w
      return CharacterSet.word;
    case 87: // W
      return CharacterSet.notWord;

    case 100: // d
      return CharacterSet.digit;
    case 68: // D
      return CharacterSet.notDigit;

    case 115: // s
      return CharacterSet.whitespace;
    case 83: // S
      return CharacterSet.notWhitespace;

    case 99: // c
      const controlCh = src.charCodeAt(i),
            isUpper = 65 <= controlCh && controlCh <= 90,
            offset = (isUpper ? 65 /* A */ : 107 /* a */) - 1,
            value = controlCh - offset;

      i++;
      return new Escaped("c", value);

    case 48: // 0
      if (isRange(src, i, 2, 48 /* 0 */, 55 /* 7 */)) {
        const value = parseInt(src.substr(i, 2), 8);

        i += 2;
        return new Escaped("0", value);
      } else {
        return new Raw("\0");
      }

    case 120: // x
      if (isHex(src, i, 2)) {
        const value = parseInt(src.substr(i, 2), 16);

        i += 2;
        return new Escaped("x", value);
      } else {
        return new Raw("x");
      }

    case 117: // u
      if (src.charCodeAt(i) === CharCodes.LCurly) {
        const end = src.indexOf("}", i + 1);

        assert(end !== -1);

        const value = parseInt(src.slice(i + 1, end), 16);

        i = end + 1;
        return new Escaped("u", value);
      } else if (isHex(src, i, 4)) {
        const value = parseInt(src.substr(i, 4), 16);

        i += 4;
        return new Escaped("u", value);
      } else {
        return new Raw("u");
      }

    case 112: // p
    case 80: // P
      assert(src.charCodeAt(i) === CharCodes.LCurly);

      const start = i + 1,
            end = src.indexOf("}", start);

      assert(end > start);

      i = end + 1;
      return new CharacterClass(src.slice(start, end), src.charCodeAt(start - 2) === 80);

    default:
      if (!inCharSet && isDigit(src.charCodeAt(i - 1))) {
        const start = i - 1;

        while (isDigit(src.charCodeAt(i))) {
          i++;
        }

        return new NumericEscape(+src.slice(start, i)) as any;
      }

      if (!inCharSet && src.charCodeAt(i - 1) === 107 /* k */) {
        assert(src.charCodeAt(i) === CharCodes.LAngle);

        const start = i + 1,
              end = src.indexOf(">", start);

        assert(end > start);

        i = end + 1;
        return new Backreference(src.slice(start, end)) as any;
      }

      return new Raw(src[i - 1]);
    }
  }

  function characterSet() {
    const alternatives: CharacterSet.Alternative[] = [],
          isNegated = src.charCodeAt(i) === CharCodes.Caret;

    if (isNegated) {
      i++;
    }

    while (i < src.length) {
      switch (src.charCodeAt(i++)) {
      case CharCodes.RBracket:
        return new CharacterSet(alternatives, isNegated);

      case CharCodes.Backslash:
        const escaped = escapedCharacter(/* inCharSet= */ true);

        if (escaped instanceof CharacterSet) {
          assert(!escaped.isNegated);

          alternatives.push(...escaped.alternatives);
        } else {
          alternatives.push(escaped);
        }
        break;

      case CharCodes.Minus:
        if (alternatives.length === 0) {
          alternatives.push(new Raw("-"));
          continue;
        }

        const start = alternatives[alternatives.length - 1];

        if (Array.isArray(start) || start instanceof CharacterClass) {
          alternatives.push(new Raw("-"));
          continue;
        }

        switch (src.charCodeAt(i++)) {
        case CharCodes.RBracket:
          alternatives.push(new Raw("-"));
          return new CharacterSet(alternatives, isNegated);

        default:
          const end = src.charCodeAt(i - 1) === CharCodes.Backslash
            ? escapedCharacter(/* inCharSet= */ true)
            : new Raw(src[i - 1]);

          if (end instanceof CharacterSet) {
            assert(!end.isNegated);

            alternatives.push(new Raw("-"), ...end.alternatives);
          } else if (end instanceof CharacterClass) {
            alternatives.push(new Raw("-"), end);
          } else {
            alternatives.push([start, end]);
          }
          break;
        }
        break;

      default:
        alternatives.push(new Raw(src[i - 1]));
        break;
      }
    }

    assert(false);
  }

  function group(): readonly Sequence[] {
    const alternatives: Sequence[] = [],
          sequence: Sequence.Node[] = [];

    while (i < src.length) {
      switch (src.charCodeAt(i)) {
      case CharCodes.RParen:
        i++;
        return alternatives;

      case CharCodes.Pipe:
        i++;
        alternatives.push(new Sequence(sequence.splice(0)));
        break;

      case CharCodes.LParen:
        if (src.charCodeAt(i + 1) === CharCodes.Question) {
          const next = src.charCodeAt(i + 2);

          if (next === CharCodes.Colon) {
            i += 3;
            sequence.push(repeat(new Group(group())));
          } else if (next === CharCodes.Eq) {
            i += 3;
            sequence.push(repeat(new Lookaround(group(), false, false)));
          } else if (next === CharCodes.Bang) {
            i += 3;
            sequence.push(repeat(new Lookaround(group(), true, false)));
          } else if (next === CharCodes.LAngle) {
            if (src.charCodeAt(i) === CharCodes.Eq) {
              i += 4;
              sequence.push(repeat(new Lookaround(group(), false, true)));
            } else if (src.charCodeAt(i + 3) === CharCodes.Bang) {
              i += 4;
              sequence.push(repeat(new Lookaround(group(), true, true)));
            } else {
              i += 3;

              const start = i,
                    n = groups.push(dummyGroup);

              while (src.charCodeAt(i) !== CharCodes.RAngle) {
                i++;
              }

              i++;
              sequence.push(repeat(groups[n - 1] = new Group(group(), n, src.slice(start, i - 2))));
            }
          } else {
            assert(false);
          }
        } else {
          const n = groups.push(dummyGroup);

          sequence.push(repeat(groups[n - 1] = new Group(group(), n) as any) as Repeat<Group>);
        }
        break;

      case CharCodes.Backslash:
        i++;
        sequence.push(repeat(escapedCharacter(/* inCharSet= */ false)));
        break;

      case CharCodes.LBracket:
        i++;
        sequence.push(repeat(characterSet()));
        break;

      case CharCodes.Dot:
        i++;
        sequence.push(repeat(re.dotAll ? Dot.includingNewLine : Dot.excludingNewLine));
        break;

      case CharCodes.Caret:
        i++;
        sequence.push(Anchor.start);
        break;

      case CharCodes.Dollar:
        i++;
        sequence.push(Anchor.end);
        break;

      default:
        if (sequence.length > 0
            && (sequence[sequence.length - 1] as Repeat<Raw>).node instanceof Raw
            && (sequence[sequence.length - 1] as Repeat<Raw>).isNonRepeated) {
          const prev = (sequence[sequence.length - 1] as Repeat<Raw>).node;

          sequence[sequence.length - 1] = repeat(new Raw(prev.string + src[i]));
        } else {
          sequence.push(repeat(new Raw(src[i])));
        }
        break;
      }
    }

    alternatives.push(new Sequence(sequence));

    return alternatives;
  }

  return new Expression(re, groups, group());
}

/**
 * Returns the last `RegExp` match in the given text.
 */
export function execLast(re: RegExp, text: string) {
  if (text.length > 10_000) {
    // Execute reversed text on reversed regular expression.
    const reverseRe = parse(re).reverse().re,
          match = reverseRe.exec([...text].reverse().join(""));

    if (match === null) {
      return null;
    }

    // Update match index and input.
    match.index = text.length - match.index - match[0].length;
    match.input = text;

    // Reverse all matched groups so that they go back to their original text.
    match[0] = text.substr(match.index, match[0].length);

    for (let i = 1; i < match.length; i++) {
      match[i] = [...match[i]].reverse().join("");
    }

    if (match.groups !== undefined) {
      for (const name in match.groups) {
        match.groups[name] = [...match.groups[name]].reverse().join("");
      }
    }

    return match;
  }

  let lastMatch: RegExpExecArray | undefined,
      lastMatchIndex = 0;

  for (;;) {
    const match = re.exec(text);

    if (match === null) {
      break;
    }

    if (match[0].length === 0) {
      throw new Error("RegExp returned empty result");
    }

    lastMatchIndex += match.index + (lastMatch?.[0].length ?? 0);
    lastMatch = match;
    text = text.slice(match.index + match[0].length);
  }

  if (lastMatch === undefined) {
    return null;
  }

  lastMatch.index = lastMatchIndex;

  return lastMatch;
}

/**
 * Parses a RegExp string with a possible replacement.
 */
export function parseRegExpWithReplacement(regexp: string) {
  if (regexp.length < 2 || regexp[0] !== "/") {
    throw new Error("invalid RegExp");
  }

  let pattern = "",
      replacement: string | undefined = undefined,
      flags: string | undefined = undefined;

  for (let i = 1; i < regexp.length; i++) {
    const ch = regexp[i];

    if (flags !== undefined) {
      // Parse flags
      if (!"miguys".includes(ch)) {
        throw new Error(`unknown RegExp flag "${ch}"`);
      }

      flags += ch;
    } else if (replacement !== undefined) {
      // Parse replacement string
      if (ch === "/") {
        flags = "";
      } else if (ch === "\\") {
        if (i === regexp.length - 1) {
          throw new Error("unexpected end of RegExp");
        }

        replacement += ch + regexp[++i];
      } else {
        replacement += ch;
      }
    } else {
      // Parse pattern
      if (ch === "/") {
        replacement = "";
      } else if (ch === "\\") {
        if (i === regexp.length - 1) {
          throw new Error("unexpected end of RegExp");
        }

        pattern += ch + regexp[++i];
      } else {
        pattern += ch;
      }
    }
  }

  if ((flags === undefined || flags === "") && /^[miguys]+$/.test(replacement ?? "")) {
    flags = replacement;
    replacement = undefined;
  }

  try {
    return [new RegExp(pattern, flags), replacement] as const;
  } catch {
    throw new Error("invalid RegExp");
  }
}

/**
 * Returns a valid RegExp source allowing a `RegExp` to match the given string.
 */
export function escapeForRegExp(text: string) {
  // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns a `RegExp` that matches if any of the two given `RegExp`s does, and
 * the index of the "marker group" that will be equal to `""` if the `RegExp`
 * that matched the input is `b`.
 */
export function anyRegExp(a: RegExp, b: RegExp) {
  const flags = [...new Set([...a.flags, ...b.flags])].join(""),
        aGroups = new RegExp("|" + a.source, a.flags).exec("")!.length - 1,
        bGroups = new RegExp("|" + b.source, b.flags).exec("")!.length - 1;

  // Update backreferences in `b` to ensure they point to the right indices.
  const bSource = replaceUnlessEscaped(b.source, /\\(\d+)/g, (text, n) => {
    if (n[0] === "0" || +n > bGroups) {
      return text;
    }

    return "\\" + (+n + aGroups);
  });

  return [new RegExp(`(?:${a.source})|(?:${bSource})()`, flags), aGroups + bGroups + 1] as const;
}

/**
 * Same as `text.replace(...args)`, but does not replaced escaped characters.
 */
export function replaceUnlessEscaped(text: string, re: RegExp, replace: (...args: any) => string) {
  return text.replace(re, (...args) => {
    const offset = args[args.length - 2],
          text = args[args.length - 1];

    if (isEscaped(text, offset)) {
      return args[0];
    }

    return replace(...args);
  });
}

/**
 * Same as `text.replace(...args)`, but does not replaced escaped characters.
 */
export function matchUnlessEscaped(text: string, re: RegExp) {
  assert(re.global);

  for (let match = re.exec(text); match !== null; match = re.exec(text)) {
    if (!isEscaped(text, match.index)) {
      return match;
    }
  }

  return null;
}

function isEscaped(text: string, offset: number) {
  if (offset === 0) {
    return false;
  }

  let isEscaped = false;

  for (let i = offset - 1; i >= 0; i--) {
    if (text[i] === "\\") {
      isEscaped = !isEscaped;
    } else {
      return isEscaped;
    }
  }

  return isEscaped;
}

/**
 * Like `String.prototype.split(RegExp)`, but returns the `[start, end]`
 * indices corresponding to each string of the split.
 */
export function splitRange(text: string, re: RegExp) {
  const sections: [start: number, end: number][] = [];

  for (let start = 0;;) {
    re.lastIndex = 0;

    const match = re.exec(text);

    if (match === null || text.length === 0) {
      sections.push([start, start + text.length]);

      return sections;
    }

    sections.push([start, start + match.index]);

    if (match[0].length === 0) {
      text = text.slice(1);
      start++;
    } else {
      text = text.slice(match.index + match[0].length);
      start += match.index + match[0].length;
    }
  }
}

/**
 * Like `RegExp.prototype.exec()`, but returns the `[start, end]`
 * indices corresponding to each matched result.
 */
export function execRange(text: string, re: RegExp) {
  re.lastIndex = 0;

  const sections: [start: number, end: number, match: RegExpExecArray][] = [];
  let diff = 0;

  for (let match = re.exec(text); match !== null && text.length > 0; match = re.exec(text)) {
    const start = match.index,
          end = start + match[0].length;

    sections.push([diff + start, diff + end, match]);

    text = text.slice(end);
    diff += end;
    re.lastIndex = 0;

    if (start === end) {
      text = text.slice(1);
      diff++;
    }
  }

  return sections;
}
