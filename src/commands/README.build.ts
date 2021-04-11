import { parseDocComments, parseKeys, unindent } from "../meta";

export function build(commandModules: parseDocComments.ParsedModule<void>[]) {
  return unindent(4, `
    <details>
    <summary><b>Quick reference</b></summary>
    ${toTable(commandModules)}
    </details>

    ${commandModules.map((module) => unindent(8, `
        ## [\`${module.name}\`](./${module.name}.ts)

        ${module.doc!.trim()}

        ${module.functions.map((f) => unindent(12, `
            ### [\`${module.name === "misc" ? "" : module.name + "."}${f.nameWithDot}\`](./${
              module.name}.ts#L${f.startLine + 1}-L${f.endLine + 1})

            ${f.doc}
            ${(() => {
              const supportedInputs = determineSupportedInputs(f);

              return supportedInputs.length === 0
                ? ""
                : "This command:" + supportedInputs.map((x) => `\n- ${x}.`).join("");
            })()}
        `).trim()).join("\n\n")}
    `).trim()).join("\n\n")}
  `);
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

function determineSupportedInputs(f: parseDocComments.ParsedFunction<any>) {
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
