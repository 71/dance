import { Builder } from "../../../meta";

export async function build(builder: Builder) {
  const modules = await builder.getCommandModules(),
        keybindings = modules.flatMap((module) => module.keybindings),
        keybindingsCode = JSON.stringify(keybindings, undefined, 2)
          .replace(/"(\w+)":/g, "$1:")
          .replace(/([0-9a-z}"])$/gm, "$1,");

  return `\nconst builtinKeybindings = ${keybindingsCode};\n`;
}
