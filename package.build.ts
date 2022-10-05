import type { Builder } from "./meta";

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

const builtinModesAreDeprecatedMessage =
  "Built-in modes are deprecated. Use `#dance.modes#` instead.";

const modeNamePattern = {
  pattern: /^[a-zA-Z]\w*$/.source,
  patternErrorMessage: "",
};

const colorPattern = {
  pattern: /^(#[a-fA-F0-9]{3}|#[a-fA-F0-9]{6}|#[a-fA-F0-9]{8}|\$([a-zA-Z]+(\.[a-zA-Z]+)+))$/.source,
  patternErrorMessage: "Color should be an hex color or a '$' sign followed by a color identifier.",
};

const selectionDecorationType = {
  type: "object",
  properties: {
    applyTo: {
      enum: ["all", "main", "secondary"],
      default: "all",
      description: "The selections to apply this style to.",
      enumDescriptions: [
        "Apply to all selections.",
        "Apply to main selection only.",
        "Apply to all selections except main selection.",
      ],
    },
    backgroundColor: {
      type: "string",
      ...colorPattern,
    },
    borderColor: {
      type: "string",
      ...colorPattern,
    },
    borderStyle: {
      type: "string",
    },
    borderWidth: {
      type: "string",
    },
    borderRadius: {
      type: "string",
    },
    isWholeLine: {
      type: "boolean",
      default: false,
    },
    after: {
      type: "object",
    },
    before: {
      type: "object",
    },
  },
};

// Package information
// ============================================================================

export const pkg = (modules: Builder.ParsedModule[]) => ({

  // Common package.json properties.
  // ==========================================================================

  name: "dance",
  description: "Kakoune-inspired key bindings, modes, menus and scripting.",
  version: "0.5.11",
  license: "ISC",

  author: {
    name: "Grégoire Geis",
    email: "opensource@gregoirege.is",
  },

  repository: {
    type: "git",
    url: "https://github.com/71/dance.git",
  },

  main: "./out/src/extension.js",
  browser: "./out/web/extension.js",

  engines: {
    vscode: "^1.63.0",
  },

  scripts: {
    "check": "eslint . && depcruise -v .dependency-cruiser.js src",
    "format": "eslint . --fix",
    "generate": "ts-node ./meta.ts",
    "generate:watch": "ts-node ./meta.ts --watch",
    "vscode:prepublish": "yarn run generate && yarn run compile && yarn run compile-web",
    "compile": "tsc -p ./",
    "compile:watch": "tsc -watch -p ./",
    "compile-web": "webpack --mode production --devtool hidden-source-map --config ./webpack.web.config.js",
    "compile-web:watch": "webpack --watch --config ./webpack.web.config.js",
    "test": "yarn run compile && node ./out/test/run.js",
    "package": "vsce package --allow-star-activation",
    "publish": "vsce publish --allow-star-activation",
  },

  devDependencies: {
    "@types/glob": "^7.2.0",
    "@types/mocha": "^9.1.1",
    "@types/node": "^17.0.33",
    "@types/vscode": "^1.63.0",
    "@typescript-eslint/eslint-plugin": "^5.23.0",
    "@typescript-eslint/parser": "^5.23.0",
    "@vscode/test-electron": "^2.1.3",
    "chokidar": "^3.5.3",
    "dependency-cruiser": "^11.7.0",
    "eslint": "^8.15.0",
    "glob": "^8.0.3",
    "mocha": "^10.0.0",
    "source-map-support": "^0.5.21",
    "ts-loader": "^9.3.1",
    "ts-node": "^10.8.1",
    "typescript": "^4.7.4",
    "unexpected": "^13.0.0",
    "vsce": "^2.7.0",
    "webpack": "^5.72.1",
    "webpack-cli": "^4.9.2",
    "yaml": "^2.1.1",
  },

  // VS Code-specific properties.
  // ==========================================================================

  displayName: "Dance",
  publisher: "gregoire",
  categories: ["Keymaps", "Other"],
  readme: "README.md",
  icon: "assets/dance.png",

  activationEvents: ["*"],
  extensionKind: ["ui", "workspace"],

  // Dance-specific properties.
  // ==========================================================================

  // The two properties below can be set when distributing Dance to ensure it
  // cannot execute arbitrary code (with `dance.run`) or system commands (with
  // `dance.selections.{filter,pipe}`).
  "dance.disableArbitraryCodeExecution": false,
  "dance.disableArbitraryCommandExecution": false,

  // Capabilities.
  // ==========================================================================

  capabilities: {
    untrustedWorkspaces: {
      supported: "limited",
      description:
        "Existing menu items and mode commands can only be updated if the current workspace is "
        + "trusted in order to ensure untrusted workspaces do not execute malicious commands.",
    },
    virtualWorkspaces: true,
  },

  contributes: {

    // Configuration.
    // ========================================================================

    configuration: {
      type: "object",
      title: "Dance",
      properties: {
        "dance.defaultMode": {
          type: "string",
          scope: "language-overridable",
          default: "normal",
          description: "Controls which mode is set by default when an editor is opened.",
          ...modeNamePattern,
        },
        "dance.modes": {
          type: "object",
          scope: "language-overridable",
          additionalProperties: {
            type: "object",
            propertyNames: modeNamePattern,
            properties: {
              inheritFrom: {
                type: ["string", "null"],
                description:
                  "Controls how default configuration options are obtained for this mode. "
                  + "Specify a string to inherit from the mode with the given name, "
                  + "and null to inherit from the VS Code configuration.",
                ...modeNamePattern,
              },
              cursorStyle: {
                enum: [
                  "line",
                  "block",
                  "underline",
                  "line-thin",
                  "block-outline",
                  "underline-thin",
                  "inherit",
                  null,
                ],
                description: "Controls the cursor style.",
              },
              lineHighlight: {
                type: ["string", "null"],
                markdownDescription:
                  "Controls the line highlighting applied to active lines. "
                  + "Can be an hex color, a [theme color]("
                  + "https://code.visualstudio.com/api/references/theme-color) or null.",
                deprecationMessage:
                  "`lineHighlight` is deprecated. Use `dance.modes.*.backgroundColor` instead.",
                markdownDeprecationMessage:
                  "`lineHighlight` is deprecated. Use `#dance.modes#.*.backgroundColor` instead.",
                ...colorPattern,
              },
              lineNumbers: {
                enum: ["off", "on", "relative", "inherit", null],
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
                enum: ["caret", "character", null],
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
              decorations: {
                ...selectionDecorationType,
                type: ["array", "object", "null"],
                description: "The decorations to apply to selections.",
                items: selectionDecorationType,
              },
              hiddenSelectionsIndicatorsDecoration: {
                ...selectionDecorationType,
                type: ["object", "null"],
                description:
                  "The decorations to apply to the hidden selections indicator, shown when "
                  + "some selections are below or above the lines currently shown in the editor. "
                  + "Specify an empty object {} to disable this indicator.",
              },
            },
            additionalProperties: false,
          },
          default: {
            "": {
              hiddenSelectionsIndicatorsDecoration: {
                after: {
                  color: "$list.warningForeground",
                },
                backgroundColor: "$inputValidation.warningBackground",
                borderColor: "$inputValidation.warningBorder",
                borderStyle: "solid",
                borderWidth: "1px",
                isWholeLine: true,
              },
            },
            input: {
              cursorStyle: "underline-thin",
            },
            insert: {
              onLeaveMode: [
                [".selections.save", {
                  register: " insert",
                }],
              ],
            },
            normal: {
              lineNumbers: "relative",
              decorations: {
                applyTo: "main",
                backgroundColor: "$editor.hoverHighlightBackground",
                isWholeLine: true,
              },
              onEnterMode: [
                [".selections.restore", { register: " ^", try: true }],
              ],
              onLeaveMode: [
                [".selections.save", {
                  register: " ^",
                  style: {
                    borderColor: "$editor.selectionBackground",
                    borderStyle: "solid",
                    borderWidth: "2px",
                    borderRadius: "1px",
                  },
                  until: [
                    ["mode-did-change", { include: "normal" }],
                    ["selections-did-change"],
                  ],
                }],
              ],
            },
          },
          description: "Controls the different modes available in Dance.",
        },

        "dance.menus": {
          type: "object",
          scope: "language-overridable",
          description: "Controls the different menus available in Dance.",
          additionalProperties: {
            type: "object",
            properties: {
              title: {
                type: "string",
              },
              items: {
                type: "object",
                additionalProperties: {
                  type: "object",
                  properties: {
                    text: {
                      type: "string",
                      description: "Text shown in the menu.",
                    },
                    command: {
                      type: "string",
                      description: "Command to execute on item selection.",
                    },
                    args: {
                      type: "array",
                      description: "Arguments to the command to execute.",
                    },
                  },
                  required: ["command"],
                },
              },
            },
            additionalProperties: false,
          },
          default: {
            "object": {
              title: "Select object...",
              items: ((command = "dance.seek.object") => ({
                "b()": {
                  command,
                  args: [{ input: "\\((?#inner)\\)" }],
                  text: "parenthesis block",
                },
                "B{}": {
                  command,
                  args: [{ input: "\\{(?#inner)\\}" }],
                  text: "braces block",
                },
                "r[]": {
                  command,
                  args: [{ input: "\\[(?#inner)\\]" }],
                  text: "brackets block",
                },
                "a<>": {
                  command,
                  args: [{ input: "<(?#inner)>" }],
                  text: "angle block",
                },
                'Q"': {
                  command,
                  args: [{ input: "(?#noescape)\"(?#inner)(?#noescape)\"" }],
                  text: "double quote string",
                },
                "q'": {
                  command,
                  args: [{ input: "(?#noescape)'(?#inner)(?#noescape)'" }],
                  text: "single quote string",
                },
                "g`": {
                  command,
                  args: [{ input: "(?#noescape)`(?#inner)(?#noescape)`" }],
                  text: "grave quote string",
                },
                "w": {
                  command,
                  args: [{ input: "[\\p{L}_\\d]+(?<after>[^\\S\\n]+)" }],
                  text: "word",
                },
                "W": {
                  command,
                  args: [{ input: "[\\S]+(?<after>[^\\S\\n]+)" }],
                  text: "WORD",
                },
                "s": {
                  command,
                  args: [{ input: "(?#predefined=sentence)" }],
                  text: "sentence",
                },
                "p": {
                  command,
                  args: [{ input: "(?#predefined=paragraph)" }],
                  text: "paragraph",
                },
                " ": {
                  command,
                  args: [{ input: "(?<before>[\\s]+)[^\\S\\n]+(?<after>[\\s]+)" }],
                  text: "whitespaces",
                },
                "i": {
                  command,
                  args: [{ input: "(?#predefined=indent)" }],
                  text: "indent",
                },
                "n": {
                  command,
                  args: [{ input: "(?#singleline)-?[\\d_]+(\\.[0-9]+)?([eE]\\d+)?" }],
                  text: "number",
                },
                "u": {
                  command,
                  args: [{ input: "(?#predefined=argument)" }],
                  text: "argument",
                },
                "c": {
                  command,
                  text: "custom object desc",
                },
              }))(),
            },

            "goto": {
              title: "Go...",
              items: {
                "h": {
                  text: "to line start",
                  command: "dance.select.lineStart",
                },
                "l": {
                  text: "to line end",
                  command: "dance.select.lineEnd",
                },
                "i": {
                  text: "to non-blank line start",
                  command: "dance.select.lineStart",
                  args: [{ skipBlank: true }],
                },
                "gk": {
                  text: "to first line",
                  command: "dance.select.lineStart",
                  args: [{ count: 1 }],
                },
                "j": {
                  text: "to last line",
                  command: "dance.select.lastLine",
                },
                "e": {
                  text: "to last char of last line",
                  command: "dance.select.lineEnd",
                  args: [{ count: 2 ** 31 - 1 }],
                },
                "t": {
                  text: "to first displayed line",
                  command: "dance.select.firstVisibleLine",
                },
                "c": {
                  text: "to middle displayed line",
                  command: "dance.select.middleVisibleLine",
                },
                "b": {
                  text: "to last displayed line",
                  command: "dance.select.lastVisibleLine",
                },
                "a": {
                  text: "to last buffer",
                  command: "workbench.action.openPreviousRecentlyUsedEditorInGroup",
                },
                "f": {
                  text: "to file whose name is selected",
                  command: "dance.selections.open",
                },
                ".": {
                  text: "to last buffer modification position",
                  command: "dance.selections.restore",
                  args: [{ register: " insert" }],
                },
              },
            },

            "view": {
              title: "View",
              items: {
                // AFAIK, we can't implement these yet since VS Code only
                // exposes vertical view ranges:
                // - m, center cursor horizontally
                // - h, scroll left
                // - l, scroll right
                "vc": {
                  text: "center cursor vertically",
                  command: "dance.view.line",
                  args: [{ at: "center" }],
                },
                "t": {
                  text: "cursor on top",
                  command: "dance.view.line",
                  args: [{ at: "top" }],
                },
                "b": {
                  text: "cursor on bottom",
                  command: "dance.view.line",
                  args: [{ at: "bottom" }],
                },
                "j": {
                  text: "scroll down",
                  command: "editorScroll",
                  args: [{ to: "down", by: "line", revealCursor: true }],
                },
                "k": {
                  text: "scroll up",
                  command: "editorScroll",
                  args: [{ to: "up", by: "line", revealCursor: true }],
                },
              },
            },
          } as Record<string,
                      { items: Record<string, { text: string; command: string; args?: any[] }>}>,
        },

        // Deprecated configuration:
        "dance.enabled": {
          type: "boolean",
          default: true,
          description: "Controls whether the Dance keybindings are enabled.",
          deprecationMessage: "dance.enabled is deprecated; disable the Dance extension instead.",
        },

        "dance.normalMode.lineHighlight": {
          type: ["string", "null"],
          default: "editor.hoverHighlightBackground",
          markdownDescription:
            "Controls the line highlighting applied to active lines in normal mode. "
            + "Can be an hex color, a [theme color]("
            + "https://code.visualstudio.com/api/references/theme-color) or null.",
          markdownDeprecationMessage: builtinModesAreDeprecatedMessage,
        },
        "dance.insertMode.lineHighlight": {
          type: ["string", "null"],
          default: null,
          markdownDescription:
            "Controls the line highlighting applied to active lines in insert mode. "
            + "Can be an hex color, a [theme color]("
            + "https://code.visualstudio.com/api/references/theme-color) or null.",
          markdownDeprecationMessage: builtinModesAreDeprecatedMessage,
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
          markdownDeprecationMessage: builtinModesAreDeprecatedMessage,
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
          markdownDeprecationMessage: builtinModesAreDeprecatedMessage,
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
          markdownDeprecationMessage: builtinModesAreDeprecatedMessage,
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
          markdownDeprecationMessage: builtinModesAreDeprecatedMessage,
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
          markdownDeprecationMessage: builtinModesAreDeprecatedMessage,
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
          markdownDeprecationMessage: builtinModesAreDeprecatedMessage,
        },
      },
    },

    // Views.
    // ========================================================================

    viewsContainers: {
      activitybar: [
        {
          id: "dance",
          title: "Dance",
          icon: "assets/dance-white.svg",
        },
      ],
    },

    views: {
      dance: [
        {
          id: "registers",
          name: "Registers",
        },
      ],
    },

    // Commands.
    // ========================================================================

    commands: modules.flatMap((module) => module.commands.map((x) => ({
      command: x.id,
      title: x.title,
      category: "Dance",
    }))),

    menus: {
      commandPalette: modules.flatMap((module) => module.commands.map((x) => ({
        command: x.id,
        when: x.when,
      }))),
    },

    // Keybindings.
    // ========================================================================

    // TODO: unassign default keybindings, and force the user to explicitly set
    // them up.
    keybindings: (() => {
      const keybindings = modules.flatMap((module) => module.keybindings),
            alphanum = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"],
            keysToAssign = new Set([
              ...alphanum,
              ...alphanum.map((x) => `Shift+${x}`),
              ...",'-",
              "Shift+=",
              "Shift+Space",
              "NumPad_Add",
              "NumPad_Subtract",
            ]);

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

export async function build(builder: Builder) {
  const fs = await import("fs/promises");

  await fs.writeFile(
    `${__dirname}/package.json`,
    JSON.stringify(pkg(await builder.getCommandModules()), undefined, 2) + "\n",
    "utf-8",
  );
}
