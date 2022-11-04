import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import { Builder, parseKeys, unindent } from "../../meta";

type LanguageId = string;
type LayoutId = string;

type Command = {
  readonly title?: Record<LanguageId, string>;
  readonly keys?: Record<LayoutId, string>;
  readonly commands?: string;
  readonly doc?: Record<LanguageId, string>;
};

type Commands = {
  readonly [id: string]: Command;
} & {
  readonly anonymous: readonly Command[];
};

type Language = {
  readonly title: string;
  readonly layouts: readonly LayoutId[];
};

type Languages = {
  readonly [id: LanguageId]: Language;
}

type Layout = {
  readonly fallback: string;
};

type Layouts = {
  readonly [id: LayoutId]: Layout;
}

export async function build(builder: Builder) {
  const resolveData = <F extends string>(filename: F) => {
    return resolve(__dirname, "..", "api", "data", filename) as `${string}${F}`;
  };

  await builder.waitFor(resolveData("commands.build.ts"));

  const [commands, languages, layouts, commandModules] = await Promise.all(
    [
      ...["commands.yaml", "languages.yaml", "layouts.yaml"].map(async (filename) => {
        const contents = await readFile(resolveData(filename), { encoding: "utf-8" });

        return parseYaml(contents, { schema: "core" }) as Record<string, object>;
      }),
      builder.getCommandModules(),
    ],
  ) as [Commands, Languages, Layouts, Builder.ParsedModule[]];

  const renderer = new Renderer(commandModules, commands, languages, layouts);

  await Promise.all(
    Object.entries(languages).flatMap(([languageId, language]) => {
      const suffix = languageId === "en" ? ".md" : `.${languageId}.md`;

      return language.layouts.map(async (layoutId) =>
        await writeFile(
          resolve(__dirname, "layouts", layoutId + suffix), unindent(12)`
            # Commands: \`${layoutId}\`

            ${renderer.renderLayout(languageId, layoutId)}
          `.trimStart(),
        ),
      );
    }),
  );

  return unindent(4)`
    # Layouts

    Dance uses [VS Code keybindings](https://code.visualstudio.com/docs/getstarted/keybindings)
    to define command key-bindings. As such, its key-bindings must be configured differently
    depending on the keyboard layout. The following layouts _will be_\\* supported:

    ${Object.entries(languages)
      .map(([id, language]) => `- ${language.title}:\n${
        language.layouts
          .map((layout) => `  * [${layout}](./layouts/${layout}${id === "en" ? "" : `.${id}`}.md)`)
          .sort()
          .join("\n")}`)
      .sort()
      .join("\n")}

    \\*: pending a future update; right now, only the default \`qwerty\` is supported.

    # Default commands (English, \`qwerty\`)

    ${renderer.renderLayout("en", "qwerty", ".")}
  `;
}

class Renderer {
  public readonly anonymousCommands: Record<string, Command> = {};
  public readonly modulesAndCommands: (readonly [Builder.ParsedModule, readonly Command[]])[];

  public constructor(
    public readonly modules: readonly Builder.ParsedModule[],
    public readonly commands: Commands,
    public readonly languages: Languages,
    public readonly layouts: Layouts,
  ) {
    for (const command of commands.anonymous) {
      this.anonymousCommands[command.commands!] = command;
    }

    const moduleByCommandId = new Map(
      [
        ...modules.flatMap((module) =>
          module.functions.map((f) => [f.qualifiedName, module] as const)),
        ...modules.flatMap((module) => [
          ...module.additional,
          ...module.functions.flatMap((f) => f.additional),
        ].map((x) => [x.qualifiedIdentifier ?? x.commands!, module] as const)),
      ],
    );
    const commandsByModuleName = new Map(modules.map((module) => [module.name, [] as Command[]]));

    for (const [commandId, module] of moduleByCommandId) {
      commandsByModuleName.get(module.name)!
        .push(commands[commandId] ?? this.anonymousCommands[commandId]);
    }

    this.modulesAndCommands = [...commandsByModuleName]
      .map(([moduleName, commands]) => [modules.find((x) => x.name === moduleName)!, commands] as const);
  }

  public renderLayout(language: LanguageId, layout: LayoutId, commandsDir = "..") {
    return unindent(6)`
      <details>
      <summary><b>Quick reference</b></summary>
      ${this._renderQuickRefTable(language, layout, commandsDir)}
      </details>

      ${this.modulesAndCommands.map(([module]) => unindent(10)`
          ## [\`${module.name}\`](${commandsDir}/${module.name}.ts)

          ${module.doc!.trim()}

          ${module.functions.map((f) => unindent(14)`
              <a name="${module.name === "misc" ? "" : module.name + "."}${f.nameWithDot}" />

              ### [\`${module.name === "misc" ? "" : module.name + "."}${f.nameWithDot}\`](${
                commandsDir}/${module.name}.ts#L${f.startLine + 1}-L${f.endLine + 1})

              ${sanitizeDoc(
                  this._resolveProp("doc", this.commands[f.qualifiedName], language)!)}
              ${(() => {
                const supportedInputs = determineSupportedInputs(f);

                return supportedInputs.length === 0
                  ? ""
                  : "This command:" + supportedInputs.map((x) => `\n- ${x}.`).join("") + "\n";
              })()}
              ${"keys" in f.properties ? `Default keybinding: ${this._resolveKeys(this.commands[f.qualifiedName], layout)}\n` : ""}
          `.trim()).join("\n\n")}
      `.trim()).join("\n\n")}
    `.trimStart();
  }

  private _renderQuickRefTable(language: LanguageId, layout: LayoutId, commandsDir: string) {
    const rows: string[][] = this.modulesAndCommands.flatMap(([module]) => {
      const modulePrefix = module.name === "misc" ? "" : module.name + ".",
            allCommands = [] as (Builder.ParsedFunction | Builder.AdditionalCommand)[];

      allCommands.push(...module.functions);
      allCommands.push(
        ...module.additional
          .concat(...module.functions.flatMap((f) => f.additional))
          .filter((a) => a.qualifiedIdentifier && a.identifier),
      );

      allCommands.sort((a, b) => {
        const aName = "name" in a ? a.name : a.qualifiedIdentifier!,
              bName = "name" in b ? b.name : b.qualifiedIdentifier!;

        return aName.localeCompare(bName);
      });

      return allCommands.map((f, i, { length }) => {
        const identifier = "name" in f ? modulePrefix + f.nameWithDot : f.qualifiedIdentifier,
              summary = "summary" in f ? f.summary : f.title,
              command = "summary" in f ? this.commands[f.qualifiedName] : this.commands[f.qualifiedIdentifier!] ?? this.anonymousCommands[f.commands!],
              keys = parseKeys(this._resolveKeys(command, layout) ?? ""),
              link = "name" in f
                ? `#${modulePrefix + f.nameWithDot}`
                : `${commandsDir}/${module.name}.ts#L${f.line + 1}`;

        return [
          i === 0
            ? `<td rowspan=${length}><a href="#${module.name}"><code>${module.name}</code></a></td>`
            : "",
          `<td><a href="${link}"><code>${identifier}</code></a></td>`,
          `<td>${summary}</td>`,
          `<td>${
            keys.map(({ key, when }) => `<code>${key}</code> (<code>${when}</code>)`).join("")
          }</td>`,
        ];
      });
    });

    return unindent(6)`
      <table>
      <thead>
      <tr>
      ${["Category", "Identifier", "Title", "Default keybindings"]
          .map((h) => `<th>${h}</th>`).join("")}
      </tr>
      </thead>
      <tbody>
      ${rows.map((row) => `<tr>${row.join("")}</tr>`).join("\n")}
      </tbody>
      </table>
    `.trimStart();
  }

  private _resolveProp(prop: "title" | "doc", command: Command, language: LanguageId) {
    return command[prop]?.[language] ?? command[prop]?.["en"];
  }

  private _resolveKeys(command: Command, layout: LayoutId) {
    const keysByLayout = command.keys;

    if (keysByLayout === undefined) {
      return undefined;
    }

    for (;;) {
      if (keysByLayout[layout] !== undefined) {
        return keysByLayout[layout];
      }

      layout = this.layouts[layout].fallback;
    }
  }
}

function determineSupportedInputs(f: Builder.ParsedFunction) {
  const supported: string[] = [];
  let requiresActiveEditor = false;

  for (const [name, type] of f.parameters) {
    let match: RegExpExecArray | null;

    if (name === "count" || name === "repetitions") {
      supported.push("may be repeated with a given number of repetitions");
    } else if (match = /^RegisterOr<"(\w+)"(?:, .+)?>$/.exec(type)) {
      supported.push(`accepts a register (by default, it uses \`${match[1]}\`)`);
    } else if (match = /^Argument<(.+)>( \| undefined)$/.exec(type)) {
      supported.push(`takes an argument \`${name}\` of type \`${match[1]}\``);
    } else if (match = /^InputOr<"(\w+?)", (.+)>/.exec(type)) {
      supported.push(`takes an input \`${match[1]}\` of type \`${match[2]}\``);
    } else if (name === "argument") {
      supported.push(`accepts an argument of type \`${type}\``);
    } else if (/^(Context|vscode.Text(Editor|Document))$/.test(type) || name === "selections") {
      requiresActiveEditor = true;
    }
  }

  if (!requiresActiveEditor) {
    supported.push("does not require an active text editor");
  }

  return supported.sort();
}

function sanitizeDoc(doc: string) {
  // In tables, escape pipes:
  doc = doc.replace(
    /^\|(.+?)\|$/gm,
    (line: string) => line.replace(/(?<! )\|(?! )/g, "\\|"),
  );

  return doc;
}
