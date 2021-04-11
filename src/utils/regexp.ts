import { assert } from "../api/errors";

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

/**
 * Returns the last `RegExp` match in the given text.
 */
export function execLast(re: RegExp, text: string) {
  let lastMatch: RegExpExecArray | undefined;

  for (;;) {
    const match = re.exec(text);

    if (match === null) {
      break;
    }

    if (match[0].length === 0) {
      throw new Error("RegExp returned empty result");
    }

    lastMatch = Object.assign(match, { index: match.index + (lastMatch?.[0].length ?? 0) });
    text = text.slice(match.index + match[0].length);
  }

  if (lastMatch === undefined) {
    return null;
  }

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
 * Like `String.prototype.split(RegExp)`, but returns the `[start, end]`
 * indices corresponding to each string of the split.
 */
export function splitRange(text: string, re: RegExp) {
  const sections: [start: number, end: number][] = [];

  for (let start = 0;;) {
    const match = re.exec(text);

    if (match === null) {
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

    re.lastIndex = 0;
  }
}

/**
 * Like `RegExp.prototype.exec()`, but returns the `[start, end]`
 * indices corresponding to each matched result.
 */
export function execRange(text: string, re: RegExp) {
  const sections: [start: number, end: number][] = [];

  for (let match = re.exec(text); match !== null; match = re.exec(text)) {
    const start = match.index,
          end = start + match[0].length;

    sections.push([start, end]);

    if (start === end) {
      re.lastIndex++;
    }
  }

  return sections;
}
