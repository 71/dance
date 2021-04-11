import * as assert from "assert";
import { parseDocComments, unindent } from "../meta";

export function build(commandModules: parseDocComments.ParsedModule<void>[]) {
  return unindent(4, `
    ${commandModules.map((module) => unindent(8, `
        /**
         * Loads the "${module.name}" module and returns its defined commands.
         */
        async function load${capitalize(module.name!)}Module(): Promise<CommandDescriptor[]> {
          const {${
            module.functionNames
              .map((name) => "\n" + " ".repeat(16) + name + ",")
              .sort()
              .join("")}
          } = await import("./${module.name}");

          return [${
            module.functions
              .map((f) => `
                new CommandDescriptor(
                  "dance.${f.qualifiedName}",
                  ${determineFunctionExpression(f)},
                  ${determineFunctionFlags(f)},
                ),`)
              .sort()
              .join("")}${
            module.additional.concat(...module.functions.map((f) => f.additional))
              .filter((x) => x.identifier !== undefined && x.commands !== undefined)
              .map((x) => `
                new CommandDescriptor(
                  "dance.${x.qualifiedIdentifier}",
                  (_) => _.runAsync(() => commands(${x.commands})),
                  CommandDescriptor.Flags.RequiresActiveEditor,
                ),`)
              .sort()
              .join("")}
          ];
        }
    `).trim()).join("\n\n")}

    /**
     * Loads and returns all defined commands.
     */
    export async function loadCommands(): Promise<Commands> {
      const allModules = await Promise.all([${
        commandModules
          .map((module) => `\n${" ".repeat(8)}load${capitalize(module.name!)}Module(),`)
          .join("")}
      ]);

      return Object.freeze(
        Object.fromEntries(allModules.flat().map((desc) => [desc.identifier, desc])),
      );
    }
  `);
}

function capitalize(text: string) {
  return text.replace(/(\.|^)[a-z]/g, (x, dot) => x.slice(dot.length).toUpperCase());
}

function determineFunctionExpression(f: parseDocComments.ParsedFunction<any>) {
  const givenParameters: string[] = [];
  let inContext = false,
      takeArgument = false;

  for (const [name, type] of f.parameters) {
    switch (name) {

    // Arguments, input.
    case "argument":
      takeArgument = true;
      givenParameters.push("argument");
      break;

    case "input":
    case "inputOr":
      takeArgument = true;
      givenParameters.push("getInput(_, argument)");
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
      inContext = true;
      givenParameters.push("_");
      break;

    // Context (without active editor).
    case "cancellationToken":
      givenParameters.push("_.cancellationToken");
      break;

    case "extension":
      givenParameters.push("_.extensionState");
      break;

    case "modes":
      givenParameters.push("_.extensionState.modes");
      break;

    case "registers":
      givenParameters.push("_.extensionState.registers");
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

      const match = /^RegisterOr<"(\w+)"(?:, (.+))>$/.exec(type);

      assert(match !== null);

      const flags = match[2] ?? "Register.Flags.None",
            registerString = `getRegister(_, argument, ${JSON.stringify(match[1])}, ${flags})`;

      givenParameters.push(registerString);
      break;

    // Context (with active editor).
    case "document":
      givenParameters.push("_.document");
      break;

    case "selections":
      givenParameters.push("_.selections");
      break;

    // ??
    default:
      if (type.startsWith("Context")) {
        givenParameters.push("_");
      } else if (type.startsWith("Argument<")) {
        takeArgument = true;
        givenParameters.push("argument." + name);
      } else {
        throw new Error(`unknown parameter ${JSON.stringify([name, type])}`);
      }
    }
  }

  const inputParameters = ["_", ...(takeArgument ? ["argument"] : [])];
  let call = `${f.name}(${givenParameters.join(", ")})`;

  if (inContext) {
    call = `_.runAsync((_) => ${call})`;
  }

  return `(${inputParameters.join(", ")}) => ${call}`;
}

function determineFunctionFlags(f: parseDocComments.ParsedFunction<any>) {
  const flags = [] as string[];

  if (f.parameters.some(([_, t]) => ["Context"].includes(t))
      || f.parameters.some(([p]) => ["document", "selections", "editorState"].includes(p))) {
    flags.push("RequiresActiveEditor");
  }

  if (flags.length === 0) {
    return "CommandDescriptor.Flags.None";
  }

  return flags.map((flag) => "CommandDescriptor.Flags." + flag).join(" | ");
}
