// Pipes: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#changes-through-external-programs
import * as cp     from 'child_process'
import * as util   from 'util'
import * as vscode from 'vscode'

import { Extension } from '../extension'
import { prompt }    from '../utils/prompt'

import { registerCommand, Command } from '.'


const exec = util.promisify(cp.exec)
const replaceMap = { '\n': '\\n', '\r': '\\r', '"': '\\"' }

const terminalConfig = vscode.workspace.getConfiguration('terminal.external')
const shellToUse =
  /*process.platform === 'win32' || process.platform === 'cygwin' ? terminalConfig.get<string>('windowsExec')
 :*/process.platform === 'darwin' ? terminalConfig.get<string>('osxExec')
  : process.platform === 'linux'  ? terminalConfig.get<string>('linuxExec')
  : undefined

function execWithInput(command: string, input: string) {
  input = input.replace(/[\n\r"]/g, s => replaceMap[s as '\n' | '\r' | '"'])
  command = `echo "${input}" | ${command}`

  return exec(command, { shell: shellToUse })
          .then(x => ({ err: x.stderr, val: x.stdout.trimRight() }))
          .catch((e: cp.ExecException) => ({ err: e.message }))
}

function parseRegExp(regexp: string) {
  if (regexp.length < 3 || regexp[0] !== '/')
    return 'Invalid RegExp.'

  let pattern = ''
  let replacement: string | undefined = undefined
  let flags      : string | undefined = undefined

  for (let i = 1; i < regexp.length; i++) {
    const ch = regexp[i]

    if (flags !== undefined) {
      // Parse flags
      if (ch !== 'm' && ch !== 'i' && ch !== 'g')
        return `Unknown flag '${ch}'.`

      flags += ch
    } else if (replacement !== undefined) {
      // Parse replacement string
      if (ch === '/') {
        flags = ''
      } else if (ch === '\\') {
        if (i === regexp.length - 1) return 'Unexpected end of RegExp.'

        replacement += ch + regexp[++i]
      } else {
        replacement += ch
      }
    } else {
      // Parse pattern
      if (ch === '/') {
        replacement = ''
      } else if (ch === '\\') {
        if (i === regexp.length - 1) return 'Unexpected end of RegExp.'

        pattern += ch + regexp[++i]
      } else {
        pattern += ch
      }
    }
  }

  try {
    return [new RegExp(pattern, flags), replacement] as [RegExp, string | undefined]
  } catch {
    return 'Invalid RegExp.'
  }
}

function pipe(command: string, selections: string[]) {
  if (command.startsWith('#')) {
    // Shell
    command = command.substr(1)

    return Promise.all(selections.map(selection => execWithInput(command, selection.trim())))
  } else if (command.startsWith('/')) {
    // RegExp replace
    const [regexp, replacement] = parseRegExp(command) as [RegExp, string] // Safe to do; since the input is validated

    return Promise.resolve(selections.map(x => ({ val: x.replace(regexp, replacement) })))
  } else {
    // JavaScript
    const funct = new Function('$', 'i', '$$', 'return ' + command) as ($: string, i: number, $$: string[]) => any

    return Promise.resolve(selections.map(($, i, $$) => {
      let result: any

      try {
        result = funct($, i, $$)
      } catch {
        return { err: 'Exception thrown in given expression.' }
      }

      if (result === null)
        return { val: 'null' }
      if (result === undefined)
        return { val: '' }
      if (typeof result === 'string')
        return { val: result }
      if (typeof result === 'number' || typeof result === 'boolean')
        return { val: result.toString() }
      if (typeof result === 'object')
        return { val: JSON.stringify(result) }

      return { err: 'Invalid returned value.' }
    }))
  }
}


const promptCommand = (state: Extension, expectReplacement = false) => prompt(state, {
  validateInput(input) {
    if (input.trim().length === 0)
      return 'The given command cannot be empty.'

    if (input[0] === '/') {
      const result = parseRegExp(input)

      if (typeof result === 'string')
        return result
      if (expectReplacement && result[1] === undefined)
        return 'Missing replacement part in RegExp.'

      return
    }

    if (input[0] === '#') {
      if (input.substr(1).trim().length === 0)
        return 'The given shell command cannot be empty.'

      return
    }

    try {
      new Function('$', '$$', 'i', 'return ' + input)
    } catch {
      return 'Invalid expression.'
    }

    return undefined
  },

  prompt: 'Enter an expression',
}) as Thenable<string | undefined>

const promptExecSelections = (state: Extension, editor: vscode.TextEditor, expectReplacement = false) =>
  promptCommand(state, expectReplacement).then(cmd =>
    cmd === undefined
      ? undefined
      : pipe(cmd, editor.selections.map(editor.document.getText)) as Promise<{ val?: string, err?: string }[]>)


registerCommand(Command.pipeFilter, async (editor, state) => {
  const outputs = await promptExecSelections(state, editor, false)

  if (outputs === undefined)
    return

  // TODO: Handle stderr
  editor.selections = editor.selections.filter((_, i) => !outputs[i].err && outputs[i].val !== 'false')
})

registerCommand(Command.pipeIgnore, async (editor, state) => {
  const outputs = await promptExecSelections(state, editor, false)

  if (outputs === undefined)
    return

  // TODO: Handle stderr
})

registerCommand(Command.pipeReplace, async (editor, state) => {
  const outputs = await promptExecSelections(state, editor, true)

  if (outputs === undefined)
    return

  // TODO: Handle stderr
  if (outputs.find(x => !!x.err))
    return

  editor.edit(builder => {
    for (let i = 0; i < outputs.length; i++)
      builder.replace(editor.selections[i], outputs[i].val!)
  })
})

registerCommand(Command.pipeAppend, async (editor, state) => {
  const outputs = await promptExecSelections(state, editor, false)

  if (outputs === undefined)
    return

  // TODO: Handle stderr
  if (outputs.find(x => !!x.err))
    return

  editor.edit(builder => {
    for (let i = 0; i < outputs.length; i++)
      builder.insert(editor.selections[i].end, outputs[i].val!)
  })
})

registerCommand(Command.pipePrepend, async (editor, state) => {
  const outputs = await promptExecSelections(state, editor, false)

  if (outputs === undefined)
    return

  // TODO: Handle stderr
  if (outputs.find(x => !!x.err))
    return

  editor.edit(builder => {
    for (let i = 0; i < outputs.length; i++)
      builder.insert(editor.selections[i].start, outputs[i].val!)
  })
})
