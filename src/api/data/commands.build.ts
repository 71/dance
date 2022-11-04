import { readFile, writeFile } from "fs/promises";
import { parseDocument as parseYamlDocument, Scalar, stringify as stringifyYaml, YAMLMap, YAMLSeq } from "yaml";
import { Builder } from "../../../meta";

/**
 * Keeps `commands.yaml` in sync with the commands defined in each file.
 */
export async function build(builder: Builder) {
  const [commandsDocSource, commandModules] = await Promise.all([
    readFile(`${__dirname}/commands.yaml`, { encoding: "utf-8" }),
    builder.getCommandModules(),
  ]);

  const commandsDoc = parseYamlDocument(commandsDocSource),
        commandDocByName = Object.fromEntries(
          (commandsDoc.contents as YAMLMap<Scalar<string>, YAMLMap>).items.map((item) =>
            [item.key.value, item.value!])),
        toRemove = new Set(Object.keys(commandDocByName));

  let anonymousCommandsDoc = commandsDoc.get("anonymous") as YAMLSeq<YAMLMap> | undefined;

  if (anonymousCommandsDoc === undefined) {
    anonymousCommandsDoc = new YAMLSeq();
  } else {
    // Re-insert at the end.
    commandsDoc.delete("anonymous");
  }

  const anonymousCommandByCommands =
    Object.fromEntries(anonymousCommandsDoc.items.map((item) =>
      [item.get("commands", false) as string, item])),
        anonymousToRemove = Object.fromEntries(
          anonymousCommandsDoc.items.map((item, i) => [item.get("commands", false) as string, i]));

  // Add all commands.
  const allCommands = commandModules.flatMap((module) => [
    ...(module.additional as (Builder.AdditionalCommand & { doc: undefined })[]),
    ...module.functions.flatMap((f) => [
      ...(f.additional as (Builder.AdditionalCommand & { doc: undefined })[]),
      {
        qualifiedIdentifier: f.qualifiedName,
        keys: f.properties["keys"],
        title: f.summary,
        commands: undefined,
        doc: f.doc,
      },
    ]),
  ]);

  for (const command of allCommands) {
    const commandId = command.qualifiedIdentifier,
          keys = command.keys?.replace(/\), /g, ")\n"),
          existingCommandDoc = commandId !== undefined
            ? commandDocByName[commandId]
            : anonymousCommandByCommands[command.commands!];

    if (existingCommandDoc === undefined) {
      const value = {} as Record<string, {}>;

      if (command.title !== undefined) {
        value["title"] = { en: command.title };
      }

      if (command.commands !== undefined) {
        value["commands"] = literalString(command.commands!);
      }

      if (keys !== undefined) {
        value["keys"] = { qwerty: literalString(keys) };
      }

      if (command.doc !== undefined) {
        value["doc"] = { en: literalString(command.doc) };
      }

      if (commandId !== undefined) {
        commandsDoc.add(commandsDoc.createPair(commandId, value));
      } else {
        anonymousCommandsDoc.add(commandsDoc.createNode(value));
      }

      continue;
    }

    if (commandId !== undefined) {
      toRemove.delete(commandId);
    } else {
      delete anonymousToRemove[command.commands!];
    }

    if (command.title !== existingCommandDoc.getIn(["title", "en"], false) as string) {
      if (command.title === undefined) {
        existingCommandDoc.delete("title");
      } else {
        existingCommandDoc.setIn(["title", "en"], command.title);
      }
    }

    if (keys !== existingCommandDoc.getIn(["keys", "qwerty"], false) as string) {
      if (keys === undefined) {
        existingCommandDoc.delete("keys");
      } else {
        existingCommandDoc.setIn(["keys", "qwerty"], literalString(keys));
      }
    }

    if (command.commands !== existingCommandDoc.get("commands", false) as string) {
      if (command.commands === undefined) {
        existingCommandDoc.delete("commands");
      } else {
        existingCommandDoc.set("commands", literalString(command.commands));
      }
    }

    if (command.doc !== existingCommandDoc.get("doc", false) as string) {
      if (command.doc === undefined) {
        existingCommandDoc.delete("doc");
      } else {
        existingCommandDoc.setIn(["doc", "en"], literalString(command.doc));
      }
    }
  }

  // Delete old commands.
  for (const commandId of toRemove) {
    commandsDoc.delete(commandId);
  }

  // Delete old anonymous commands. Since indices are sorted in
  // `anonymousToRemove`, we can start deletion from the end and avoid
  // recomputing indices.
  for (const commandsIndex of Object.values(anonymousToRemove).reverse()) {
    anonymousCommandsDoc.delete(commandsIndex);
  }

  // Sort commands by name.
  (commandsDoc.contents as YAMLMap.Parsed<Scalar.Parsed>).items
    .sort((a, b) => (a.key.value as string).localeCompare(b.key.value as string));

  // Sort anonymous commands by `commands` and `args`.
  anonymousCommandsDoc.items
    .sort((a, b) => (a.get("commands", false) as string).localeCompare(b.get("commands", false) as string));

  // Add anonymous commands at the end.
  commandsDoc.addIn(["anonymous"], anonymousCommandsDoc);

  // Normalize whitespace.
  const contents = stringifyYaml(commandsDoc, { lineWidth: 100 })
    .replace(/(?<!\n)\n([.\w]+|(?: {2})+(?:- |keys:|commands:|doc:))/g, "\n\n$1");

  if (commandsDocSource !== contents) {
    await writeFile(`${__dirname}/commands.yaml`, contents);
  }
}

function literalString(s: string) {
  return Object.assign(new Scalar(s), { type: Scalar.BLOCK_LITERAL });
}
