import * as assert from "assert";
import * as fs     from "fs";
import * as vscode from "vscode";

import { execAll } from "./build-utils";
import { ExpectedDocument, resolve } from "./utils";

function stringifySelection(selection: vscode.Selection) {
  return `${selection.anchor.line}:${selection.anchor.character} → `
       + `${selection.active.line}:${selection.active.character}`;
}

suite("Testing utilities tests", function () {
  suite("ExpectedDocument#parse", function () {
    const readmePath = resolve("test/README.md"),
          readmeContents = fs.readFileSync(readmePath, "utf-8"),
          re = /^(\d+)\..*?\[(.+?)\].*?:\n( +)```\n([\s\S]+?)\n\3```/gm;

    for (const [_, n, selectionsString, indent, indentedCode] of execAll(re, readmeContents)) {
      const expectedSelections = selectionsString.split(", "),
            code = indentedCode.replace(new RegExp("^" + indent, "gm"), "");

      test(`example ${n}`, function () {
        const document = ExpectedDocument.parse(code),
              actualSelections = document.selections.map(stringifySelection);

        const actual = actualSelections.map((s, i) => `selection #${i}: ${s}`).join("\n"),
              expected = expectedSelections.map((s, i) => `selection #${i}: ${s}`).join("\n");

        assert.strictEqual(actual, expected);
      });
    }
  });
});
