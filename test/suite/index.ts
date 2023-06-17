import glob      from "glob";
import Mocha     from "mocha";
import * as path from "path";
import * as fs   from "fs/promises";

export async function run(testsRoot: string) {
  // Create the mocha test.
  const currentFile = (process.env["CURRENT_FILE"] ?? "").replace(/\\/g, "/"),
        currentLine = process.env["CURRENT_LINE"] ? +process.env["CURRENT_LINE"] - 1 : undefined,
        rootPath = path.join(__dirname, "../../.."),
        mocha = new Mocha({ ui: "tdd", color: true, timeout: 0 });

  if (process.env["MOCHA_REPORTER"]) {
    // Note: most reporters do not work due to
    // https://github.com/microsoft/vscode/issues/56211. Here, using a faulty
    // reporter is not necessarily bad; we can do this to avoid writing results.
    mocha.reporter(process.env["MOCHA_REPORTER"]);
  }

  let files = await new Promise<readonly string[]>((resolve, reject) => {
    glob("**/**.test.js", { cwd: testsRoot }, (err, matches) => {
      if (err) {
        return reject(err);
      }

      return resolve(matches);
    });
  });

  if (currentFile === "test/README.md") {
    mocha.grep("ExpectedDocument#parse");

    files = ["utils.test.js"];
  } else if (currentFile.startsWith("test/suite/commands/")) {
    if (currentFile.endsWith(".md")) {
      files = [path.join("commands", path.basename(currentFile, ".md") + ".test.js")];

      if (currentLine !== undefined) {
        const filePath = path.join(rootPath, "test/suite/commands", path.basename(currentFile)),
              contents = await fs.readFile(filePath, "utf-8"),
              lines = contents.split("\n");

        for (let i = currentLine; i >= 0; i--) {
          const line = lines[i],
                match = /^#+ (.+)$/.exec(line);

          if (match !== null) {
            mocha.grep(match[1] + "$");
            break;
          }
        }
      }
    } else if (currentFile.endsWith(".test.ts")) {
      files = [path.join("commands", path.basename(currentFile, ".ts") + ".js")];
    }
  } else if (currentFile.includes(".test.")) {
    const currentFileAsJs = path.basename(currentFile).replace(/\.ts$/, ".js");

    files = files.filter((f) => f.endsWith(currentFileAsJs));
  } else if (currentFile.startsWith("src/api/")) {
    mocha.grep(currentFile.slice(8));

    files = ["api.test.js"];

    if (currentLine !== undefined) {
      const filePath = path.join(rootPath, "src/api", currentFile.slice(8)),
            contents = await fs.readFile(filePath, "utf-8"),
            lines = contents.split("\n");
      let direction = -1;

      if (/^[ /]+\*/.test(lines[currentLine])) {
        direction = 1;
      }

      for (let i = currentLine; i >= 0 && i < lines.length; i += direction) {
        const line = lines[i],
              match = /^ *export function (\w+)/.exec(line);

        if (match !== null) {
          mocha.grep(currentFile.slice(8) + ".+" + match[1]);
          break;
        }
      }
    }
  } else if (currentFile.startsWith("src/commands")) {
    files = files.filter((f) => f.startsWith("commands/"));
  } else if (currentFile.length > 0) {
    files = [];
  }

  // Add files to the test suite.
  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

  // Run the mocha test.
  const failures = await new Promise<number>((resolve) => mocha.run(resolve));

  if (failures > 0) {
    // This causes the process to exit with a non-zero exit code, and to flush
    // the error messages.
    throw new Error();
  }
}
