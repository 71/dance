import * as assert from "assert";
import * as fs     from "fs/promises";
import * as G      from "glob";
import * as path   from "path";

const verbose = process.argv.includes("--verbose");

const moduleCommentRe =
  new RegExp(String.raw`\/\*\*\n`                   //     start of doc comment
           + String.raw`((?: \*(?:\n| .+\n))+?)`    // #1: doc comment
           + String.raw` \*\/\n`                    //     end of doc comment
           + String.raw`declare module \"(.+?)\"`,  // #2: module name
             "m");

const docCommentRe =
  new RegExp(String.raw`^( *)`                                  // #1: indentation
           + String.raw`\/\*\*\n`                               //     start of doc comment
           + String.raw`((?:\1 \*(?:\n| .+\n))+?)`              // #2: doc comment
           + String.raw`\1 \*\/\n`                              //     end of doc comment
           + String.raw`\1export (?:async )?function (\w+)`     // #3: function name
           + String.raw`(?:<[^>)\n]+>)?`                        //     generic arguments
           + String.raw`\((.*|\n[\s\S]+?^\1)\)`                 // #4: parameters
           + String.raw`(?:: )?(.+)[;{]$`,                      // #5: return type (optional)
             "gm");

function countNewLines(text: string) {
  let count = 0;

  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) {
      count++;
    }
  }

  return count;
}

const keyMapping: Record<string, keyof Builder.AdditionalCommand> = {
  Command: "commands",
  Commands: "commands",
  Identifier: "identifier",
  Identifiers: "identifier",
  Keys: "keys",
  Keybinding: "keys",
  Keybindings: "keys",
  Title: "title",
};

const valueConverter: Record<keyof Builder.AdditionalCommand, (x: string) => string> = {
  commands(commands) {
    return commands
      .replace(/^`+|`+$/g, "")
      .replace(/MAX_INT/g, `${2 ** 31 - 1}`);  // Max integer supported in JSON.
  },
  identifier(identifier) {
    return identifier.replace(/^`+|`+$/g, "");
  },
  keys(keys) {
    return keys;
  },
  title(title) {
    return title;
  },
  qualifiedIdentifier(qualifiedIdentifier) {
    return qualifiedIdentifier;
  },
  line() {
    throw new Error("this should not be called");
  },
};

function parseAdditional(qualificationPrefix: string, text: string, textStartLine: number) {
  const lines = text.split("\n"),
        additional: Builder.AdditionalCommand[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.length > 2 && line.startsWith("| ") && line.endsWith(" |")) {
      const keys = line
        .slice(2, line.length - 2)          // Remove start and end |.
        .split(" | ")                       // Split into keys.
        .map((k) => keyMapping[k.trim()]);  // Normalize keys.

      i++;

      if (/^\|[-| ]+\|$/.test(lines[i])) {
        i++;
      }

      while (i < lines.length) {
        const line = lines[i];

        if (!line.startsWith("| ") || !line.endsWith(" |")) {
          break;
        }

        i++;

        const obj: Builder.AdditionalCommand = { line: textStartLine + i },
              values = line.slice(2, line.length - 2).split(" | ");

        for (let j = 0; j < values.length; j++) {
          const key = keys[j],
                value = valueConverter[key](values[j].trim());

          (obj as Record<string, any>)[key] = value;
        }

        if ("identifier" in obj) {
          obj.qualifiedIdentifier = qualificationPrefix + obj.identifier;
        }

        additional.push(obj);
      }
    }
  }

  return additional;
}

/**
 * Parses all the doc comments of functions in the given string of TypeScript
 * code. Examples will be parsed using the given function.
 */
function parseDocComments(code: string, modulePath: string) {
  let moduleDoc: string,
      moduleDocStartLine: number,
      moduleName: string;
  const moduleHeaderMatch = moduleCommentRe.exec(code);

  if (moduleHeaderMatch !== null) {
    moduleDoc = moduleHeaderMatch[1].split("\n").map((line) => line.slice(3)).join("\n");
    moduleDocStartLine = code.slice(0, moduleHeaderMatch.index).split("\n").length + 2;
    moduleName = moduleHeaderMatch[2].replace(/^\.\//, "");
  } else {
    moduleDoc = "";
    moduleDocStartLine = 0;
    moduleName = path.basename(modulePath, ".ts");
  }

  if (verbose) {
    console.log("Parsing doc comments in module", moduleName);
  }

  const modulePrefix = moduleName === "misc" ? "" : moduleName + ".",
        functions: Builder.ParsedFunction[] = [];

  for (let match = docCommentRe.exec(code); match !== null; match = docCommentRe.exec(code)) {
    const indentationString = match[1],
          docCommentString = match[2],
          functionName = match[3],
          parametersString = match[4],
          returnTypeString = match[5],
          startLine = countNewLines(code.slice(0, match.index)),
          endLine = startLine + countNewLines(match[0]);

    const indentation = indentationString.length,
          returnType = returnTypeString.trim(),
          parameters = parametersString
            .split(/,(?![^:]+?[}>])/g)
            .map((p) => p.trim())
            .filter((p) => p.length > 0)
            .map((p) => {
              let match: RegExpExecArray | null;

              if (match = /^(\w+\??|.+[}\]]): *(.+)$/s.exec(p)) {
                return match.slice(1) as [string, string];
              }
              if (match = /^(\w+) *= *(\d+|true|false)$/.exec(p)) {
                const type = match[2] === "true" || match[2] === "false"
                  ? "Argument<boolean>"
                  : "number";

                return [match[1], `${type} = ${match[2]}`] as [string, string];
              }
              if (match = /^(\w+) *= *(\w+)\.([\w.]+)$/.exec(p)) {
                return [match[1], `${match[2]} = ${match[2]}.${match[3]}`] as [string, string];
              }
              if (match = /^(\.\.\.\w+): *(.+)$/.exec(p)) {
                return [match[1], match[2]] as [string, string];
              }

              throw new Error(`unrecognized parameter pattern ${p}`);
            }),
          docComment = docCommentString
            .split("\n")
            .map((line) => line.slice(indentation).replace(/^ \* ?/g, ""))
            .join("\n");

    for (const parameter of parameters) {
      if (parameter[0].endsWith("?")) {
        // Optional parameters.
        parameter[0] = parameter[0].slice(0, parameter[0].length - 1);
        parameter[1] += " | undefined";
      } else {
        const match = /^(.+?)\s+=\s+(.+)$/.exec(parameter[1]);

        if (match !== null) {
          // Optional parameters with default values.
          parameter[1] = match[1] + " | undefined";
        }
      }
    }

    const splitDocComment = docComment.split(/\n### Example\n/gm),
          properties: Record<string, string> = {},
          doc = splitDocComment[0].replace(/^@(param \w+|\w+)(?:\n| ((?:.+\n)(?: {2}.+\n)*))/gm,
                                           (_, k: string, v: string) => {
                                             properties[k] = v?.replace(/\n {2}/g, " ").trim();
                                             return "";
                                           }),
          summary = /((?:.+(?:\n|$))+)/.exec(doc)![0].trim().replace(/\.$/, ""),
          examplesStrings = splitDocComment.slice(1),
          nameWithDot = functionName.replace(/_/g, ".");

    if ("internal" in properties) {
      continue;
    }

    let qualifiedName = modulePrefix;

    if (nameWithDot === moduleName) {
      qualifiedName = qualifiedName.replace(/\.$/, "");
    } else {
      qualifiedName += nameWithDot;
    }

    functions.push({
      name: functionName,
      nameWithDot,
      qualifiedName,

      startLine,
      endLine,

      doc,
      properties,
      summary,
      examples: examplesStrings,
      additional: parseAdditional(modulePrefix, splitDocComment[0], startLine),

      parameters,
      returnType: returnType.length === 0 ? undefined : returnType,
    });
  }

  docCommentRe.lastIndex = 0;

  return {
    path: path.relative(path.dirname(__dirname), modulePath).replace(/\\/g, "/"),
    name: moduleName,
    doc: moduleDoc,

    additional: parseAdditional(modulePrefix, moduleDoc, moduleDocStartLine),

    functions,
    functionNames: [...new Set(functions.map((f) => f.name))],

    get commands() {
      return getCommands(this);
    },
    get keybindings() {
      return getKeybindings(this);
    },
  } as Builder.ParsedModule;
}

/**
 * Mapping from character to corresponding VS Code keybinding.
 */
export const specialCharacterMapping = {
  "~": "s-`",
  "!": "s-1",
  "@": "s-2",
  "#": "s-3",
  "$": "s-4",
  "%": "s-5",
  "^": "s-6",
  "&": "s-7",
  "*": "s-8",
  "(": "s-9",
  ")": "s-0",
  "_": "s--",
  "+": "s-=",
  "{": "s-[",
  "}": "s-]",
  "|": "s-\\",
  ":": "s-;",
  '"': "s-'",
  "<": "s-,",
  ">": "s-.",
  "?": "s-/",
};

/**
 * RegExp for keys of `specialCharacterMapping`.
 */
export const specialCharacterRegExp = /[~!@#$%^&*()_+{}|:"<>?]/g;

/**
 * Async wrapper around the `glob` package.
 */
export function glob(pattern: string, ignore?: string) {
  return new Promise<string[]>((resolve, reject) => {
    G(pattern, { ignore }, (err, matches) => err ? reject(err) : resolve(matches));
  });
}

/**
 * A class used in .build.ts files.
 */
export class Builder {
  private _apiModules?: Builder.ParsedModule[];
  private _commandModules?: Builder.ParsedModule[];

  /**
   * Returns all modules for API files.
   */
  public async getApiModules() {
    if (this._apiModules !== undefined) {
      return this._apiModules;
    }

    const apiFiles = await glob(`${__dirname}/src/api/**/*.ts`, /* ignore= */ "**/*.build.ts"),
          apiModules = await Promise.all(
            apiFiles.map((filepath) =>
              fs.readFile(filepath, "utf-8").then((code) => parseDocComments(code, filepath))));

    return this._apiModules = apiModules.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Returns all modules for command files.
   */
  public async getCommandModules() {
    if (this._commandModules !== undefined) {
      return this._commandModules;
    }

    const commandsGlob = `${__dirname}/src/commands/**/*.ts`,
          commandFiles = await glob(commandsGlob, /* ignore= */ "**/*.build.ts"),
          allCommandModules = await Promise.all(
            commandFiles.map((filepath) =>
              fs.readFile(filepath, "utf-8").then((code) => parseDocComments(code, filepath)))),
          commandModules = allCommandModules.filter((m) => m.doc.length > 0);

    return this._commandModules = commandModules.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export declare namespace Builder {
  export interface ParsedFunction {
    readonly name: string;
    readonly nameWithDot: string;
    readonly qualifiedName: string;

    readonly startLine: number;
    readonly endLine: number;

    readonly doc: string;
    readonly properties: Record<string, string>;
    readonly summary: string;
    readonly examples: string[];
    readonly additional: AdditionalCommand[];

    readonly parameters: readonly [name: string, type: string][];
    readonly returnType: string | undefined;
  }

  export interface AdditionalCommand {
    title?: string;
    identifier?: string;
    qualifiedIdentifier?: string;
    keys?: string;
    commands?: string;
    line: number;
  }

  export interface ParsedModule {
    readonly path: string;
    readonly name: string;
    readonly doc: string;

    readonly additional: readonly AdditionalCommand[];
    readonly functions: readonly ParsedFunction[];
    readonly functionNames: readonly string[];

    readonly commands: {
      readonly id: string;
      readonly title: string;
      readonly when?: string;
    }[];

    readonly keybindings: {
      readonly title?: string;
      readonly key: string;
      readonly when: string;
      readonly command: string;
      readonly args?: any;
    }[];
  }
}

/**
 * Parses the short "`s-a-b` (mode)"-like syntax for defining keybindings into
 * a format compatible with VS Code keybindings.
 */
export function parseKeys(keys: string) {
  if (keys.length === 0) {
    return [];
  }

  return keys.split(/ *, (?=`)/g).map((keyString) => {
    const match = /^(`+)(.+?)\1 \((.+?)\)$/.exec(keyString)!,
          keybinding = match[2].trim().replace(
            specialCharacterRegExp, (m) => (specialCharacterMapping as Record<string, string>)[m]);

    // Reorder to match Ctrl+Shift+Alt+_
    let key = "";

    if (keybinding.includes("c-")) {
      key += "Ctrl+";
    }

    if (keybinding.includes("s-")) {
      key += "Shift+";
    }

    if (keybinding.includes("a-")) {
      key += "Alt+";
    }

    const remainingKeybinding = keybinding.replace(/[csa]-/g, ""),
          whenClauses = ["editorTextFocus"];

    for (const tag of match[3].split(", ")) {
      switch (tag) {
      case "normal":
      case "insert":
      case "input":
        whenClauses.push(`dance.mode == '${tag}'`);
        break;

      case "recording":
        whenClauses.push("dance.isRecording");
        break;

      case "prompt":
        whenClauses.shift();  // Remove "editorTextFocus" clause.
        whenClauses.push("inputFocus && !textInputFocus");
        break;

      default: {
        const match = /^"(!?\w+)"$/.exec(tag);

        if (match === null) {
          throw new Error("unknown keybinding tag " + tag);
        }

        whenClauses.push(match[1]);
        break;
      }
      }
    }

    key += remainingKeybinding[0].toUpperCase() + remainingKeybinding.slice(1);

    return {
      key,
      when: whenClauses.join(" && "),
    };
  });
}

/**
 * Returns all defined commands in the given module.
 */
function getCommands(module: Omit<Builder.ParsedModule, "commands">) {
  // TODO: improve conditions
  return [
    ...module.functions.map((f) => ({
      id: `dance.${f.qualifiedName}`,
      title: f.summary,
      when: "dance.mode == 'normal'",
    })),
    ...module.additional
      .concat(...module.functions.flatMap((f) => f.additional))
      .filter((a) => a.identifier !== undefined && a.title !== undefined)
      .map((a) => ({
        id: `dance.${a.qualifiedIdentifier}`,
        title: a.title!,
        when: "dance.mode == 'normal'",
      })),
  ].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Returns all defined keybindings in the given module.
 */
function getKeybindings(module: Omit<Builder.ParsedModule, "keybindings">) {
  return [
    ...module.functions.flatMap((f) => parseKeys(f.properties.keys ?? "").map((key) => ({
      ...key,
      title: f.summary,
      command: `dance.${f.qualifiedName}`,
    }))),

    ...module.additional
      .concat(...module.functions.flatMap((f) => f.additional))
      .flatMap(({ title, keys, commands, qualifiedIdentifier }) => {
        const parsedKeys = parseKeys(keys ?? "");

        if (qualifiedIdentifier !== undefined) {
          return parsedKeys.map((key) => ({
            ...key,
            title,
            command: `dance.${qualifiedIdentifier}`,
          }));
        }

        const parsedCommands =
          JSON.parse("[" + commands!.replace(/(\w+):/g, "\"$1\":") + "]") as any[];

        if (parsedCommands.length === 1) {
          let [command]: [string] = parsedCommands[0];

          if (command[0] === ".") {
            command = "dance" + command;
          }

          return parsedKeys.map((key) => ({
            ...key,
            title,
            command,
            args: parsedCommands[0][1],
          }));
        }

        return parsedKeys.map((key) => ({
          ...key,
          title,
          command: "dance.run",
          args: {
            commands: parsedCommands,
          },
        }));
      }),
  ].sort((a, b) => a.command.localeCompare(b.command));
}

/**
 * Given a multiline string, returns the same string with all lines starting
 * with an indentation `>= by` reduced by `by` spaces.
 */
export function unindent(by: number, string: string) {
  return string.replace(new RegExp(`^ {${by}}`, "gm"), "").replace(/^ +$/gm, "");
}

/**
 * Given a multiline string, returns the same string with all lines further
 * indented by `by` spaces.
 */
export function indent(by: number, string: string) {
  return string.replace(/^/gm, " ".repeat(by)).replace(/^ +$/gm, "");
}

/**
 * Updates a .build.ts file.
 */
async function buildFile(fileName: string, builder: Builder) {
  const relativeName = path.relative(__dirname, fileName),
        relativeNameWithoutBuild = relativeName.replace(/build\.ts$/, ""),
        modulePath = `./${relativeNameWithoutBuild}build`;

  // Clear module cache if any.
  delete require.cache[require.resolve(modulePath)];

  const module: { build(builder: Builder): Promise<string> } = require(modulePath),
        generatedContent = await module.build(builder);

  if (typeof generatedContent === "string") {
    // Write result of `build` to the first file we find that has the same name
    // as the build.ts file, but with any extension.
    const prefix = path.basename(relativeNameWithoutBuild),
          outputName = (await fs.readdir(path.dirname(fileName)))
            .find((path) => path.startsWith(prefix) && !path.endsWith(".build.ts"))!,
          outputPath = path.join(path.dirname(fileName), outputName),
          outputContent = await fs.readFile(outputPath, "utf-8"),
          outputContentHeader =
            /^[\s\S]+?\n.+Content below this line was auto-generated.+\n/m.exec(outputContent)![0];

    await fs.writeFile(outputPath, outputContentHeader + generatedContent, "utf-8");
  }
}

/**
 * The main entry point of the script.
 */
async function main() {
  let success = true;

  const ensureUpToDate = process.argv.includes("--ensure-up-to-date"),
        check = process.argv.includes("--check"),
        buildIndex = process.argv.indexOf("--build"),
        build = buildIndex === -1 ? "**/*.build.ts" : process.argv[buildIndex + 1];

  const contentsBefore: string[] = [],
        fileNames = [
          `${__dirname}/package.json`,
          `${__dirname}/src/commands/README.md`,
          `${__dirname}/src/commands/index.ts`,
        ];

  if (ensureUpToDate) {
    contentsBefore.push(...await Promise.all(fileNames.map((name) => fs.readFile(name, "utf-8"))));
  }

  const builder = new Builder(),
        filesToBuild = await glob(__dirname + "/" + build),
        buildErrors: unknown[] = [];

  await Promise.all(
    filesToBuild.map((path) => buildFile(path, builder).catch((e) => buildErrors.push(e))));

  if (buildErrors.length > 0) {
    console.error(buildErrors);
  }

  if (ensureUpToDate) {
    const contentsAfter = await Promise.all(fileNames.map((name) => fs.readFile(name, "utf-8")));

    for (let i = 0; i < fileNames.length; i++) {
      if (verbose) {
        console.log("Checking file", fileNames[i], "for diffs...");
      }

      // The built-in "assert" module displays a multiline diff if the strings
      // are different, so we use it instead of comparing manually.
      assert.strictEqual(contentsBefore[i], contentsAfter[i]);
    }
  }

  if (check) {
    const filesToCheck = await glob(
            `${__dirname}/src/commands/**/*.ts`, /* ignore= */ "**/*.build.ts"),
          contentsToCheck = await Promise.all(filesToCheck.map((f) => fs.readFile(f, "utf-8")));

    for (let i = 0; i < filesToCheck.length; i++) {
      const fileToCheck = filesToCheck[i],
            contentToCheck = contentsToCheck[i];

      if (contentToCheck.includes("editor.selections")) {
        console.error("File", fileToCheck, "includes forbidden access to editor.selections.");
        success = false;
      }

      if (/^(export )?namespace/m.test(contentToCheck)) {
        console.error("File", fileToCheck, "includes a non-`declare` namespace.");
        success = false;
      }
    }
  }

  return success;
}

if (require.main === module) {
  main().then((success) => {
    if (!process.argv.includes("--watch")) {
      process.exit(success ? 0 : 1);
    }

    import("chokidar").then((chokidar) => {
      const watcher = chokidar.watch([
        "**/*.build.ts",
        "src/api/*.ts",
        "src/commands/*.ts",
        "test/suite/commands/*.md",
      ], {
        ignored: "src/commands/load-all.ts",
      });

      let isGenerating = false;

      watcher.on("change", async (path) => {
        if (isGenerating) {
          return;
        }

        console.log("Change detected at " + path + ", updating generated files...");
        isGenerating = true;

        try {
          await main();
        } finally {
          isGenerating = false;
        }
      });
    });
  });
}
