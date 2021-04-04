import { readFileSync } from "fs";

export interface TestFile {

}

export function parseTestFile(contents: string) {

}

const scriptIndex = process.argv.findIndex((x) => x.endsWith("commands.utils.ts"));

if (scriptIndex !== -1 && process.argv.length > scriptIndex + 2) {
  const args = process.argv.slice(scriptIndex + 1),
        command = args[0],
        path = args[1],
        contents = readFileSync(path, "utf-8"),
        testFile = parseTestFile(contents);

  if (command === "show-selection-boundaries") {
    // TODO
  } else if (command === "hide-selection-boundaries") {
    // TODO
  } else if (command === "add-selection") {
    const selectionStartLine = +args[2],
          selectionText = args[3];
    // TODO
  }
}
