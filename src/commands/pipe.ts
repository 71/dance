// Pipes: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#changes-through-external-programs
import * as cp     from 'child_process'
import * as util   from 'util'
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, InputKind } from '.'


const exec = util.promisify(cp.exec)
const replaceMap = { '\n': '\\n', '\r': '\\r', '"': '\\"' }

function getShell() {
  let os: string

  if (process.platform === 'cygwin')
    os = 'linux'
  else if (process.platform === 'linux')
    os = 'linux'
  else if (process.platform === 'darwin')
    os = 'osx'
  else if (process.platform === 'win32')
    os = 'windows'
  else
    return undefined

  const config = vscode.workspace.getConfiguration('terminal')

  return config.get<string | null>(`integrated.automationShell.${os}`)
      ?? config.get<string | null>(`integrated.shell.${os}`)
      ?? process.env.SHELL
      ?? undefined
}

function execWithInput(command: string, input: string) {
  const shell = getShell()

  input = input.replace(/[\n\r"]/g, s => replaceMap[s as '\n' | '\r' | '"'])
  command = `echo "${input}" | ${command}`

  return exec(command, { shell })
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

function displayErrors(errors: { err?: string }[]) {
  let message = ''
  let errorCount = 0

  for (const error of errors) {
    if (error.err !== undefined && error.err.length > 0) {
      message += `- "${error.err}".`
      errorCount++
    }
  }

  if (errorCount === 0)
    return false
  if (errorCount === 1)
    message = `Error running shell command: ${message.substr(2)}`
  else
    message = `Errors running shell command:\n${message}`

  vscode.window.showErrorMessage(message)

  return true
}


const getInputBoxOptions = (expectReplacement: boolean) => ({
  validateInput(input: string) {
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
} as vscode.InputBoxOptions)

const inputBoxOptions = getInputBoxOptions(false)
const inputBoxOptionsWithReplacement = getInputBoxOptions(true)

function pipeInput(input: string, editor: vscode.TextEditor) {
  return pipe(input, editor.selections.map(editor.document.getText)) as Thenable<{ val?: string, err?: string }[]>
}

registerCommand(Command.pipeFilter, CommandFlags.ChangeSelections, InputKind.Text, inputBoxOptions, async (editor, state) => {
  const outputs = await pipeInput(state.input, editor)

  displayErrors(outputs)
  editor.selections = editor.selections.filter((_, i) => !outputs[i].err && outputs[i].val !== 'false')
})

registerCommand(Command.pipeIgnore, CommandFlags.None, InputKind.Text, inputBoxOptions, async (editor, state) => {
  const outputs = await pipeInput(state.input, editor)

  displayErrors(outputs)
})

registerCommand(Command.pipeReplace, CommandFlags.Edit, InputKind.Text, inputBoxOptionsWithReplacement, async (editor, state) => {
  const outputs = await pipeInput(state.input, editor)

  if (displayErrors(outputs))
    return

  return (builder: vscode.TextEditorEdit) => {
    for (let i = 0; i < outputs.length; i++)
      builder.replace(editor.selections[i], outputs[i].val!)
  }
})

registerCommand(Command.pipeAppend, CommandFlags.Edit, InputKind.Text, inputBoxOptions, async (editor, state) => {
  const outputs = await pipeInput(state.input, editor)

  if (displayErrors(outputs))
    return

  return (builder: vscode.TextEditorEdit) => {
    for (let i = 0; i < outputs.length; i++)
      builder.insert(editor.selections[i].end, outputs[i].val!)
  }
})

registerCommand(Command.pipePrepend, CommandFlags.Edit, InputKind.Text, inputBoxOptions, async (editor, state) => {
  const outputs = await pipeInput(state.input, editor)

  if (displayErrors(outputs))
    return

  return (builder: vscode.TextEditorEdit) => {
    for (let i = 0; i < outputs.length; i++)
      builder.insert(editor.selections[i].start, outputs[i].val!)
  }
})
