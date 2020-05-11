import * as assert from 'assert'
import * as fs     from 'fs'
import * as path   from 'path'
import * as vscode from 'vscode'

import { Command }        from '../../commands'
import { extensionState } from '../../src/extension'
import { SelectionBehavior } from '../../src/state/extension'

export namespace testCommands {
  export interface Mutation {
    readonly commands: readonly (string | { readonly command: string, readonly args: any[] })[]
    readonly contentAfterMutation: string
  }

  export interface Options {
    readonly initialContent: string
    readonly mutations: readonly Mutation[]
    readonly selectionBehavior: SelectionBehavior
  }
}

/**
 * Used to indicate the anchor ("{0}") and active ("|{0}") carets of each
 * selection in the document. e.g. "a{0}bcd|{0}ef" indicates "bcd" selected.
 */
const selectionMarkerRegexp = /(\|)?{(\d+)}/g

/*
 * Used to mark the end of line, which helps to indicate trailing whitespace
 * on a line or (trailing) empty lines (if placed by itself on a line).
 */
const eolMarkerRegexp = /{EOL}/g

function getPlainContent(templatedContent: string) {
  return templatedContent.trimRight().replace(eolMarkerRegexp, '').replace(selectionMarkerRegexp, '')
}

function getSelections(document: vscode.TextDocument, templatedContent: string) {
  const anchorPositions = [] as vscode.Position[]
  const activePositions = [] as vscode.Position[]

  let match: RegExpExecArray | null = null
  let diff = 0

  const contentAndSelections = templatedContent.trimRight().replace(eolMarkerRegexp, '')

  while (match = selectionMarkerRegexp.exec(contentAndSelections)) {
    const index = +match[2]

    if (match[1] === '|') {
      activePositions[index] = document.positionAt(match.index - diff)

      if (anchorPositions[index] === undefined)
        anchorPositions[index] = activePositions[index]
    } else {
      anchorPositions[index] = document.positionAt(match.index - diff)
    }

    diff += match[0].length
  }

  return Array.from(anchorPositions, (anchor, i) => {
    if (!anchor) {
      throw new Error(`Selection ${i} is not specified.`)
    }
    return new vscode.Selection(anchor, activePositions[i])
  })
}

function stringifySelection(document: vscode.TextDocument, selection: vscode.Selection) {
  const content = document.getText()
  const startOffset = document.offsetAt(selection.start),
        endOffset = document.offsetAt(selection.end),
        [startString, endString] = selection.isReversed ? ['|', '<'] : ['>', '|']

  if (selection.isEmpty)
    return content.substring(0, startOffset) + '|' + content.substring(startOffset)
  else
    return content.substring(0, startOffset) + startString + content.substring(startOffset, endOffset) + endString + content.substring(endOffset)
}

async function testCommands(editor: vscode.TextEditor, { initialContent, mutations, selectionBehavior }: testCommands.Options) {
  // @ts-ignore
  extensionState._selectionBehavior = selectionBehavior

  const content = getPlainContent(initialContent)
  const document = editor.document

  await editor.edit(builder => builder.replace(new vscode.Range(new vscode.Position(0, 0), document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end), content))

  // Set up initial selections.
  const initialSelections = getSelections(document, initialContent)

  editor.selections = initialSelections

  // For each mutation...
  let mutationIndex = 1

  for (const { commands, contentAfterMutation } of mutations) {
    // Execute commands.
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i]
      const { command: commandName, args } = typeof command === 'string' ? { command, args: [] } : command

      const promise = vscode.commands.executeCommand(commandName, ...args)

      while (i < commands.length - 1 && typeof commands[i + 1] === 'string' && (commands[i + 1] as string).startsWith('type:')) {
        await new Promise(resolve => {
          setTimeout(() => {
            vscode.commands.executeCommand('type', { text: (commands[i + 1] as string)[5] }).then(resolve)
          }, 20)
        })

        i++
      }

      await promise
    }

    // Ensure resulting text is valid.
    let prefix = mutations.length === 1 ? '' : `After ${mutationIndex} mutation(s):\n  `

    const expectedContent = getPlainContent(contentAfterMutation)

    assert.strictEqual(document.getText(), expectedContent, `${prefix}Document text is not as expected.`)

    // Set up expected selections.
    const expectedSelections = getSelections(document, contentAfterMutation)

    // Ensure resulting selections are right.
    assert.strictEqual(editor.selections.length, expectedSelections.length,
      `${prefix}Expected ${expectedSelections.length} selection(s), but had ${editor.selections.length}.`)

    for (let i = 0; i < expectedSelections.length; i++) {
      if (editor.selections[i].isEqual(expectedSelections[i])) {
        continue
      }

      const expected = stringifySelection(document, expectedSelections[i])
      const actual = stringifySelection(document, editor.selections[i])

      assert.strictEqual(actual, expected, `${prefix}Expected selections #${i} to match ('>' is anchor, '|' is cursor).`)
      assert.fail()
    }

    mutationIndex++
  }
}

suite('Running commands', function() {
  let document: vscode.TextDocument
  let editor: vscode.TextEditor

  this.beforeAll(async () => {
    document = await vscode.workspace.openTextDocument()
    editor = await vscode.window.showTextDocument(document)
  })

  test('mutation tests work correctly', async function() {
    await testCommands(editor, {
      initialContent: `{0}f|{0}oo`,
      mutations: [
        { contentAfterMutation: `{0}fo|{0}o`,
          commands: [Command.rightExtend],
        },
      ],
      selectionBehavior: SelectionBehavior.Character,
    })
  })

  test('mutation tests catch errors correctly', async function() {
    try {
      await testCommands(editor, {
        initialContent: `|{0}foo`,
        mutations: [
          { contentAfterMutation: `|{0}foo`,
            commands: [Command.rightExtend],
          },
        ],
        selectionBehavior: SelectionBehavior.Character,
      })
    } catch (err) {
      if (err instanceof Error && err.message === `Expected selections #0 to match ('>' is anchor, '|' is cursor).`)
        return

      throw err
    }

    assert.fail(`Expected error.`)
  })

  const basedir = this.file!.replace('\\out\\', '\\').replace('/out/', '/').replace('.test.js', ''),
        fileNames = fs.readdirSync(basedir),
        longestFileName = fileNames.reduce((longest, curr) => curr.length > longest.length ? curr : longest),
        fileNamePadding = longestFileName.length

  for (const file of fileNames) {
    const fullPath = path.join(basedir, file.padEnd(fileNamePadding))
    const friendlyPath = fullPath.substr(/dance.test.suite/.exec(fullPath)!.index)
    const selectionBehavior = file.endsWith('.caret') ? SelectionBehavior.Caret : SelectionBehavior.Character

    const content = fs.readFileSync(fullPath.trimRight(), { encoding: 'utf8' })
        .replace(/^\/\/[^=].*\n/gm, '')   // Remove //-comments.
    const sections = content.split(/(^\/\/== [\w.]+(?: > [\w.]+)?$\n(?:^\/\/= .+$\n)*)/gm)
    const nodes = new Map<string, string>()
    const results = new Map<string, Promise<boolean>>()
    const initialContent = sections[0].trim() + '\n'

    nodes.set('root', initialContent)
    nodes.set('0', initialContent)
    results.set('root', Promise.resolve(true))
    results.set('0', Promise.resolve(true))

    // Find longest section name for padding.
    let longestSectionNameLength = 0

    for (let i = 1; i < sections.length; i += 2) {
      const [_, sectionIn, sectionOut] = /^\/\/== ([\w.]+)(?: > ([\w.]+))?$/m.exec(sections[i])!

      longestSectionNameLength = Math.max(longestSectionNameLength, sectionIn.length, sectionOut?.length ?? 0)
    }

    // Run all tests in the file.
    for (let i = 1; i < sections.length; i += 2) {
      const metadata = sections[i],
            content = sections[i + 1]

      const [full, from, to] = /^\/\/== ([\w.]+)(?: > ([\w.]+))?$/m.exec(metadata)!
      const commands = metadata.substr(full.length).split('\n').map(x => x.substr(3).trim())
         .filter(x => x).map(str => (str[0] === '{') ? JSON.parse(str) : str)
      const contentAfterMutation = content
      const initialContent = nodes.get(from)!

      if (to === undefined) {
        assert(commands.length === 0, `Cannot define commands in base section.`)

        nodes.set(from, contentAfterMutation)
        results.set(from, Promise.resolve(true))

        continue
      }

      assert(typeof initialContent === 'string')
      assert(!nodes.has(to))

      let setSuccess: (success: boolean) => void

      nodes.set(to, contentAfterMutation)
      results.set(to, new Promise<boolean>(resolve => setSuccess = resolve))

      test(`${friendlyPath}: mutation ${from.padEnd(longestSectionNameLength)} > ${to.padEnd(longestSectionNameLength)} is applied correctly`, async function() {
        if (!await results.get(from)!) {
          setSuccess(false)
          this.skip()
        }

        let success = false

        try {
          await testCommands(editor, {
            initialContent,
            mutations: [
              { contentAfterMutation,
                commands,
              },
            ],
            selectionBehavior,
          })

          success = true
        } finally {
          setSuccess(success)
        }
      })
    }
  }
})
