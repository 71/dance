import * as path from "path";
import * as Mocha from "mocha";
import * as glob from "glob";

export function run(testsRoot: string, cb: (error: any, failures?: number) => void) {
  // Create the mocha test
  const currentFile = (process.env.CURRENT_FILE ?? "").replace(/\\/g, "/"),
        mocha = new Mocha({ ui: "tdd", color: true, timeout: 0 });

  glob("**/**.test.js", { cwd: testsRoot }, (err, files) => {
    if (err) {
      return cb(err);
    }

    if (currentFile === "test/README.md") {
      mocha.grep("ExpectedDocument#parse");

      files = ["utils.test.js"];
    } else if (currentFile.startsWith("test/suite/commands/") && currentFile.endsWith(".md")) {
      files = [path.join("commands", path.basename(currentFile, ".md") + ".test.js")];
    } else if (currentFile.includes(".test.")) {
      const currentFileAsJs = path.basename(currentFile).replace(/\.ts$/, ".js");

      files = files.filter((f) => f.endsWith(currentFileAsJs));
    } else if (currentFile.startsWith("src/api/")) {
      mocha.grep(currentFile.slice(8));

      files = ["api.test.js"];
    } else if (currentFile.startsWith("src/commands")) {
      files = files.filter((f) => f.startsWith("commands/"));
    } else if (currentFile.length > 0) {
      files = [];
    }

    // Add files to the test suite
    files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

    try {
      // Run the mocha test
      mocha.run((failures) => cb(null, failures));
    } catch (err) {
      console.error(err);
      cb(err);
    }
  });
}
