import assert = require("assert");
import * as fs from "fs/promises";
import * as G from "glob";

const verbose = process.argv.includes("--verbose");

const moduleCommentRe =
  new RegExp(String.raw`\/\*\*\n`                   //     start of doc comment
           + String.raw`((?: \*(?:\n| .+\n))+?)`    // #1: doc comment
           + String.raw` \*\/\n`                    //     end of doc comment
           + String.raw`declare module \"(.+?)\"`,  // #2: module name
             "m");

const docCommentRe =
  new RegExp(String.raw`^( *)`                               // #1: indentation
           + String.raw`\/\*\*\n`                            //     start of doc comment
           + String.raw`((?:\1 \*(?:\n| .+\n))+?)`           // #2: doc comment
           + String.raw`\1 \*\/\n`                           //     end of doc comment
           + String.raw`\1export (?:async )?function (\w+)`  // #3: function name
           + String.raw`\((.*|\n[\s\S]+?^\1)\)`              // #4: parameters
           + String.raw`(?:: )?(.+)[;{]$`                    // #5: return type (optional)
           + "|"                                             //     or
           + String.raw`^ *export namespace (\w+) {\n`       // #6: namespace (alternative)
           + String.raw`^( +)`,                              // #7: namespace indentation
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

const keyMapping: Record<string, keyof parseDocComments.AdditionalCommand> = {
  Command: "commands",
  Commands: "commands",
  Identifier: "identifier",
  Identifiers: "identifier",
  Keys: "keys",
  Keybinding: "keys",
  Keybindings: "keys",
  Title: "title",
};

const valueConverter: Record<keyof parseDocComments.AdditionalCommand, (x: string) => string> = {
  commands(commands) {
    return commands.replace(/^`+|`+$/g, "");
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
};

function parseAdditional(qualificationPrefix: string, text: string) {
  const tableMatch = /(\n(?:\|.+?)+\|)+/.exec(text),
        additional: parseDocComments.AdditionalCommand[] = [];

  if (tableMatch === null) {
    return additional;
  }

  const lines = tableMatch[0].slice(1).split("\n"),
        header = lines.shift()!,
        keys = header
          .slice(2, header.length - 2)        // Remove start and end |.
          .split(" | ")                       // Split into keys.
          .map((k) => keyMapping[k.trim()]);  // Normalize keys.

  if (/^\|[-| ]+\|$/.test(lines[0])) {
    lines.shift();
  }

  for (const line of lines) {
    const obj: parseDocComments.AdditionalCommand = {},
          values = line.slice(2, line.length - 2).split(" | ");

    for (let i = 0; i < values.length; i++) {
      const key = keys[i],
            value = valueConverter[key](values[i].trim());

      obj[key] = value;
    }

    if ("identifier" in obj) {
      obj.qualifiedIdentifier = qualificationPrefix + obj.identifier;
    }

    additional.push(obj);
  }

  return additional;
}

/**
 * Parses all the doc comments of functions in the given string of TypeScript
 * code. Examples will be parsed using the given function.
 */
export function parseDocComments<T>(code: string, parseExample: (text: string) => T) {
  const moduleHeaderMatch = moduleCommentRe.exec(code);
  let moduleDoc: string,
      moduleName: string;

  if (moduleHeaderMatch !== null) {
    moduleDoc = moduleHeaderMatch[1].split("\n").map((line) => line.slice(3)).join("\n");
    moduleName = moduleHeaderMatch[2].replace(/^\.\//, "");
  } else {
    return undefined;
  }

  if (verbose) {
    console.log("Parsing doc comments in module", moduleName);
  }

  const modulePrefix = moduleName === "misc" ? "" : moduleName + ".";

  const functions: parseDocComments.ParsedFunction<T>[] = [],
        namespaces: string[] = [];
  let previousIndentation = 0;

  for (let match = docCommentRe.exec(code); match !== null; match = docCommentRe.exec(code)) {
    const indentationString = match[1],
          docCommentString = match[2],
          functionName = match[3],
          parametersString = match[4],
          returnTypeString = match[5],
          enteredNamespace = match[6],
          enteredNamespaceIndentation = match[7],
          startLine = countNewLines(code.slice(0, match.index)),
          endLine = startLine + countNewLines(match[0]);

    if (enteredNamespace !== undefined) {
      namespaces.push(enteredNamespace);
      previousIndentation = enteredNamespaceIndentation.length;

      continue;
    }

    const indentation = indentationString.length,
          namespace = namespaces.length === 0 ? undefined : namespaces.join("."),
          returnType = returnTypeString.trim(),
          parameters = parametersString
            .split(/,(?![^:]+?[}>])/g)
            .map((p) => p.trim())
            .filter((p) => p.length > 0)
            .map((p) => {
              let match: RegExpExecArray | null;

              if (match = /^(\w+\??|.+[}\]]): *(.+)$/.exec(p)) {
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

              throw new Error(`unrecognized parameter pattern ${p}`);
            }),
          docComment = docCommentString
            .split("\n")
            .map((line) => line.slice(indentation).replace(/^ \* ?/g, ""))
            .join("\n");

    if (previousIndentation > indentation) {
      namespaces.pop();
      previousIndentation = indentation;
    }

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
          doc = splitDocComment[0].replace(/\n@(param \w+|\w+) ((?:.+\n)(?: {2}.+\n)*)/g,
                                           (_, k: string, v: string) => {
                                             properties[k] = v.replace(/\n {2}/g, " ").trim();
                                             return "";
                                           }),
          summary = /((?:.+(?:\n|$))+)/.exec(doc)![0].trim().replace(/\.$/, ""),
          examplesStrings = splitDocComment.slice(1),
          examples = examplesStrings.map(parseExample),
          nameWithDot = functionName.replace(/_/g, ".");

    let qualifiedName = modulePrefix;

    if (namespace !== undefined) {
      qualifiedName += namespace + ".";
    }

    if (nameWithDot !== moduleName) {
      qualifiedName += nameWithDot;
    }

    functions.push({
      namespace,
      name: functionName,
      nameWithDot,
      qualifiedName,

      startLine,
      endLine,

      doc,
      properties,
      summary,
      examples,
      additional: parseAdditional(modulePrefix, doc),

      parameters,
      returnType: returnType.length === 0 ? undefined : returnType,
    });
  }

  docCommentRe.lastIndex = 0;

  return {
    name: moduleName,
    doc: moduleDoc,

    additional: parseAdditional(modulePrefix, moduleDoc),

    functions,
    functionNames: [...new Set(functions.map((f) => f.name))],

    get commands() {
      return getCommands(this);
    },
    get keybindings() {
      return getKeybindings(this);
    },
  } as parseDocComments.ParsedModule<T>;
}

export namespace parseDocComments {
  export interface ParsedFunction<T> {
    readonly namespace?: string;
    readonly name: string;
    readonly nameWithDot: string;
    readonly qualifiedName: string;

    readonly startLine: number;
    readonly endLine: number;

    readonly doc: string;
    readonly properties: Record<string, string>;
    readonly summary: string;
    readonly examples: T[];
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
  }

  export interface ParsedModule<T> {
    readonly name: string;
    readonly doc: string;

    readonly additional: readonly AdditionalCommand[];
    readonly functions: readonly ParsedFunction<T>[];
    readonly functionNames: readonly string[];

    readonly commands: {
      readonly id: string;
      readonly title: string;
    }[];

    readonly keybindings: {
      readonly title?: string;
      readonly key: string;
      readonly when: string;
      readonly command: string;
      readonly args?: any;
    }[];
  }

  export function parseApiExample(text: string) {

  }

  export function parseCommandExample(text: string) {

  }
}

/**
 * Mapping from character to corresponding VS Code keybinding.
 */
export const specialCharacterMapping = {
  "<": "s-,",
  ">": "s-.",
  "?": "s-/",
  "!": "s-1",
  "$": "s-4",
  "%": "s-5",
  "&": "s-7",
  "*": "s-8",
  "(": "s-9",
  ")": "s-0",
  "_": "s--",
  "|": "s-\\",
};

/**
 * RegExp for keys of `specialCharacterMapping`.
 */
export const specialCharacterRegExp = /[<>!$&()_|]/g;

/**
 * Async wrapper around the `glob` package.
 */
export function glob(pattern: string, ignore?: string) {
  return new Promise<string[]>((resolve, reject) => {
    G(pattern, { ignore }, (err, matches) => err ? reject(err) : resolve(matches));
  });
}

/**
 * Returns all modules for command files.
 */
export async function getCommandModules() {
  const commandFiles = await glob(`${__dirname}/commands/**/*.ts`, /* ignore= */ "**/*.build.ts"),
        commandModules = await Promise.all(
          commandFiles.map((path) =>
            fs.readFile(path, "utf-8")
              .then((code) => parseDocComments(code, parseDocComments.parseCommandExample))),
        );

  return (commandModules.filter((m) => m !== undefined) as parseDocComments.ParsedModule<void>[])
    .sort((a, b) => a.name!.localeCompare(b.name!));
}

/**
 * Parses the short "`s-a-b` (mode)"-like syntax for defining keybindings into
 * a format compatible with VS Code keybindings.
 */
export function parseKeys(keys: string) {
  if (keys.length === 0) {
    return [];
  }

  return keys.split(", ").map((keyString) => {
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

    const remainingKeybinding = keybinding.replace(/[csa]-/g, "");

    key += remainingKeybinding[0].toUpperCase() + remainingKeybinding.slice(1);

    return {
      key,
      when: `editorTextFocus && dance.mode == '${match[3]}'`,
    };
  });
}

/**
 * Returns all defined commands in the given module.
 */
function getCommands(module: Omit<parseDocComments.ParsedModule<any>, "commands">) {
  return [
    ...module.functions.map((f) => ({ id: `dance.${f.qualifiedName}`, title: f.summary })),
    ...module.additional
      .concat(...module.functions.flatMap((f) => f.additional))
      .filter((a) => a.identifier !== undefined && a.title !== undefined)
      .map((a) => ({ id: a.qualifiedIdentifier!, title: a.title! })),
  ].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Returns all defined keybindings in the given module.
 */
function getKeybindings(module: Omit<parseDocComments.ParsedModule<any>, "keybindings">) {
  return [
    ...module.functions.flatMap((f) => parseKeys(f.properties.keys ?? "").map((key) => ({
      ...key,
      title: f.summary,
      command: `dance.${f.qualifiedName}`,
    }))),

    ...module.additional
      .concat(...module.functions.flatMap((f) => f.additional))
      .flatMap(({ title, keys, commands }) => parseKeys(keys ?? "").map((key) => ({
        ...key,
        title,
        command: "dance.run",
        args: {
          commands: JSON.parse("[" + commands! + "]"),
        },
      }))),
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
 * The main entry point of the script.
 */
async function main() {
  let success = true;

  const ensureUpToDate = process.argv.includes("--ensure-up-to-date"),
        check = process.argv.includes("--check"),
        contentsBefore: string[] = [],
        fileNames = [`${__dirname}/commands/README.md`, `${__dirname}/commands/index.ts`];

  if (ensureUpToDate) {
    contentsBefore.push(...await Promise.all(fileNames.map((name) => fs.readFile(name, "utf-8"))));
  }

  const commandModules = await getCommandModules();

  await import("./commands/README.build").then((_) => _.build(commandModules));
  await import("./commands/load-all.build").then((_) => _.build(commandModules));

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
    const filesToCheck = await glob(`${__dirname}/commands/**/*.ts`, /* ignore= */ "**/*.build.ts"),
          contentsToCheck = await Promise.all(filesToCheck.map((f) => fs.readFile(f, "utf-8")));

    for (let i = 0; i < filesToCheck.length; i++) {
      const fileToCheck = filesToCheck[i],
            contentToCheck = contentsToCheck[i];

      if (contentToCheck.includes("editor.selections")) {
        console.error("File", fileToCheck, "includes forbidden access to editor.selections.");
        success = false;
      }
    }
  }

  return success;
}

if (require.main === module) {
  main().then((success) => process.exit(success ? 0 : 1));
}
