import { parseDocComments } from "../meta";

export function build(modules: parseDocComments.ParsedModule<void>[]) {
  const keybindings = modules.flatMap((module) => module.keybindings);

  return `\nconst builtinKeybindings = ${JSON.stringify(keybindings, undefined, 2)};\n`;
}
