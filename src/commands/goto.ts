import * as fs     from 'fs'
import * as path   from 'path'
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, CommandState, commands } from '.'
import { EditorState } from '../state/editor'
import { ExtendBehavior, Extend, DoNotExtend, SelectionHelper, MoveFunc } from '../utils/selectionHelper'


registerCommand(Command.goto, CommandFlags.ChangeSelections, (editorState, state) => {
  if (state.input === null) {
    const { editor } = editorState,
          { document } = editor
    let line = state.currentCount - 1

    if (line >= document.lineCount)
      line = document.lineCount - 1

    const active = new vscode.Position(line, 0),
          anchor = new vscode.Position(line, 0)

    editor.selections = [new vscode.Selection(anchor, active)]

    return
  } else {
    return commands.find(x => x.command === Command.openMenu)!.execute(editorState, { menu: 'goto' })
  }
})

registerCommand(Command.gotoExtend, CommandFlags.ChangeSelections, (editorState, state) => {
  if (state.input === null) {
    const { editor } = editorState,
          { document, selection } = editor
    let line = state.currentCount - 1

    if (line >= document.lineCount)
      line = document.lineCount - 1

    const anchor = selection.anchor,
          active = new vscode.Position(line, 0)

    editor.selections = [new vscode.Selection(anchor, active)]

    return
  } else {
    return commands.find(x => x.command === Command.openMenu)!.execute(editorState, { menu: 'goto.extend' })
  }
})

const toStartCharacterFunc: MoveFunc = (from) => ({
  active: 'atOrBefore',
  maybeAnchor: from.with(undefined, 0),
})
const toFirstNonBlankCharacterFunc: MoveFunc = (from, { editor }) => ({
  active: 'atOrBefore',
  maybeAnchor: from.with(undefined, editor.document.lineAt(from).firstNonWhitespaceCharacterIndex),
})
const toEndCharacterFunc: MoveFunc = (from) => ({
  active: 'atOrBefore',
  maybeAnchor: from.with(undefined, Number.MAX_SAFE_INTEGER),
})

function toCharacter(func: MoveFunc, extend: ExtendBehavior) {
  return (editorState: EditorState, commandState: CommandState) =>
    SelectionHelper.for(editorState, commandState).moveEach(func, extend)
}

registerCommand(Command.gotoLineStart              , CommandFlags.ChangeSelections, toCharacter(toStartCharacterFunc        , DoNotExtend))
registerCommand(Command.gotoLineStartExtend        , CommandFlags.ChangeSelections, toCharacter(toStartCharacterFunc        ,      Extend))
registerCommand(Command.gotoLineStartNonBlank      , CommandFlags.ChangeSelections, toCharacter(toFirstNonBlankCharacterFunc, DoNotExtend))
registerCommand(Command.gotoLineStartNonBlankExtend, CommandFlags.ChangeSelections, toCharacter(toFirstNonBlankCharacterFunc,      Extend))
registerCommand(Command.gotoLineEnd                , CommandFlags.ChangeSelections, toCharacter(toEndCharacterFunc          , DoNotExtend))
registerCommand(Command.gotoLineEndExtend          , CommandFlags.ChangeSelections, toCharacter(toEndCharacterFunc          ,      Extend))

const toFirstVisibleLineFunc: MoveFunc = (from, { editor }) => ({
  active: 'atOrBefore',
  maybeAnchor: from.with(editor.visibleRanges[0].start.line),
})
const toMiddleVisibleLineFunc: MoveFunc = (from, { editor }) => ({
  active: 'atOrBefore',
  maybeAnchor: from.with((editor.visibleRanges[0].end.line + editor.visibleRanges[0].start.line) / 2),
})
const toLastVisibleLineFunc: MoveFunc = (from, { editor }) => ({
  active: 'atOrBefore',
  maybeAnchor: from.with(editor.visibleRanges[0].end.line),
})

function toVisibleLine(func: MoveFunc, extend: ExtendBehavior) {
  return (editorState: EditorState, commandState: CommandState) =>
    SelectionHelper.for(editorState, commandState).moveEach(func, extend)
}

registerCommand(Command.gotoFirstVisibleLine       , CommandFlags.ChangeSelections, toVisibleLine( toFirstVisibleLineFunc, DoNotExtend))
registerCommand(Command.gotoFirstVisibleLineExtend , CommandFlags.ChangeSelections, toVisibleLine( toFirstVisibleLineFunc,      Extend))
registerCommand(Command.gotoMiddleVisibleLine      , CommandFlags.ChangeSelections, toVisibleLine(toMiddleVisibleLineFunc, DoNotExtend))
registerCommand(Command.gotoMiddleVisibleLineExtend, CommandFlags.ChangeSelections, toVisibleLine(toMiddleVisibleLineFunc,      Extend))
registerCommand(Command.gotoLastVisibleLine        , CommandFlags.ChangeSelections, toVisibleLine(  toLastVisibleLineFunc, DoNotExtend))
registerCommand(Command.gotoLastVisibleLineExtend  , CommandFlags.ChangeSelections, toVisibleLine(  toLastVisibleLineFunc,      Extend))

function toFirstLine({ editor }: EditorState, extend: ExtendBehavior) {
  const active = new vscode.Position(0, 0),
        anchor = extend
          ? editor.selections
              .map(x => x.anchor)
              .reduce((furthestFromStart, current) => furthestFromStart.isAfter(current) ? furthestFromStart : current)
          : active

  editor.selections = [new vscode.Selection(anchor, active)]
}

registerCommand(Command.gotoFirstLine      , CommandFlags.ChangeSelections, (editorState) => toFirstLine(editorState, DoNotExtend))
registerCommand(Command.gotoFirstLineExtend, CommandFlags.ChangeSelections, (editorState) => toFirstLine(editorState,      Extend))

function toLastLine({ editor }: EditorState, extend: ExtendBehavior, gotoLastChar: boolean = false) {
  const active = new vscode.Position(editor.document.lineCount - 1, gotoLastChar ? Number.MAX_SAFE_INTEGER : 0),
        anchor = extend
          ? editor.selections
              .map(x => x.anchor)
              .reduce((furthestFromEnd, current) => furthestFromEnd.isBefore(current) ? furthestFromEnd : current)
          : active

  editor.selections = [new vscode.Selection(anchor, active)]
}

registerCommand(Command.gotoLastLine           , CommandFlags.ChangeSelections, (editorState) => toLastLine(editorState, DoNotExtend, false))
registerCommand(Command.gotoLastLineExtend     , CommandFlags.ChangeSelections, (editorState) => toLastLine(editorState,      Extend, false))
registerCommand(Command.gotoLastCharacter      , CommandFlags.ChangeSelections, (editorState) => toLastLine(editorState, DoNotExtend, true))
registerCommand(Command.gotoLastCharacterExtend, CommandFlags.ChangeSelections, (editorState) => toLastLine(editorState,      Extend, true))

registerCommand(Command.gotoSelectedFile, CommandFlags.ChangeSelections, ({ editor }) => {
  const basePath = path.dirname(editor.document.fileName)

  return new Promise<void>(resolve => fs.exists(basePath, exists => {
    if (!exists)
      return

    const selections = editor.selections
    let remaining = selections.length

    for (const selection of selections) {
      const filename = editor.document.getText(selection)
      const filepath = path.resolve(basePath, filename)

      fs.exists(filepath, exists => {
        if (exists) {
          vscode.workspace.openTextDocument(filepath)
            .then(vscode.window.showTextDocument)
        } else {
          vscode.window.showErrorMessage(`File ${filepath} does not exist.`)
        }

        if (--remaining === 0)
          resolve()
      })
    }
  }))
})

function toLastBufferModification(editorState: EditorState, extend: ExtendBehavior) {
  const { documentState, editor } = editorState

  if (documentState.recordedChanges.length > 0) {
    const range = documentState.recordedChanges[documentState.recordedChanges.length - 1].range,
          selection = range.selection(documentState.document)

    editor.selection = extend ? new vscode.Selection(editor.selection.anchor, selection.active) : selection
  }
}

registerCommand(Command.gotoLastModification      , CommandFlags.ChangeSelections, (editorState) => toLastBufferModification(editorState, DoNotExtend))
registerCommand(Command.gotoLastModificationExtend, CommandFlags.ChangeSelections, (editorState) => toLastBufferModification(editorState,      Extend))
