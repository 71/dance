// Search: https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc#searching
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, InputKind, CommandState } from '.'
import { EditorState }        from '../state/editor'
import { Extension, SelectionBehavior } from '../state/extension'
import { WritableRegister }   from '../registers'
import { SavedSelection }     from '../utils/savedSelection'
import { Direction, ExtendBehavior, Backward, Forward, DoNotExtend, Extend, SeekFunc, SelectionMapper, RemoveSelection, SelectionHelper, Coord, seekToRange } from '../utils/selectionHelper'
import { getCharSetFunction, CharSet } from '../utils/charset'
import { DocumentState } from '../state/document'


function isMultilineRegExp(regex: string) {
  const len = regex.length
  let negate = false

  for (let i = 0; i < len; i++) {
    const ch = regex[i]

    if (negate) {
      if (ch === ']') {
        negate = false
      } else if (ch === '\\') {
        if (regex[i + 1] === 'S')
          return true

        i++ // Ignore next character
      } else {
        continue
      }
    } else if (ch === '[' && regex[i + 1] === '^') {
      negate = true
      i++
    } else if (ch === '\\') {
      if (regex[i + 1] === 's' || regex[i + 1] === 'n')
        return true

      i++ // Ignore next character
    } else if (ch === '$' && i < len - 1) {
      return true
    }
  }

  return false
}

function execFromEnd(regex: RegExp, input: string) {
  let match = regex.exec(input)

  if (match === null || match[0].length === 0)
    return null

  for (;;) {
    const newMatch = regex.exec(input)

    if (newMatch === null)
      return match
    if (newMatch[0].length === 0)
      return null

    match = newMatch
  }
}

const DocumentStart = new vscode.Position(0, 0)

function documentEnd(document: vscode.TextDocument) {
  const lastLine = document.lineCount - 1
  return new vscode.Position(lastLine, document.lineAt(lastLine).text.length)
}

function getSearchRange(selection: vscode.Selection, document: vscode.TextDocument, direction: Direction, isWrapped: boolean): vscode.Range {
  if (isWrapped)
    return new vscode.Range(DocumentStart, documentEnd(document))
  else if (direction === Forward)
    return new vscode.Range(selection.end, documentEnd(document))
  else
    return new vscode.Range(DocumentStart, selection.start)
}

interface SearchState {
  selectionBehavior: SelectionBehavior;
  regex?: RegExp;
}

function needleInHaystack(direction: Direction, allowWrapping: boolean): (selection: vscode.Selection, helper: SelectionHelper<SearchState>) => [Coord, Coord] | undefined {
  return (selection, helper) => {
    const document = helper.editor.document
    const regex = helper.state.regex!
    // Try finding in the normal search range first, then the wrapped search range.
    for (const isWrapped of [false, true]) {
      const searchRange = getSearchRange(selection, document, direction, isWrapped)
      const text = document.getText(searchRange)
      regex.lastIndex = 0
      const match = direction === Forward ? regex.exec(text) : execFromEnd(regex, text)
      if (match) {
        const startOffset = helper.offsetAt(searchRange.start) + match.index
        const firstCharacter = helper.coordAt(startOffset)
        const lastCharacter = helper.coordAt(startOffset + match[0].length - 1)
        return [firstCharacter, lastCharacter]
      }
      if (!allowWrapping) break
    }
    return undefined
  }
}

function moveToNeedleInHaystack(direction: Direction, extend: ExtendBehavior): (selection: vscode.Selection, helper: SelectionHelper<SearchState>) => vscode.Selection | undefined {
  const find = needleInHaystack(direction, !extend)
  return (selection, helper) => {
    const result = find(selection, helper)
    if (result === undefined) return undefined
    const [start, end] = result
    if (extend) {
      return helper.extend(selection, direction === Forward ? end : start)
    } else {
      // When not extending, the result selection should always face forward,
      // regardless of old selection or search direction.
      return helper.selectionBetween(start, end)
    }
  }
}

function registerSearchCommand(command: Command, direction: Direction, extend: ExtendBehavior) {
  let initialSelections: readonly SavedSelection[],
      register: WritableRegister,
      editorState: EditorState,
      documentState: DocumentState,
      searchState: SearchState

  const mapper = moveToNeedleInHaystack(direction, extend)

  registerCommand(command, CommandFlags.ChangeSelections, InputKind.Text, {
    prompt: 'Search RegExp',

    setup(newEditorState) {
      editorState = newEditorState
      documentState = editorState.documentState
      const { editor, extension } = editorState
      searchState = { selectionBehavior: extension.selectionBehavior }
      initialSelections = editor.selections.map(selection => documentState.saveSelection(selection))

      const targetRegister = extension.currentRegister

      if (targetRegister === undefined || !targetRegister.canWrite())
        register = extension.registers.slash
      else
        register = targetRegister
    },

    validateInput(input: string) {
      if (input.length === 0)
        return 'RegExp cannot be empty.'

      const editor = vscode.window.activeTextEditor!
      const selections = editor.selections = initialSelections.map(selection => selection.selection(editor.document))

      let regex: RegExp
      let flags = (isMultilineRegExp(input) ? 'm' : '') + (direction === Backward ? 'g' : '')

      try {
        regex = new RegExp(input, flags)
      } catch {
        return 'Invalid ECMA RegExp.'
      }

      searchState.regex = regex

      const helper = SelectionHelper.for(editorState, searchState)
      const newSelections = []
      const len = selections.length
      for (let i = 0; i < len; i++) {
        const newSelection = mapper(selections[i], helper)
        if (newSelection !== undefined) newSelections.push(newSelection)
      }
      if (newSelections.length === 0) {
        editor.selections = selections
        editor.revealRange(editor.selection)
        return 'No matches found'
      } else {
        editor.selections = newSelections
        editor.revealRange(editor.selection)
        return undefined
      }
    },
  }, ({ editor }) => {
    register.set(editor, [searchState.regex!.source])
    documentState.forgetSelections(initialSelections)
  })
}

registerSearchCommand(Command.search               , Forward , DoNotExtend)
registerSearchCommand(Command.searchBackwards      , Backward, DoNotExtend)
registerSearchCommand(Command.searchExtend         , Forward , Extend)
registerSearchCommand(Command.searchBackwardsExtend, Backward, Extend)

function setSearchSelection(source: string, editor: vscode.TextEditor, state: Extension) {
  try {
    new RegExp(source, 'g')
  } catch {
    return vscode.window.showErrorMessage('Invalid ECMA RegExp.').then(() => {})
  }

  let register = state.currentRegister

  if (register === undefined || !register.canWrite())
    state.registers.slash.set(editor, [source])
  else
    register.set(editor, [source])

  return
}

function escapeRegExp(str: string) {
  // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

registerCommand(Command.searchSelection, CommandFlags.ChangeSelections, ({ editor, extension }) => {
  let text = escapeRegExp(editor.document.getText(editor.selection))

  return setSearchSelection(text, editor, extension)
})

registerCommand(Command.searchSelectionSmart, CommandFlags.ChangeSelections, ({ editor, extension }) => {
  const isWord = getCharSetFunction(CharSet.Word, editor.document)

  let text = escapeRegExp(editor.document.getText(editor.selection)),
      firstLine = editor.document.lineAt(editor.selection.start).text,
      firstLineStart = editor.selection.start.character

  if (firstLineStart === 0 || !isWord(firstLine.charCodeAt(firstLineStart - 1))) {
    text = `\\b${text}`
  }

  let lastLine = editor.document.lineAt(editor.selection.end).text,
      lastLineEnd = editor.selection.end.character

  if (lastLineEnd >= lastLine.length || !isWord(lastLine.charCodeAt(lastLineEnd))) {
    text = `${text}\\b`
  }

  return setSearchSelection(text, editor, extension)
})

function nextNeedleInHaystack(direction: Direction): (selection: vscode.Selection, helper: SelectionHelper<SearchState>) => vscode.Selection | undefined {
  const find = needleInHaystack(direction, /* allowWrapping = */ true)
  return (selection, helper) => {
    const result = find(selection, helper)
    if (result === undefined) return undefined
    const [start, end] = result
    // The result selection should always face forward,
    // regardless of old selection or search direction.
    return helper.selectionBetween(start, end)
  }
}

function registerNextCommand(command: Command, direction: Direction, replace: boolean) {
  const mapper = nextNeedleInHaystack(direction)
  registerCommand(command, CommandFlags.ChangeSelections, async (editorState, { currentRegister, selectionBehavior ,repetitions }) => {
    const { editor, extension } = editorState
    const regexStr = await (currentRegister ?? extension.registers.slash).get(editor)

    if (regexStr === undefined || regexStr.length === 0)
      return

    const regex = new RegExp(regexStr[0], 'g'),
          selections = editor.selections
    const searchState = { selectionBehavior, regex }
    const helper = SelectionHelper.for(editorState, searchState)
    let cur = selections[0]

    for (let i = repetitions; i > 0; i--) {
      const next = mapper(cur, helper)
      if (next === undefined) {
        vscode.window.showErrorMessage('No matches found.')
        return
      }
      cur = next

      if (replace)
        selections[0] = cur
      else
        selections.unshift(cur)
    }

    editor.selections = selections
  })
}

registerNextCommand(Command.searchNext       , Forward , true )
registerNextCommand(Command.searchNextAdd    , Forward , false)
registerNextCommand(Command.searchPrevious   , Backward, true )
registerNextCommand(Command.searchPreviousAdd, Backward, false)
