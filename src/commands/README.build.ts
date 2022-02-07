import { Builder, indent, parseKeys, unindent } from "../../meta";

export async function build(builder: Builder) {
  const commandModules = await builder.getCommandModules();

  return unindent(4, `
    <details>
    <summary><b>Quick reference</b></summary>
    ${toTable(commandModules)}
    </details>

    ${commandModules.map((module) => unindent(8, `
        ## [\`${module.name}\`](./${module.name}.ts)

        ${indent(4 + 8, module.doc!).trim()}

        ${module.functions.map((f) => unindent(12, `
            <a name="${module.name === "misc" ? "" : module.name}.${f.nameWithDot}" />

            ### [\`${module.name === "misc" ? "" : module.name + "."}${f.nameWithDot}\`](./${
              module.name}.ts#L${f.startLine + 1}-L${f.endLine + 1})

            ${indent(4 + 8 + 12, sanitizeDoc(f.doc)).trimStart()}
            ${(() => {
              const supportedInputs = determineSupportedInputs(f);

              return supportedInputs.length === 0
                ? ""
                : "This command:" + supportedInputs.map((x) => `\n- ${x}.`).join("") + "\n";
            })()}
            ${"keys" in f.properties ? `Default keybinding: ${f.properties["keys"]}\n` : ""}
        `).trim()).join("\n\n")}
    `).trim()).join("\n\n")}
  `);
}

function toTable(modules: readonly Builder.ParsedModule[]) {
  const rows: string[][] = modules.flatMap((module) => {
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
            keys = parseKeys(("properties" in f ? f.properties["keys"] : f.keys) ?? ""),
            link = "name" in f
              ? `#${modulePrefix + f.nameWithDot}`
              : `./${module.name}.ts#L${f.line + 1}`;

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

  return `
    <table>
      <thead>
        <tr>
          ${["Category", "Identifier", "Title", "Default keybindings"]
            .map((h) => `<th>${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.join("")}</tr>`).join("\n        ")}
      </tbody>
    </table>
  `;
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
    } else if (match = /^InputOr<(\w+)>$/.exec(type)) {
      supported.push(`takes an input of type \`${match[1]}\``);
    } else if (match = /^Argument<(.+)>( \| undefined)$/.exec(type)) {
      supported.push(`takes an argument \`${name}\` of type \`${match[1]}\``);
    } else if (name === "input") {
      supported.push(`takes an input of type \`${type}\``);
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
