// Save to package.json
// ============================================================================

import { Builder, generateIgnoredKeybinds } from "../../meta";
import * as fs from "fs/promises";
import { extensionId } from "../../src/utils/constants";

const version = "0.1.1",
      preRelease = 1;

export const pkg = (modules: Builder.ParsedModule[]) => ({

  // Common package.json properties.
  // ==========================================================================

  name: "dance-helix",
  description: "Helix keybindings for Dance",
  version,
  license: "ISC",
  extensionDependencies: [extensionId],
  author: {
    name: "Grégoire Geis",
    email: "opensource@gregoirege.is",
  },

  contributors: [
    {
      name: "Rémi Lavergne",
      url: "https://github.com/Strackeror",
    },
  ],

  repository: {
    type: "git",
    url: "https://github.com/71/dance.git",
  },

  engines: {
    vscode: "^1.63.0",
  },

  displayName: "Dance - Helix keymap",
  publisher: "gregoire",
  categories: ["Keymaps", "Other"],
  readme: "README.md",
  icon: "assets/dance.png",
  extensionKind: ["ui", "workspace"],

  scripts: {
    "package": "vsce package --allow-star-activation",
    "publish": "vsce publish --allow-star-activation",
    "package:pre": `vsce package --allow-star-activation --pre-release --no-git-tag-version --no-update-package-json ${version.replace(/\d+$/, "$&" + preRelease.toString().padStart(3, "0"))}`,
    "publish:pre": `vsce publish --allow-star-activation --pre-release --no-git-tag-version --no-update-package-json ${version.replace(/\d+$/, "$&" + preRelease.toString().padStart(3, "0"))}`,
  },

  devDependencies: {
    "@vscode/vsce": "^3.3.2",
  },

  files: [
    "LICENSE",
    "README.md",
    "assets/dance.png",
  ],

  contributes: {
    configurationDefaults: {
      "dance.defaultMode": "helix/normal",
      "dance.modes": {
        "helix/insert": {
          lineNumbers: "on",
          onLeaveMode: [
            [".selections.save", {
              register: " insert",
            }],
          ],
        },
        "helix/select": {
          lineNumbers: "on",
          cursorStyle: "block",
          selectionBehavior: "character",
        },
        "helix/normal": {
          lineNumbers: "relative",
          cursorStyle: "block",
          selectionBehavior: "character",
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

    "dance.menus": {
        match: {
          title: "Match",
          items: {
            // Should be jump in normal mode, extend in select mode, but jump for seek.enclosing is not implemented
            "m": { command: "dance.seek.enclosing", text: "Goto matching bracket" },
            "a": { command: "dance.openMenu", args: [{ menu: "object", title: "Match around" }], text: "Select around object" },
            "i": { command: "dance.openMenu", args: [{ menu: "object", title: "Match inside", pass: [{ inner: true }] }], text: "Select inside object" },
            "s": { command: "dance.openMenu", args: [{ menu: "surround", title: "Surround object" }], text: "Surround object" },
            "r": { command: "dance.openMenu", args: [{ menu: "resurround", title: "Resurround object" }], text: "Resurround object" },
            "d": { command: "dance.openMenu", args: [{ menu: "unsurround", title: "Unsurround object" }], text: "Unsurround object" },
          },
        },

        object: {
          title: "Select object...",
          items: ((command = "dance.seek.object") => ({
            "()": { command, args: [{ input: "\\((?#inner)\\)" }], text: "parenthesis block" },
            "{}": { command, args: [{ input: "\\{(?#inner)\\}" }], text: "braces block" },
            "[]": { command, args: [{ input: "\\[(?#inner)\\]" }], text: "brackets block" },
            "<>": { command, args: [{ input: "<(?#inner)>" }], text: "angle block" },
            '"': { command, args: [{ input: "(?#noescape)\"(?#inner)(?#noescape)\"" }], text: "double quote string" },
            "'": { command, args: [{ input: "(?#noescape)'(?#inner)(?#noescape)'" }], text: "single quote string" },
            "`": { command, args: [{ input: "(?#noescape)`(?#inner)(?#noescape)`" }], text: "grave quote string" },
            "w": { command, args: [{ input: "[\\p{L}_\\d]+(?<after>[^\\S\\n]+)" }], text: "word" },
            "W": { command, args: [{ input: "[\\S]+(?<after>[^\\S\\n]+)" }], text: "WORD" },
            "p": { command, args: [{ input: "(?#predefined=paragraph)" }], text: "paragraph" },
            "a": { command, args: [{ input: "(?#predefined=argument)" }], text: "argument" },
            "!": { command, text: "custom object desc" },
          }))(),
        },

      surround: {
        title: "Surround object with...",
        items: (() => {
          const pairs = {
            "()": "parenthesis block",
            "{}": "braces block",
            "[]": "brackets block",
            "<>": "angle block",
            '"': "double quote string",
            "'": "single quote string",
            "`": "grave quote string",
          };

          return Object.fromEntries(
            Object.entries(pairs)
              .map(([key, description]) => {
                const [open, close] = key.length === 1 ? [key, key] : Array.from(key);
                const commands = [
                  { command: "dance.edit.insert", args: { shift: "extend", text: open, where: "start" } },
                  { command: "dance.edit.insert", args: { shift: "extend", text: close, where: "end" } },
                ];

                return [key, { command: "dance.run", args: { commands }, text: description }];
              }),
          );
        })(),
      },

      resurround: {
        title: "Resurround object...",
        items: (() => {
          const pairs = {
            "()": "parenthesis block",
            "{}": "braces block",
            "[]": "brackets block",
            "<>": "angle block",
            '"': "double quote string",
            "'": "single quote string",
            "`": "grave quote string",
          };
          const enclosing = ["\\(", "\\)", "\\{", "\\}", "\\[", "\\]", "<", ">", '"', '"', "'", "'", "`", "`"];

          return Object.fromEntries(
            Object.entries(pairs)
              .map(([key, description]) => {
                const [open, close] = key.length === 1 ? [key, key] : Array.from(key);
                const commands = [
                  { command: "dance.seek.enclosing", args: { pairs: enclosing } },
                  { command: "dance.edit.insert", args: { text: open, where: "start" } },
                  { command: "dance.edit.insert", args: { text: close, where: "end" } },
                  { command: "dance.selections.reduce.edges" },
                  { command: "dance.edit.delete" },
                  { command: "dance.selections.clear.secondary" },
                ];

                return [key, { command: "dance.run", args: { commands }, text: description }];
              }),
          );
        })(),
      },

      unsurround: {
        title: "Unsurround object...",
        items: (() => {
          const pairs = {
            "m": { description: "enclosing pair", input: undefined },
            "()": { description: "parenthesis block", input: "\\((?#inner)\\)" },
            "{}": { description: "braces block", input: "\\{(?#inner)\\}" },
            "[]": { description: "brackets block", input: "\\[(?#inner)\\]" },
            "<>": { description: "angle block", input: "<(?#inner)>" },
            '"': { description: "double quote string", input: '(?#noescape)"(?#inner)(?#noescape)"' },
            "'": { description: "single quote string", input: "(?#noescape)'(?#inner)(?#noescape)'" },
            "`": { description: "grave quote string", input: "(?#noescape)`(?#inner)(?#noescape)`" },
          };

          return Object.fromEntries(
            Object.entries(pairs)
              .map(([key, { description, input }]) => {
                const seekCommand = input === undefined
                  ? { command: "dance.seek.enclosing" }
                  : { command: "dance.seek.object", args: [{ input }] };
                const commands = [
                  seekCommand,
                  { command: "dance.selections.reduce.edges" },
                  { command: "dance.edit.delete" },
                  { command: "dance.selections.clear.secondary" },
                ];

                return [key, { command: "dance.run", args: { commands }, text: description }];
              }),
          );
        })(),
      },

        view: {
          "title": "View",
          "items": {
            "cz": { text: "Align view center", command: "dance.view.line", args: [{ "at": "center" }] },
            "t": { text: "Align view top", command: "dance.view.line", args: [{ "at": "top" }] },
            "b": { text: "Align view bottom", command: "dance.view.line", args: [{ "at": "bottom" }] },
            "k": { text: "Scroll view up", command: "editorScroll", args: [{ "by": "line", "revealCursor": true, "to": "up" }] },
            "j": { text: "Scroll view down", command: "editorScroll", args: [{ "by": "line", "revealCursor": true, "to": "down" }] },
            "/": { text: "Search for regex pattern", command: "dance.search" },
            "?": { text: "Reverse search for regex pattern", command: "dance.search.backward" },
            "n": { text: "Select next search match", command: "dance.search.next" },
            "N": { text: "Select previous search match", command: "dance.search.previous" },
          },
        },

        goto: {
          title: "Goto",
          items: {
            "g": { text: "to line number else file start", command: "dance.select.lineStart", "args": [{ "count": 1 }] },
            "e": { text: "to last line", command: "dance.select.lineEnd", args: [{ count: 2 ** 31 - 1 }] },
            "f": { text: "to file/URLs in selections", command: "dance.selections.open" },
            "h": { text: "to line start", command: "dance.select.lineStart" },
            "l": { text: "to line end", command: "dance.select.lineEnd" },
            "s": { text: "to first non-blank in line", command: "dance.select.lineStart", args: [{ skipBlank: true }] },
            "d": { text: "to definition", command: "editor.action.revealDefinition" },
            "r": { text: "to references", command: "editor.action.goToReferences" },
            "j": { text: "to last line", command: "dance.select.lastLine" },
            "t": { text: "to window top", command: "dance.select.firstVisibleLine" },
            "c": { text: "to window center", command: "dance.select.middleVisibleLine" },
            "b": { text: "to window bottom", command: "dance.select.lastVisibleLine" },
            "a": { text: "to last buffer", command: "workbench.action.openPreviousRecentlyUsedEditorInGroup" },
            "A": { text: "to last buffer...", command: "workbench.action.quickOpenPreviousRecentlyUsedEditorInGroup" },
            "n": { text: "to next buffer", command: "workbench.action.nextEditor" },
            "p": { text: "to previous buffer", command: "workbench.action.previousEditor" },
            ".": { text: "to last buffer modification position", command: "dance.selections.restore", args: [{ register: " insert" }] },
            "w": { text: "to word", command: "dance.seek.wordLabel" },
          },
        },

        leftBracket: {
          title: "Left bracket",
          items: {
            "d": { text: "Goto previous diagnostic", command: "editor.action.marker.prevInFiles" },
            "g": { text: "Goto previous change", command: "workbench.action.editor.previousChange" },
            "p": { text: "Goto previous paragraph", command: "dance.seek.object", args: [{ "input": "(?#predefined=paragraph)", "where": "start", "inner": false }] },
            " ": { text: "Add newline above", command: "dance.edit.newLine.above" },
          },
        },

        rightBracket: {
          title: "Right bracket",
          items: {
            "d": { text: "Goto next diagnostic", command: "editor.action.marker.nextInFiles" },
            "g": { text: "Goto next change", command: "workbench.action.editor.nextChange" },
            "p": { text: "Goto next paragraph", command: "dance.seek.object", args: [{ "input": "(?#predefined=paragraph)", "where": "end" }] },
            " ": { text: "Add newline below", command: "dance.edit.newLine.below" },
          },
        },
      },
    },

    keybindings: (() => {
      const ignoredKeybindings = [],
            keybindings = modules
              .flatMap((module) => module.keybindings)
              .filter((keybinding) => ["core", "helix", undefined].includes(keybinding.category))
              .map(({ category, ...kb }) => kb);

      for (const mode of ["normal", "select", "insert"]) {
        for (const keybind of keybindings) {
          keybind.when = keybind.when.replace(`dance.mode == '${mode}'`, `dance.mode == 'helix/${mode}'`);
        }
      }

      for (const mode of ["normal", "select"]) {
        const whenMode = `editorTextFocus && dance.mode == 'helix/${mode}'`;
        ignoredKeybindings.push(...generateIgnoredKeybinds(
          keybindings.filter(key => key.when.includes(whenMode)),
          whenMode,
        ));
      }

      return [
        ...keybindings,
        ...ignoredKeybindings,
      ];
    })(),
  },
});


export async function build(builder: Builder) {
  await fs.writeFile(
    `${__dirname}/package.json`,
    JSON.stringify(pkg(await builder.getCommandModules()), undefined, 2) + "\n",
    "utf-8",
  );
}
