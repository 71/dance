import { writeFile } from "fs/promises";

import { getCommandModules, parseDocComments } from "./src/meta";

// Shared values
// ============================================================================

const commandType = {
  type: "array",
  items: {
    type: ["array", "object", "string"],
    properties: {
      command: {
        type: "string",
      },
      args: {},
    },
    required: ["command"],
  },
};

// Package information
// ============================================================================

const pkg = (modules: parseDocComments.ParsedModule<void>[]) => ({
  name: "dance",
  displayName: "Dance",
  description: "Make those cursors dance with Kakoune-inspired keybindings.",
  version: "0.4.2",
  license: "ISC",

  publisher: "gregoire",
  author: {
    name: "Grégoire Geis",
    email: "opensource@gregoirege.is",
  },

  repository: {
    type: "git",
    url: "https://github.com/71/dance.git",
  },

  readme: "README.md",

  categories: ["Keymaps", "Other"],

  // The two properties below can be set when distributing Dance to ensure it
  // cannot execute arbitrary code (with `dance.run`) or system commands (with
  // `dance.selections.{filter,pipe}`).
  "dance.disableArbitraryCodeExecution": false,
  "dance.disableArbitraryCommandExecution": false,

  main: "./out/src/extension.js",

  engines: {
    vscode: "^1.44.0",
  },

  scripts: {
    "check": "eslint .",
    "format": "eslint . --fix",
    "generate": "ts-node ./src/meta.ts && ts-node ./package.ts",
    "vscode:prepublish": "yarn run generate && yarn run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "test": "yarn run compile && node ./out/test/run.js",
    "package": "vsce package",
    "publish": "vsce publish",
  },

  devDependencies: {
    "@types/glob": "^7.1.1",
    "@types/mocha": "^8.0.3",
    "@types/node": "^14.6.0",
    "@types/vscode": "^1.44.0",
    "@typescript-eslint/eslint-plugin": "^4.18.0",
    "@typescript-eslint/parser": "^4.18.0",
    "eslint": "^7.22.0",
    "glob": "^7.1.6",
    "mocha": "^8.1.1",
    "source-map-support": "^0.5.19",
    "ts-node": "^9.1.1",
    "typescript": "^4.2.4",
    "unexpected": "^12.0.0",
    "vsce": "^1.87.0",
    "vscode-test": "^1.3.0",
  },

  activationEvents: ["*"],
  extensionKind: ["ui", "workspace"],

  contributes: {
    configuration: {
      type: "object",
      title: "Dance",
      properties: {
        "dance.enabled": {
          type: "boolean",
          default: true,
          description: "Controls whether the Dance keybindings are enabled.",
        },
        "dance.defaultMode": {
          type: "string",
          default: "normal",
          description: "Controls which mode is set by default when an editor is created.",
        },
        "dance.modes": {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: {
              items: {
                type: "object",
                additionalProperties: {
                  type: "object",
                  properties: {
                    cursorStyle: {
                      enum: [
                        "line",
                        "block",
                        "underline",
                        "line-thin",
                        "block-outline",
                        "underline-thin",
                        "inherit",
                      ],
                      description: "Controls the cursor style.",
                    },
                    inheritFrom: {
                      type: ["string", "null"],
                      description:
                        "Controls how default configuration options are obtained for this mode. "
                        + "Specify a string to inherit from the mode with the given name, "
                        + "and null to inherit from the VS Code configuration.",
                    },
                    lineHighlight: {
                      type: ["string", "null"],
                      markdownDescription:
                        "Controls the line highlighting applied to active lines. "
                        + "Can be an hex color, a [theme color]("
                        + "https://code.visualstudio.com/api/references/theme-color) or null.",
                    },
                    lineNumbers: {
                      enum: ["off", "on", "relative", "inherit"],
                      description: "Controls the display of line numbers.",
                      enumDescriptions: [
                        "No line numbers.",
                        "Absolute line numbers.",
                        "Relative line numbers.",
                        "Inherit from `editor.lineNumbers`.",
                      ],
                    },
                    onEnterMode: {
                      ...commandType,
                      description:
                        "Controls what commands should be executed upon entering this mode.",
                    },
                    onLeaveMode: {
                      ...commandType,
                      description:
                        "Controls what commands should be executed upon leaving this mode.",
                    },
                    selectionBehavior: {
                      enum: ["caret", "character"],
                      default: "caret",
                      description: "Controls how selections behave within VS Code.",
                      markdownEnumDescriptions: [
                        "Selections are anchored to carets, which is the native VS Code behavior; "
                        + "that is, they are positioned *between* characters and can therefore be "
                        + "empty.",
                        "Selections are anchored to characters, like Kakoune; that is, they are "
                        + "positioned *on* characters, and therefore cannot be empty. "
                        + "Additionally, one-character selections will behave as if they were "
                        + "non-directional, like Kakoune.",
                      ],
                    },
                    selectionStyle: {
                      type: "object",
                      description: "The style to apply to selections.",
                      properties: (Object as any).fromEntries(
                        [
                          "backgroundColor",
                          "borderColor",
                          "borderStyle",
                          "borderWidth",
                          "borderRadius",
                        ].map((x) => [x, { type: "string" }]),
                      ),
                    },
                  },
                },
              },
            },
            additionalProperties: false,
          },
          default: {
            insert: {
              cursorStyle: "inherit",
              lineHighlight: null,
              lineNumbers: "inherit",
              selectionStyle: null,
              onEnterMode: [
                { command: ".selections.save",
                  args: {
                    style: {
                      borderColor: "$editor.selectionBackground",
                      borderStyle: "solid",
                      borderWidth: "2px",
                      borderRadius: "1px",
                    },
                    until: [
                      ["mode-did-change", { except: "insert" }],
                    ],
                  },
                },
              ],
              onLeaveMode: [
                { command: ".selections.restore",
                  args: {},
                },
              ],
            },
            normal: {
              cursorStyle: "inherit",
              lineHighlight: "editor.hoverHighlightBackground",
              lineNumbers: "relative",
              selectionStyle: null,
            },
          },
          markdownDescription:
            "Controls the different modes available in Dance.",
        },
        "dance.normalMode.lineHighlight": {
          type: ["string", "null"],
          default: "editor.hoverHighlightBackground",
          markdownDescription:
            "Controls the line highlighting applied to active lines in normal mode. "
            + "Can be an hex color, a [theme color]("
            + "https://code.visualstudio.com/api/references/theme-color) or null.",
          deprecationMessage: "Built-in modes are deprecated. Use dance.modes instead.",
        },
        "dance.insertMode.lineHighlight": {
          type: ["string", "null"],
          default: null,
          markdownDescription:
            "Controls the line highlighting applied to active lines in insert mode. "
            + "Can be an hex color, a [theme color]("
            + "https://code.visualstudio.com/api/references/theme-color) or null.",
          deprecationMessage: "Built-in modes are deprecated. Use dance.modes instead.",
        },
        "dance.normalMode.lineNumbers": {
          enum: ["off", "on", "relative", "inherit"],
          default: "relative",
          description: "Controls the display of line numbers in normal mode.",
          enumDescriptions: [
            "No line numbers.",
            "Absolute line numbers.",
            "Relative line numbers.",
            "Inherit from `editor.lineNumbers`.",
          ],
          deprecationMessage: "Built-in modes are deprecated. Use dance.modes instead.",
        },
        "dance.insertMode.lineNumbers": {
          enum: ["off", "on", "relative", "inherit"],
          default: "inherit",
          description: "Controls the display of line numbers in insert mode.",
          enumDescriptions: [
            "No line numbers.",
            "Absolute line numbers.",
            "Relative line numbers.",
            "Inherit from `editor.lineNumbers`.",
          ],
          deprecationMessage: "Built-in modes are deprecated. Use dance.modes instead.",
        },
        "dance.normalMode.cursorStyle": {
          enum: [
            "line",
            "block",
            "underline",
            "line-thin",
            "block-outline",
            "underline-thin",
            "inherit",
          ],
          default: "inherit",
          description: "Controls the cursor style in normal mode.",
          deprecationMessage: "Built-in modes are deprecated. Use dance.modes instead.",
        },
        "dance.insertMode.cursorStyle": {
          enum: [
            "line",
            "block",
            "underline",
            "line-thin",
            "block-outline",
            "underline-thin",
            "inherit",
          ],
          default: "inherit",
          description: "Controls the cursor style in insert mode.",
          deprecationMessage: "Built-in modes are deprecated. Use dance.modes instead.",
        },
        "dance.insertMode.selectionStyle": {
          type: "object",
          default: {
            borderColor: "$editor.selectionBackground",
            borderStyle: "solid",
            borderWidth: "2px",
            borderRadius: "1px",
          },
          description: "The style to apply to selections in insert mode.",
          properties: (Object as any).fromEntries(
            [
              "backgroundColor",
              "borderColor",
              "borderStyle",
              "borderWidth",
              "borderRadius",
            ].map((x) => [x, { type: "string" }]),
          ),
          deprecationMessage: "Built-in modes are deprecated. Use dance.modes instead.",
        },
        "dance.selectionBehavior": {
          enum: ["caret", "character"],
          default: "caret",
          description: "Controls how selections behave within VS Code.",
          markdownEnumDescriptions: [
            "Selections are anchored to carets, which is the native VS Code behavior; that is, "
            + "they are positioned *between* characters and can therefore be empty.",
            "Selections are anchored to characters, like Kakoune; that is, they are positioned "
            + "*on* characters, and therefore cannot be empty. Additionally, one-character "
            + "selections will behave as if they were non-directional, like Kakoune.",
          ],
          deprecationMessage: "Built-in modes are deprecated. Use dance.modes instead.",
        },
        "dance.menus": {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: {
              items: {
                type: "object",
                additionalProperties: {
                  type: "object",
                  properties: {
                    text: {
                      type: "string",
                    },
                    command: {
                      type: "string",
                    },
                    args: {
                      type: "array",
                    },
                  },
                },
              },
            },
            additionalProperties: false,
          },
          default: {
            "object": {
              items: ((command = "dance.objects.performSelection") => ({
                "b()": {
                  command,
                  args: [{ object: "parens" }],
                  text: "parenthesis block",
                },
                "B{}": {
                  command,
                  args: [{ object: "braces" }],
                  text: "braces block",
                },
                "r[]": {
                  command,
                  args: [{ object: "brackets" }],
                  text: "brackets block",
                },
                "a<>": {
                  command,
                  args: [{ object: "angleBrackets" }],
                  text: "angle block",
                },
                'Q"': {
                  command,
                  args: [{ object: "doubleQuoteString" }],
                  text: "double quote string",
                },
                "q'": {
                  command,
                  args: [{ object: "singleQuoteString" }],
                  text: "single quote string",
                },
                "g`": {
                  command,
                  args: [{ object: "graveQuoteString" }],
                  text: "grave quote string",
                },
                "w": {
                  command,
                  args: [{ object: "word" }],
                  text: "word",
                },
                "W": {
                  command,
                  args: [{ object: "WORD" }],
                  text: "WORD",
                },
                "s": {
                  command,
                  args: [{ object: "sentence" }],
                  text: "sentence",
                },
                "p": {
                  command,
                  args: [{ object: "paragraph" }],
                  text: "paragraph",
                },
                " ": {
                  command,
                  args: [{ object: "whitespaces" }],
                  text: "whitespaces",
                },
                "i": {
                  command,
                  args: [{ object: "indent" }],
                  text: "indent",
                },
                "n": {
                  command,
                  args: [{ object: "number" }],
                  text: "number",
                },
                "u": {
                  command,
                  args: [{ object: "argument" }],
                  text: "argument",
                },
                "c": {
                  command,
                  args: [{ object: "custom" }],
                  text: "custom object desc",
                },
              }))(),
            },

            ...Object.fromEntries(
              [
                ["", "go to"],
                [".extend", "extend to"],
              ].map(([suffix, desc]) => ["goto" + suffix, {
                items: {
                  "h": {
                    text: `${desc} line start`,
                    command: "dance.goto.lineStart" + suffix,
                  },
                  "l": { text: `${desc} line end`, command: "dance.goto.lineEnd" + suffix },
                  "i": {
                    text: `${desc} non-blank line start`,
                    command: "dance.goto.lineStart.nonBlank" + suffix,
                  },
                  "g": {
                    text: `${desc} first line`,
                    command: "dance.goto.firstLine" + suffix,
                  },
                  "k": {
                    text: `${desc} first line`,
                    command: "dance.goto.firstLine" + suffix,
                  },
                  "j": {
                    text: `${desc} last line`,
                    command: "dance.goto.lastLine" + suffix,
                  },
                  "e": {
                    text: `${desc} last char of last line`,
                    command: "dance.goto.lastCharacter" + suffix,
                  },
                  "t": {
                    text: `${desc} the first displayed line`,
                    command: "dance.goto.firstVisibleLine" + suffix,
                  },
                  "c": {
                    text: `${desc} the middle displayed line`,
                    command: "dance.goto.middleVisibleLine" + suffix,
                  },
                  "b": {
                    text: `${desc} the last displayed line`,
                    command: "dance.goto.lastVisibleLine" + suffix,
                  },
                  "f": {
                    text: `${desc} file whose name is selected`,
                    command: "dance.goto.selectedFile" + suffix,
                  },
                  ".": {
                    text: `${desc} last buffer modification position`,
                    command: "dance.goto.lastModification" + suffix,
                  },
                },
              }]),
            ),
          } as Record<string,
                      { items: Record<string, { text: string; command: string; args?: any[] }>}>,
        },
      },
    },
    commands: modules.flatMap((module) => module.commands.map((x) => ({
      command: x.id,
      title: x.title,
      category: "Dance",
    }))),
    keybindings: (() => {
      const keybindings = modules.flatMap((module) => module.keybindings),
            alphanum = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"],
            keysToAssign = new Set([...alphanum, ...alphanum.map((x) => `Shift+${x}`), ...",'"]);

      for (const keybinding of keybindings) {
        keysToAssign.delete(keybinding.key);
      }

      for (const keyToAssign of keysToAssign) {
        keybindings.push({
          command: "dance.ignore",
          key: keyToAssign,
          when: "editorTextFocus && dance.mode == 'normal'",
        });
      }

      return keybindings;
    })(),
  },
});

// Save to package.json
// ============================================================================

async function save() {
  await writeFile(
    `${__dirname}/package.json`,
    JSON.stringify(pkg(await getCommandModules()), undefined, 2) + "\n",
    "utf-8",
  );
}

save();
