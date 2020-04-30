import { writeFileSync } from 'fs'

import { commands } from './commands'


// Package information
// ============================================================================

const pkg = {
  name: 'dance',
  displayName: 'Dance',
  description: 'Make those cursors dance with Kakoune-inspired keybindings.',
  version: '0.2.2',
  license: 'ISC',

  publisher: 'gregoire',
  author: {
    name: 'Grégoire Geis',
    email: 'git@gregoirege.is',
  },

  repository: {
    type: 'git',
    url : 'https://github.com/71/dance.git',
  },

  readme: 'README.md',

  categories: [
    'Keymaps',
    'Other',
  ],

  main: './out/src/extension.js',

  engines: {
    vscode: '^1.43.0',
  },

  scripts: {
    'generate'         : 'ts-node commands/generate.ts && ts-node package.ts',
    'vscode:prepublish': 'yarn run generate && yarn run compile',
    'compile'          : 'tsc -p ./',
    'watch'            : 'tsc -watch -p ./',
    'postinstall'      : 'node ./node_modules/vscode/bin/install',
    'test'             : 'yarn run compile && node ./out/test/run.js',
    'package'          : 'vsce package',
    'publish'          : 'vsce publish',
  },

  devDependencies: {
    '@types/glob': '^7.1.1',
    '@types/js-yaml': '^3.12.1',
    '@types/mocha': '^7.0.2',
    '@types/node': '^10.12.21',
    '@typescript-eslint/eslint-plugin': '^2.28.0',
    '@typescript-eslint/parser': '^2.28.0',
    'eslint': '^6.8.0',
    'glob': '^7.1.6',
    'js-yaml': '^3.13.0',
    'mocha': '^7.1.1',
    'ts-node': '^8.0.3',
    'typescript': '^3.7.2',
    'vsce': '^1.62.0',
    'vscode': '^1.1.28',
    'vscode-test': '^1.3.0',
  },

  activationEvents: [
    '*',
  ],
  contributes: {
    configuration: {
      type: 'object',
      title: 'Dance',
      properties: {
        'dance.enabled': {
          type: 'boolean',
          default: true,
          description: 'Controls whether the Dance keybindings are enabled.',
        },
        'dance.normalMode.lineHighlight': {
          type: ['string', 'null'],
          default: 'editor.hoverHighlightBackground',
          markdownDescription: 'Controls the line highlighting applied to active lines in normal mode. Can be an hex color, a [theme color](https://code.visualstudio.com/api/references/theme-color) or null.',
        },
        'dance.insertMode.lineHighlight': {
          type: ['string', 'null'],
          default: null,
          markdownDescription: 'Controls the line highlighting applied to active lines in insert mode. Can be an hex color, a [theme color](https://code.visualstudio.com/api/references/theme-color) or null.',
        },
        'dance.normalMode.lineNumbers': {
          enum: ['off', 'on', 'relative', 'inherit'],
          default: 'relative',
          description: 'Controls the display of line numbers in normal mode.',
          enumDescriptions: ['No line numbers.', 'Absolute line numbers.', 'Relative line numbers.', 'Inherit from `editor.lineNumbers`.'],
        },
        'dance.insertMode.lineNumbers': {
          enum: ['off', 'on', 'relative', 'inherit'],
          default: 'inherit',
          description: 'Controls the display of line numbers in insert mode.',
          enumDescriptions: ['No line numbers.', 'Absolute line numbers.', 'Relative line numbers.', 'Inherit from `editor.lineNumbers`.'],
        },
        'dance.normalMode.cursorStyle': {
          enum: ['line', 'block', 'underline', 'line-thin', 'block-outline', 'underline-thin', 'inherit'],
          default: 'inherit',
          description: 'Controls the cursor style in normal mode.',
        },
        'dance.insertMode.cursorStyle': {
          enum: ['line', 'block', 'underline', 'line-thin', 'block-outline', 'underline-thin', 'inherit'],
          default: 'inherit',
          description: 'Controls the cursor style in insert mode.',
        },
        'dance.selectionBehavior': {
          enum: ['caret', 'character'],
          default: 'caret',
          description: 'Controls how selections behave within VS Code.',
          markdownEnumDescriptions: [
            'Selections are anchored to carets, which is the native VS Code behavior; that is, they are positioned *between* characters and can therefore be empty.',
            'Selections are anchored to characters, like Kakoune; that is, they are positioned *on* characters, and therefore cannot be empty. Additionally, one-character selections will behave as if they were non-directional, like Kakoune.',
          ],
        },
        'dance.selections.allowEmpty': {
          type: 'boolean',
          default: true,
          description: 'Controls whether selections can be empty. If false, each selection will have at least one character.',
          deprecationMessage: 'This property will be removed in the next version of Dance. Please set dance.selectionBehavior to "caret" to allow empty selections, or to "character" to forbid them.',
        },
      },
    },
    commands: Object.values(commands).map(x => ({
      command: x.id,
      title: x.title,
      description: x.description,
      category: 'Dance',
    })),
    keybindings: Object.values(commands).reduce((bindings: { command: string, key: string, when: string }[], x) =>
      bindings.concat(x.keybindings.map(k => ({ command: x.id, key: k.key, when: k.when })))
    , [
      { command: 'workbench.action.showCommands', key: 'Shift+;', when: 'editorTextFocus && dance.mode == \'normal\'' },
    ]),
  },
}


// Save to package.json
// ============================================================================

writeFileSync('./package.json', JSON.stringify(pkg, undefined, 2) + '\n', 'utf8')
