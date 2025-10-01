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
            ".": { text: "to last buffer modification position", command: "dance.selections.restore", args: [{ register: " insert" }],
            },
          },
        },

      space: {
        title: "Space",
        items: {
          "f": { text: "Open file picker", command: "workbench.action.quickOpen" },
          "F": {
            text: "Open file picker at current working directory",
            command: "dance.run",
            args: [
              {
                code:
                  (() => {
                    const codeStr =
                      `const fallback = () => vscode.commands.executeCommand(
                        'workbench.action.quickOpen',
                      );
                      const editor = vscode.window.activeTextEditor;
                      if (!editor) {
                        return await fallback();
                      }
                      const currentFileUri = editor.document.uri;
                      const currentDirectoryUri = vscode.Uri.joinPath(currentFileUri, '..');
                      const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentFileUri);
                      if (!workspaceFolder || currentDirectoryUri.fsPath === workspaceFolder.uri.fsPath) {
                        return await fallback();
                      }
                      const relativeDirectoryPath = vscode.workspace.asRelativePath(
                        currentDirectoryUri,
                        /** includeWorkspaceFolder = */ false
                      );
                      const quickOpenPrefix = relativeDirectoryPath.endsWith('/') ?
                          relativeDirectoryPath
                          : relativeDirectoryPath + "/";
                      await vscode.commands.executeCommand(
                        'workbench.action.quickOpen',
                        quickOpenPrefix,
                      );`;

                    const lines = codeStr.split("\n");
                    const theThirdLine = lines[2];
                    // Get the indentation of the multi-line template string
                    const indent = theThirdLine.match(/^([ \t]*)/)![0];
                    // Remove the indentation and split into array of lines
                    return codeStr
                      .replaceAll(indent, "")
                      .split("\n");
                  })()
                ,
              },
            ],
          },
          "b": {
            text: "Open buffer picker",
            command: "workbench.action.showAllEditors",
          },
          // "j": {
          //   text: "Open jumplist picker",
          //   command: "", // TODO
          // },
          "s": {
            text: "Open symbol picker",
            command: "workbench.action.gotoSymbol",
          },
          "S": {
            text: "Open workspace symbol picker",
            command: "workbench.action.showAllSymbols",
          },
          "d": {
            text: "Open diagnostic picker",
            command: "workbench.action.problems.focus",
          },
          "D": {
            text: "Open diagnostic picker",
            command: "workbench.action.problems.focus",
          },
          "g": {
            text: "Open changed file picker",
            command: "workbench.view.scm",
          },
          "a": {
            text: "Perform code action",
            command: "editor.action.quickFix",
          },
          // "'": {
          //   text: "Open last picker",
          //   command: "", // TODO
          // },
          "G": {
            text: "Debug",
            command: "workbench.action.debug.start",
          },
          "w": {
            text: "Window",
            command: "dance.openMenu",
            args: [{ menu: "window" }],
          },
          "y": {
            text: "Yank selections to clipboard",
            command: "dance.selections.saveText",
            args: [{
              register: "dquote",
            }],
          },
          "Y": {
            text: "Yank main selection to clipboard",
            command: "dance.run",
            args: [{
              code: [
                "const editor = vscode.window.activeTextEditor;",
                "if (!editor) {",
                "  return;",
                "}",
                "const text = editor.document.getText(editor.selection);",
                "await vscode.env.clipboard.writeText(text);",
              ],
            }],
          },
          "p": {
            text: "Paste clipboard after selections",
            command: "dance.edit.insert",
            args: [{
              register: "dquote",
              handleNewLine: true,
              where: "end",
            }],
          },
          "P": {
            text: "Paste clipboard before selections",
            command: "dance.edit.insert",
            args: [{
              register: "dquote",
              handleNewLine: true,
              where: "start",
            }],
          },
          "R": {
            text: "Replace selections by clipboard content",
            command: "editor.action.clipboardPasteAction",
            args: [],
          },
          "/": {
            text: "Global Search in workspace folder",
            command: "workbench.action.findInFiles",
          },
          "k": {
            text: "Show docs for item under cursor (hover)",
            command: "editor.action.showHover",
          },
          "r": {
            text: "Rename symbol",
            command: "editor.action.rename",
          },
          "h": {
            text: "Select symbol reference",
            command: "editor.action.referenceSearch.trigger",
          },
        },
      },
      window: {
        title: "Window",
        items: {
          "w": {
            text: "Goto next window",
            command: "workbench.action.nextEditor",
          },
          "s": {
            text: "Horizontal bottom split",
            command: "workbench.action.splitEditorDown",
          },
          "v": {
            text: "Vertical right split",
            command: "workbench.action.splitEditor",
          },
          "t": {
            text: "Transpose splits",
            command: "workbench.action.toggleEditorGroupLayout",
          },
          // "f": {
          //   text: "Open files in selection (hsplit)",
          //   command: "dance.selections.open", // function needs to be modified
          // },
          // "F": {
          //   text: "Open files in selection (vsplit)",
          //   command: "dance.selections.open", // function needs to be modified
          // },
          "q": {
            text: "Close window",
            command: "workbench.action.closeActiveEditor",
          },
          "o": {
            text: "Close windows except current",
            command: "workbench.action.closeOtherEditors",
          },
          "h": {
            text: "Jump to the split on the left",
            command: "workbench.action.focusLeftGroup",
          },
          "j": {
            text: "Jump to the split below",
            command: "workbench.action.focusBelowGroup",
          },
          "k": {
            text: "Jump to the split above",
            command: "workbench.action.focusAboveGroup",
          },
          "l": {
            text: "Jump to the split to the right",
            command: "workbench.action.focusRightGroup",
          },
          "H": {
            text: "Swap with the split to the left",
            command: "workbench.action.moveActiveEditorGroupLeft",
          },
          "J": {
            text: "Swap with the split below",
            command: "workbench.action.moveActiveEditorGroupDown",
          },
          "K": {
            text: "Swap with the split above",
            command: "workbench.action.moveActiveEditorGroupUp",
          },
          "L": {
            text: "Swap with the split to the right",
            command: "workbench.action.moveActiveEditorGroupRight",
          },
          // "n": { Not easily possible. Necessary?
          //   text: "New split scratch buffer",
          //   command: "",
          // },
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
