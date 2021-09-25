import * as assert from "assert";
import { Builder, unindent } from "../../meta";

export async function build(builder: Builder) {
  const modules = await builder.getCommandModules();

  return unindent(4, `
    ${modules.map((module) => unindent(8, `
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
                  ${buildCommandsExpression(x)},
                  CommandDescriptor.Flags.RequiresActiveEditor | CommandDescriptor.Flags.DoNotReplay,
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
        modules
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

function determineFunctionExpression(f: Builder.ParsedFunction) {
  const givenParameters: string[] = [];
  let takeArgument = false;

  for (const [name, type] of f.parameters) {
    switch (name) {

    // Arguments, input.
    case "argument":
      takeArgument = true;
      givenParameters.push("argument");
      break;

    case "input":
      takeArgument = true;
      givenParameters.push("getInput(argument)");
      break;

    case "setInput":
      takeArgument = true;
      givenParameters.push("getSetInput(argument)");
      break;

    case "inputOr":
      takeArgument = true;
      givenParameters.push("getInputOr(argument)");
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

      const match = /^RegisterOr<"(\w+)"(?:, (.+))?>$/.exec(type);

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

  const inputParameters = ["_", ...(takeArgument ? ["argument"] : [])],
        call = `${f.name}(${givenParameters.join(", ")})`;

  return `(${inputParameters.join(", ")}) => _.runAsync((_) => ${call})`;
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

function buildCommandsExpression(f: Builder.AdditionalCommand) {
  const commands = f.commands!.replace(/ +/g, " ").replace(/ \}\]/g, ", ...argument }]");

  return `(_, argument) => _.runAsync(() => commands(${commands}))`;
}
