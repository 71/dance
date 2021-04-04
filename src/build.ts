import * as fs from "fs/promises";
import * as G from "glob";

const moduleCommentRe
  = new RegExp(String.raw`\/\*\*\n`                   //     start of doc comment
             + String.raw`((?: \*(?:\n| .+\n))+?)`    // #1: doc comment
             + String.raw` \*\/\n`                    //     end of doc comment
             + String.raw`declare module \"(.+?)\"`,  // #2: module name
               "m");

const docCommentRe
  = new RegExp(String.raw`^( *)`                               // #1: indentation
             + String.raw`\/\*\*\n`                            //     start of doc comment
             + String.raw`((?:\1 \*(?:\n| .+\n))+?)`           // #2: doc comment
             + String.raw`\1 \*\/\n`                           //     end of doc comment
             + String.raw`\1export (?:async )?function (\w+)`  // #3: function name
             + String.raw`\((.+|\n[\s\S]+?^\1)\)`              // #4: parameters
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
            .split(/,(?![^:]+?})/g)
            .map((p) => p.trim())
            .filter((p) => p.length > 0)
            .map((p) => /^(\w+\??|.+[}\]]): *(.+)$/.exec(p)!.slice(1) as [string, string]),
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
        parameter[0] = parameter[0].slice(0, parameter[0].length - 1);
        parameter[1] += " | undefined";
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

    functions.push({
      namespace,
      name: functionName,
      nameWithDot,
      qualifiedName: modulePrefix
        + (namespace === undefined ? nameWithDot : `${namespace}.${nameWithDot}`),

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
  "!": "s-1",
  "$": "s-4",
  "&": "s-7",
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
export function glob(pattern: string) {
  return new Promise<string[]>((resolve, reject) => {
    G(pattern, (err, matches) => err ? reject(err) : resolve(matches));
  });
}

/**
 * Returns all modules for command files.
 */
export async function getCommandModules() {
  const commandFiles = await glob(`${__dirname}/commands/**/*.ts`),
        commandModules = await Promise.all(
          commandFiles.map((path) =>
            fs.readFile(path, "utf-8")
              .then((code) => parseDocComments(code, parseDocComments.parseCommandExample))),
        );

  return (commandModules.filter((m) => m !== undefined) as parseDocComments.ParsedModule<void>[])
    .sort((a, b) => a.name!.localeCompare(b.name!));
}

function parseKeys(keys: string) {
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

function unindent(by: number, string: string) {
  return string.replace(new RegExp(`^ {${by}}`, "gm"), "").replace(/^ +$/gm, "");
}

function capitalize(text: string) {
  return text[0].toUpperCase() + text.slice(1);
}

function determineFunctionExpression(f: parseDocComments.ParsedFunction<any>) {
  const givenParameters: string[] = [];
  let takeCommandContext = false,
      takeContext = false,
      inContext = false;

  for (const [name, type] of f.parameters) {
    if (type === "CommandContext") {
      takeCommandContext = true;
      givenParameters.push("_");
    } else if (type === "Context") {
      takeContext = true;

      if (name === "_") {
        inContext = true;
      }

      givenParameters.push("ctx");
    } else if (["count", "repetitions"].includes(name)) {
      takeCommandContext = true;
      givenParameters.push("_." + name);
    } else if (name === "argument") {
      takeCommandContext = true;
      givenParameters.push("_.argument as any");
    } else if (type.startsWith("Register.WithFlags<")) {
      let flags = type.slice(19, type.length - 1);

      if (flags.endsWith("> | undefine")) {
        flags = flags.slice(0, flags.length - 12);
      }

      takeCommandContext = true;
      givenParameters.push("_.register?.withFlags(" + flags + ")");
    } else if (name === "register") {
      takeCommandContext = true;
      givenParameters.push("_.register");
    } else if (type === "Extension") {
      takeCommandContext = true;
      givenParameters.push("_.extensionState");
    } else if (type === "vscode.CancellationToken") {
      takeCommandContext = true;
      givenParameters.push("_.cancellationToken");
    } else if (["document", "editor", "editorState", "selections"].includes(name)) {
      takeContext = true;
      givenParameters.push("ctx." + name);
    } else if (name === "input") {
      takeCommandContext = true;
      givenParameters.push("(_.argument as any)?.input");
    } else {
      throw new Error(`unknown parameter ${JSON.stringify([name, type])}`);
    }
  }

  const inputParameters: string[] = [
    ...(takeCommandContext ? ["_: CommandContext"] : []),
    ...(takeContext ? ["ctx: Context"] : []),
  ];

  let call = `${f.name}(${givenParameters.join(", ")})`;

  if (inContext) {
    call = `ctx.run((ctx) => ${call})`;
  }

  return `(${inputParameters.join(", ")}) => ${call}`;
}

function determineSupportedInputs(f: parseDocComments.ParsedFunction<any>) {
  const supported: string[] = [];
  let requiresActiveEditor = false;

  for (const [name, type] of f.parameters) {
    if (name === "count" || name === "repetitions") {
      supported.push("may be repeated with a given number of repetitions");
    } else if (name === "register") {
      supported.push("may be given a specific register");
    } else if (name === "argument") {
      if (type.endsWith(" | undefined")) {
        supported.push(`takes an optional argument of type \`${type.slice(0, type.length - 12)}\``);
      } else {
        supported.push(`takes an argument of type \`${type}\``);
      }
    } else if (name === "input") {
      if (type.endsWith(" | undefined")) {
        supported.push(`takes an optional input of type \`${type.slice(0, type.length - 12)}\``);
      } else {
        supported.push(`takes an input of type \`${type}\``);
      }
    } else if (/^(Context|vscode.Text(Editor|Document))$/.test(type)) {
      requiresActiveEditor = true;
    }
  }

  if (!requiresActiveEditor) {
    supported.push("does not require an active text editor");
  }

  return supported.sort();
}

function toTable(modules: readonly parseDocComments.ParsedModule<any>[]) {
  const rows: string[][] = modules.flatMap((module) => {
    const modulePrefix = module.name === "misc" ? "" : module.name + ".";

    return [...module.functions]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f, i, { length }) => [
        i === 0
          ? `<td rowspan=${length}><a href="#${module.name}"><code>${module.name}</code></a></td>`
          : "",
        `<td><a href="#${(modulePrefix + f.nameWithDot).replace(/\./g, "")}"><code>${
          modulePrefix + f.nameWithDot}</code></a></td>`,
        `<td>${f.summary}</td>`,
        `<td>${
          parseKeys(f.properties.keys ?? "")
            .map(({ key, when }) => `<code>${key}</code> (<code>${when}</code>)`).join("")
        }</td>`,
      ]);
  });

  return `
    <table>
      <thead>
        <tr>
          ${["Category", "Identifier", "Title", "Keybindings"].map((h) => `<th>${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.join("")}</tr>`).join("\n        ")}
      </tbody>
    </table>
  `;
}

/**
 * Builds the various dynamic files of Dance.
 */
async function build() {
  const autogeneratedNotice = "Auto-generated by src/build.ts. Do not edit manually.";

  const commandModules = await getCommandModules();

  await fs.writeFile(`${__dirname}/commands/README.md`, unindent(4, `# Dance commands

    <!-- ${autogeneratedNotice} -->

    <details>
    <summary><b>Quick reference</b></summary>
    ${toTable(commandModules)}
    </details>

    ${commandModules.map((module) => unindent(8, `
        ## [\`${module.name}\`](./${module.name}.ts)

        ${module.doc!.trim()}

        ${module.functions.map((f) => unindent(12, `
            ### [\`${module.name === "misc" ? "" : module.name + "."}${f.nameWithDot}\`](./${
              module.name}.ts#L${f.startLine + 1}-${f.endLine + 1})

            ${f.doc}
            ${(() => {
              const supportedInputs = determineSupportedInputs(f);

              return supportedInputs.length === 0
                ? ""
                : "This command:" + supportedInputs.map((x) => `\n- ${x}.`).join("");
            })()}
        `).trim()).join("\n\n")}
    `).trim()).join("\n\n")}
  `), "utf-8");

  await fs.writeFile(`${__dirname}/commands/index.ts`, unindent(4, `// ${autogeneratedNotice}
    /* eslint-disable max-len */

    import { commands, Context } from "../api";
    import { CommandContext } from "../command";

    ${commandModules.map((module) => unindent(8, `
        /**
         * Loads the "${module.name}" module and returns its defined functions.
         */
        async function load${capitalize(module.name!)}Module() {
          const {${
            module.functionNames
              .map((name) => "\n" + " ".repeat(16) + name + ",")
              .join("")}
          } = await import("./${module.name}");

          return [${
            module.functions
              .map((f) => `\n${" ".repeat(16)}["${module.name === "misc" ? "" : module.name + "."}${
                f.nameWithDot}", ${determineFunctionExpression(f)}] as const,`)
              .join("")}${
            module.additional.concat(...module.functions.map((f) => f.additional))
              .filter((x) => x.identifier !== undefined && x.commands !== undefined)
              .map((x) => `\n${" ".repeat(16)}["${module.name === "misc" ? "" : module.name + "."}${
                x.identifier}", (ctx: Context) => ctx.run(() => commands(${
                x.commands}))] as const,`)
              .join("")}
          ];
        }
    `).trim()).join("\n\n")}

    /**
     * Loads all defined commands and returns an array of \`[functionName,
     * functionImplementation]\` pairs.
     */
    export async function loadCommands() {
      const perModuleFunctions = await Promise.all([${
        commandModules
          .map((module) => `\n${" ".repeat(8)}load${capitalize(module.name!)}Module(),`)
          .join("")}
      ]);

      return perModuleFunctions.flat(1);
    }
  `), "utf-8");
}

/**
 * The main entry point of the script.
 */
async function main() {
  const ensureUpToDate = process.argv.includes("--ensure-up-to-date"),
        contentsBefore: string[] = [],
        fileNames = [`${__dirname}/commands/README.md`, `${__dirname}/commands/index.ts`];

  if (ensureUpToDate) {
    contentsBefore.push(...await Promise.all(fileNames.map((name) => fs.readFile(name, "utf-8"))));
  }

  await build();

  if (ensureUpToDate) {
    const assert = await import("assert") as any,
          contentsAfter = await Promise.all(fileNames.map((name) => fs.readFile(name, "utf-8")));

    for (let i = 0; i < fileNames.length; i++) {
      console.log("Checking file", fileNames[i], "for diffs...");

      // The built-in "assert" module displays a multiline diff if the strings
      // are different, so we use it instead of comparing manually.
      assert.strictEqual(contentsBefore[i], contentsAfter[i]);
    }
  }
}

if (require.main === module) {
  main();
}
