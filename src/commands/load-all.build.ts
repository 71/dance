import assert from "assert";
import { Builder, unindent } from "../../meta";

export async function build(builder: Builder) {
  const modules = await builder.getCommandModules(),
        availableCommands = new Set(
          modules.flatMap((m) => m.functions.map((f) => "dance." + f.qualifiedName))),
        additionalCommands = [] as Builder.AdditionalCommand[];

  // Build list of additional commands, only adding new commands when all their
  // dependencies have already been added as well.
  let unorderedAdditionalCommands = modules.flatMap((module) =>
    module.additional
      .concat(...module.functions.map((f) => f.additional))
      .filter((x) => x.identifier !== undefined && x.commands !== undefined));

  while (unorderedAdditionalCommands.length > 0) {
    const commandsWithMissingDependencies = [] as Builder.AdditionalCommand[];

    outer: for (const command of unorderedAdditionalCommands) {
      const dependencies = command.commands!.matchAll(/"(\.[\w.-]+)"/g);

      for (const match of dependencies) {
        const dependency = "dance" + match[1];

        if (!availableCommands.has(dependency)) {
          commandsWithMissingDependencies.push(command);

          continue outer;
        }
      }

      availableCommands.add(`dance.${command.qualifiedIdentifier}`);
      additionalCommands.push(command);
    }

    if (unorderedAdditionalCommands.length === commandsWithMissingDependencies.length) {
      throw new Error(
          `cannot resolve dependencies: ${JSON.stringify(commandsWithMissingDependencies)}`);
    }
    unorderedAdditionalCommands = commandsWithMissingDependencies;
  }

  return unindent(4)`
    ${modules.map((module) => unindent(8)`
        import {${
          module.functions
            .map((f) => `\n  ${f.name} as ${f.qualifiedName.replace(/\./g, "_")},`)
            .sort()
            .join("")}
        } from "./${module.name}";
    `.trim()).join("\n\n")}

    /**
     * All defined Dance commands.
     */
    export const commands: Commands = function () {
      // Normal commands.
      const commands = {${
        modules
          .flatMap((m) => m.functions)
          .map((f) => unindent(8)`
            "dance.${f.qualifiedName}": new CommandDescriptor(
              "dance.${f.qualifiedName}",
              ${determineFunctionExpression(f)},
              ${determineFunctionFlags(f)},
            ),`)
          .sort()
          .join("")}
      };

      // Additional commands.${
        additionalCommands
          .map((x) => unindent(10)`
            describeAdditionalCommand(
              commands,
              "dance.${x.qualifiedIdentifier}",
              CommandDescriptor.Flags.RequiresActiveEditor | CommandDescriptor.Flags.DoNotReplay,
              [${x.commands}],
            );`)
          .join("")}

      // Finalize \`commands\`.
      return Object.freeze(commands);
    }();
  `;
}

function determineFunctionExpression(f: Builder.ParsedFunction) {
  const givenParameters: string[] = [];
  let takeArgument = false;
  let takeDocumentTree = false;

  for (const [name, type] of f.parameters) {
    let match: RegExpExecArray | null;

    switch (name) {

    // Arguments, input.
    case "argument":
      takeArgument = true;
      givenParameters.push("argument");
      break;

    case "direction":
      takeArgument = true;
      givenParameters.push("getDirection(argument)");
      break;

    case "shift":
      takeArgument = true;
      givenParameters.push("getShift(argument)");
      break;

    // Implicit context.
    case "_":
      givenParameters.push("_");
      break;

    // Context (without active editor).
    case "cancellationToken":
      givenParameters.push("_.cancellationToken");
      break;

    case "extension":
      givenParameters.push("_.extension");
      break;

    case "modes":
      givenParameters.push("_.extension.modes");
      break;

    case "registers":
      givenParameters.push("_.extension.registers");
      break;

    case "treeSitter":
      givenParameters.push("_.extension.treeSitterOrThrow()");
      break;

    case "documentTree":
      takeDocumentTree = true;
      givenParameters.push("documentTree");
      break;

    case "count":
      takeArgument = true;
      givenParameters.push("getCount(_, argument)");
      break;

    case "repetitions":
      takeArgument = true;
      givenParameters.push("getRepetitions(_, argument)");
      break;

    case "register":
      takeArgument = true;

      match = /^RegisterOr<"(\w+)"(?:, (.+))?>$/.exec(type);

      assert(match !== null);

      const flags = match[2]?.replace(/[[\]]/g, "").replace(/, /g, " | ") ?? "Register.Flags.None",
            flagsType = match[2]?.startsWith("[") ? `<${match[2]}>` : "",
            defaultRegister = JSON.stringify(match[1]),
            registerString = `getRegister${flagsType}(_, argument, ${defaultRegister}, ${flags})`;

      givenParameters.push(registerString);
      break;

    // Context (with active editor).
    case "document":
      givenParameters.push("_.document");
      break;

    case "selections":
      if (type === "readonly vscode.Selection[]") {
        givenParameters.push("_.selections");
      } else if (type === "vscode.Selection[]") {
        givenParameters.push("_.selections.slice()");
      } else {
        throw new Error(`unknown parameter ${JSON.stringify([name, type])}`);
      }
      break;

    // ??
    default:
      if (type.startsWith("Context")) {
        givenParameters.push("_");
      } else if (type.startsWith("Argument<")) {
        takeArgument = true;
        givenParameters.push("argument[" + JSON.stringify(name) + "]");
      } else if (match = /^InputOr<("\w+"),.+>$/.exec(type)) {
        takeArgument = true;
        givenParameters.push(`getInputOr(${match[1]}, argument)`);
      } else {
        throw new Error(`unknown parameter ${JSON.stringify([name, type])}`);
      }
    }
  }

  const inputParameters = ["_", ...(takeArgument ? ["argument"] : [])];
  let call = `${f.qualifiedName.replace(/\./g, "_")}(${givenParameters.join(", ")})`;

  if (takeDocumentTree) {
    call =
      `_.extension.treeSitterOrThrow().withDocumentTree(_.document, (documentTree) => ${call})`;
  }

  return `(${inputParameters.join(", ")}) => _.runAsync(async (_) => await ${call})`;
}

function determineFunctionFlags(f: Builder.ParsedFunction) {
  const flags = [] as string[];

  if (f.parameters.some(([_, t]) => ["Context"].includes(t))
      || f.parameters.some(([p]) => ["document", "selections"].includes(p))) {
    flags.push("RequiresActiveEditor");
  }

  if ("noreplay" in f.properties) {
    flags.push("DoNotReplay");
  }

  if (flags.length === 0) {
    return "CommandDescriptor.Flags.None";
  }

  return flags.map((flag) => "CommandDescriptor.Flags." + flag).join(" | ");
}

function additionalCommandName(f: Builder.AdditionalCommand) {
  return f.qualifiedIdentifier!.replace(/[.-]/g, "_");
}
