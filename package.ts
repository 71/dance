import { writeFileSync } from 'fs'

import { commands, Command, additionalKeyBindings } from './commands'

// Key bindings
// ============================================================================

const keybindings: {command: string, key: string, when: string, args?: any}[] = additionalKeyBindings.concat()

for (const command of Object.values(commands)) {
  for (const { key, when } of command.keybindings) {
    keybindings.push({ command: command.id, key, when })
  }
}

// Menus
// ============================================================================

const menus: Record<string, {items: Record<string, {text: string, command: string, args?: any[]}>}> = {
  object: {
    items: {
      'b': { command: Command.objectsPerformSelection, args: [{ object: 'parens' }], text: 'parenthesis block' },
      '(': { command: Command.objectsPerformSelection, args: [{ object: 'parens' }], text: 'parenthesis block' },
      ')': { command: Command.objectsPerformSelection, args: [{ object: 'parens' }], text: 'parenthesis block' },
      'B': { command: Command.objectsPerformSelection, args: [{ object: 'braces' }], text: 'braces block' },
      '{': { command: Command.objectsPerformSelection, args: [{ object: 'braces' }], text: 'braces block' },
      '}': { command: Command.objectsPerformSelection, args: [{ object: 'braces' }], text: 'braces block' },
      'r': { command: Command.objectsPerformSelection, args: [{ object: 'brackets' }], text: 'brackets block' },
      '[': { command: Command.objectsPerformSelection, args: [{ object: 'brackets' }], text: 'brackets block' },
      ']': { command: Command.objectsPerformSelection, args: [{ object: 'brackets' }], text: 'brackets block' },
      'a': { command: Command.objectsPerformSelection, args: [{ object: 'angleBrackets' }], text: 'angle block' },
      '<': { command: Command.objectsPerformSelection, args: [{ object: 'angleBrackets' }], text: 'angle block' },
      '>': { command: Command.objectsPerformSelection, args: [{ object: 'angleBrackets' }], text: 'angle block' },
      'Q': { command: Command.objectsPerformSelection, args: [{ object: 'doubleQuoteString' }], text: 'double quote string' },
      '"': { command: Command.objectsPerformSelection, args: [{ object: 'doubleQuoteString' }], text: 'double quote string' },
      'q': { command: Command.objectsPerformSelection, args: [{ object: 'singleQuoteString' }], text: 'single quote string' },
      "'": { command: Command.objectsPerformSelection, args: [{ object: 'singleQuoteString' }], text: 'single quote string' },
      'g': { command: Command.objectsPerformSelection, args: [{ object: 'graveQuoteString' }], text: 'grave quote string' },
      '`': { command: Command.objectsPerformSelection, args: [{ object: 'graveQuoteString' }], text: 'grave quote string' },
      'w': { command: Command.objectsPerformSelection, args: [{ object: 'word' }], text: 'word' },
      'W': { command: Command.objectsPerformSelection, args: [{ object: 'WORD' }], text: 'WORD' },
      's': { command: Command.objectsPerformSelection, args: [{ object: 'sentence' }], text: 'sentence' },
      'p': { command: Command.objectsPerformSelection, args: [{ object: 'paragraph' }], text: 'paragraph' },
      ' ': { command: Command.objectsPerformSelection, args: [{ object: 'whitespaces' }], text: 'whitespaces' },
      'i': { command: Command.objectsPerformSelection, args: [{ object: 'indent' }], text: 'indent' },
      'n': { command: Command.objectsPerformSelection, args: [{ object: 'number' }], text: 'number' },
      'u': { command: Command.objectsPerformSelection, args: [{ object: 'argument' }], text: 'argument' },
      'c': { command: Command.objectsPerformSelection, args: [{ object: 'custom' }], text: 'custom object desc' },
    },
  },
}

for (const [suffix, desc] of [['', 'go to'], ['.extend', 'extend to']]) {
  menus['goto' + suffix] = {
    items: {
      'h': { text: `${desc} line start`, command: 'dance.goto.lineStart' + suffix },
      'l': { text: `${desc} line end`, command: 'dance.goto.lineEnd' + suffix },
      'i': { text: `${desc} non-blank line start`, command: 'dance.goto.lineStart.nonBlank' + suffix },
      'g': { text: `${desc} first line`, command: 'dance.goto.firstLine' + suffix },
      'k': { text: `${desc} first line`, command: 'dance.goto.firstLine' + suffix },
      'j': { text: `${desc} last line`, command: 'dance.goto.lastLine' + suffix },
      'e': { text: `${desc} last char of last line`, command: 'dance.goto.lastCharacter' + suffix },
      't': { text: `${desc} the first displayed line`, command: 'dance.goto.firstVisibleLine' + suffix },
      'c': { text: `${desc} the middle displayed line`, command: 'dance.goto.middleVisibleLine' + suffix },
      'b': { text: `${desc} the last displayed line`, command: 'dance.goto.lastVisibleLine' + suffix },
      'f': { text: `${desc} file whose name is selected`, command: 'dance.goto.selectedFile' + suffix },
      '.': { text: `${desc} last buffer modification position`, command: 'dance.goto.lastModification' + suffix },
    },
  }
}

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
    vscode: '^1.44.0',
  },

  scripts: {
    'generate'         : 'ts-node ./commands/generate.ts && ts-node package.ts',
    'vscode:prepublish': 'yarn run generate && yarn run compile',
    'compile'          : 'tsc -p ./',
    'watch'            : 'tsc -watch -p ./',
    'test'             : 'yarn run compile && node ./out/test/run.js',
    'package'          : 'vsce package',
    'publish'          : 'vsce publish',
  },

  devDependencies: {
    '@types/glob': '^7.1.1',
    '@types/js-yaml': '^3.12.3',
    '@types/mocha': '^7.0.2',
    '@types/node': '^13.13.4',
    '@types/vscode': '^1.44.0',
    '@typescript-eslint/eslint-plugin': '^2.30.0',
    '@typescript-eslint/parser': '^2.30.0',
    'eslint': '^6.8.0',
    'glob': '^7.1.6',
    'js-yaml': '^3.13.0',
    'mocha': '^7.1.2',
    'ts-node': '^8.9.1',
    'typescript': '^3.8.3',
    'vsce': '^1.75.0',
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
        'dance.insertMode.selectionStyle': {
          type: 'object',
          default: {
            borderColor: '$editor.selectionBackground',
            borderStyle: 'solid',
            borderWidth: '2px',
            borderRadius: '1px',
          },
          description: 'The style to apply to selections in insert mode.',
          properties: (Object as any).fromEntries(['backgroundColor', 'borderColor', 'borderStyle', 'borderWidth', 'borderRadius'].map(x => [x, { type: 'string' }])),
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
          description: 'Controls whether selections can be empty. If false, each selection will have at least one character.',
          deprecationMessage: 'This property will be removed in the next version of Dance and is currently being ignored. Please set dance.selectionBehavior to "caret" to allow empty selections, or to "character" to forbid them.',
        },
        'dance.menus': {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              items: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    'text': {
                      type: 'string',
                    },
                    'command': {
                      type: 'string',
                    },
                    'args': {
                      type: 'array',
                    },
                  },
                },
              },
            },
            additionalProperties: false,
          },
          default: menus,
        },
      },
    },
    commands: Object.values(commands).map(x => ({
      command: x.id,
      title: x.title,
      description: x.description,
      category: 'Dance',
    })),
    keybindings,
  },
}


// Save to package.json
// ============================================================================

writeFileSync('./package.json', JSON.stringify(pkg, undefined, 2) + '\n', 'utf8')
