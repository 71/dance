import { writeFileSync } from 'fs'

import { commands } from './commands'


// Package information
// ============================================================================

const pkg = {
  name: 'dance',
  displayName: 'Dance',
  description: 'Make those cursors dance with Kakoune-inspired keybindings.',
  version: '0.1.9',
  license: 'MIT',

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
    vscode: '^1.32.0',
  },

  scripts: {
    'generate'         : 'ts-node commands/generate.ts && ts-node package.ts',
    'vscode:prepublish': 'yarn run generate && yarn run compile',
    'compile'          : 'tsc -p ./',
    'watch'            : 'tsc -watch -p ./',
    'postinstall'      : 'node ./node_modules/vscode/bin/install',
    'test'             : 'yarn run compile && node ./node_modules/vscode/bin/test',
    'package'          : 'vsce package',
    'publish'          : 'vsce publish',
  },

  devDependencies: {
    '@types/js-yaml': '^3.12.1',
    '@types/mocha'  : '^2.2.42',
    '@types/node'   : '^10.12.21',
    'js-yaml'   : '^3.13.0',
    'ts-node'   : '^8.0.3',
    'tslint'    : '^5.12.1',
    'typescript': '^3.7.2',
    'vsce'      : '^1.62.0',
    'vscode'    : '^1.1.28',
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
        'dance.selections.allowEmpty': {
          type: 'boolean',
          default: true,
          description: 'Controls whether selections can be empty. If false, each selection will have at least one character.',
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
    , []),
  },
}


// Save to package.json
// ============================================================================

writeFileSync('./package.json', JSON.stringify(pkg, undefined, 2), 'utf8')
