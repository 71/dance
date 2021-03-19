import * as vscode from "vscode";

// ===============================================================================================
// ==  CHARACTER SETS  ===========================================================================
// ===============================================================================================

const blankCharacters
  = "\r\n\t "
  + String.fromCharCode(
    0xa0,
    0x1680,
    0x2000,
    0x2001,
    0x2002,
    0x2003,
    0x2004,
    0x2005,
    0x2006,
    0x2007,
    0x2008,
    0x2009,
    0x200a,
    0x2028,
    0x2029,
    0x202f,
    0x205f,
    0x3000,
  );

/**
 * A character set.
 */
export const enum CharSet {
  /** Whether the set should be inverted when checking for existence. */
  Invert = 0b001,
  /** Blank characters (whitespace), such as ' \t\n'. */
  Blank = 0b010,
  /** Punctuation characters, such as '.,;'. */
  Punctuation = 0b100,

  /** Word character (neither blank nor punctuation). */
  Word = Invert | Blank | Punctuation,
  /** Non-blank character (either word or punctuation). */
  NonBlank = Invert | Blank,
}

/**
 * Returns a string containing all the characters belonging to the given
 * charset.
 */
export function getCharacters(charSet: CharSet, document: vscode.TextDocument) {
  let characters = "";

  if (charSet & CharSet.Blank) {
    characters += blankCharacters;
  }

  if (charSet & CharSet.Punctuation) {
    const wordSeparators = vscode.workspace
      .getConfiguration("editor", { languageId: document.languageId })
      .get("wordSeparators");

    if (typeof wordSeparators === "string") {
      characters += wordSeparators;
    }
  }

  return characters;
}

/**
 * Returns an array containing all the characters belonging to the given
 * charset.
 */
export function getCharCodes(charSet: CharSet, document: vscode.TextDocument) {
  const characters = getCharacters(charSet, document),
        charCodes = new Uint32Array(characters.length);

  for (let i = 0; i < characters.length; i++) {
    charCodes[i] = characters.charCodeAt(i);
  }

  return charCodes;
}

/**
 * Returns a function that tests whether a character belongs to the given
 * charset.
 */
export function getCharSetFunction(charSet: CharSet, document: vscode.TextDocument) {
  const charCodes = getCharCodes(charSet, document);

  if (charSet & CharSet.Invert) {
    return (charCode: number) => {
      return charCodes.indexOf(charCode) === -1;
    };
  } else {
    return (charCode: number) => {
      return charCodes.indexOf(charCode) !== -1;
    };
  }
}
