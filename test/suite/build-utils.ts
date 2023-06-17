import assert from "assert";

export function stringifyExpectedDocument(code: string, codeIndent: number) {
  code = code.replace(/`/g, "\\`").replace(/^/gm, " ".repeat(codeIndent + 2));
  code = code.slice(0, code.length - 2);  // De-indent end line.

  return `${codeIndent + 2}, String.raw\`\n${code}\``;
}

export function longestStringLength<T>(f: (v: T) => string, values: readonly T[]) {
  return values.reduce((longest, curr) => Math.max(longest, f(curr).length), 0);
}

export function execAll(re: RegExp, contents: string) {
  assert(re.global);

  const matches = [] as RegExpExecArray[];

  for (let match = re.exec(contents); match !== null; match = re.exec(contents)) {
    matches.push(match);
  }

  return matches;
}
