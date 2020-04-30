import * as fs     from 'fs'
import * as path   from 'path'
import * as vscode from 'vscode'

import { registerCommand, Command, CommandFlags, CommandState, commands } from '.'
import { EditorState } from '../state/editor'
import { ExtendBehavior, Extend, DoNotExtend, SelectionHelper, MoveFunc, SelectionMapper, jumpTo, CoordMapper } from '../utils/selectionHelper'
import { SelectionBehavior } from '../state/extension'


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

const toStartCharacterFunc: CoordMapper = (from) => from.with(undefined, 0)
const toFirstNonBlankCharacterFunc: CoordMapper = (from, { editor }) =>
    from.with(undefined, editor.document.lineAt(from).firstNonWhitespaceCharacterIndex)

// TODO: Also need to set preferredColumn to max.
const toEndCharacterFunc: CoordMapper = (from, helper) => {
  const lineLen = helper.editor.document.lineAt(from).text.length
  if (lineLen === 0 || helper.selectionBehavior === SelectionBehavior.Caret)
    return from.with(undefined, lineLen)
  else
    return from.with(undefined, lineLen - 1)
}

function toCharacter(func: CoordMapper, extend: ExtendBehavior) {
  const mapper = jumpTo(func, extend)
  // TODO: Should also reveal selection active(s) after moving.
  return (editorState: EditorState, commandState: CommandState) =>
    SelectionHelper.for(editorState, commandState).mapEach(mapper)
}

registerCommand(Command.gotoLineStart              , CommandFlags.ChangeSelections, toCharacter(toStartCharacterFunc        , DoNotExtend))
registerCommand(Command.gotoLineStartExtend        , CommandFlags.ChangeSelections, toCharacter(toStartCharacterFunc        ,      Extend))
registerCommand(Command.gotoLineStartNonBlank      , CommandFlags.ChangeSelections, toCharacter(toFirstNonBlankCharacterFunc, DoNotExtend))
registerCommand(Command.gotoLineStartNonBlankExtend, CommandFlags.ChangeSelections, toCharacter(toFirstNonBlankCharacterFunc,      Extend))
registerCommand(Command.gotoLineEnd                , CommandFlags.ChangeSelections, toCharacter(toEndCharacterFunc          , DoNotExtend))
registerCommand(Command.gotoLineEndExtend          , CommandFlags.ChangeSelections, toCharacter(toEndCharacterFunc          ,      Extend))

const toFirstVisibleLineFunc: CoordMapper = (from, { editor }) =>
    from.with(editor.visibleRanges[0].start.line, 0)

const toLastVisibleLineFunc: CoordMapper = (from, { editor }) =>
    from.with(editor.visibleRanges[0].end.line, 0)

// TODO: Sometimes TypeError: cannot read property length of undefined is thrown.
const toMiddleVisibleLineFunc: CoordMapper = (from, { editor }) =>
    from.with((editor.visibleRanges[0].end.line + editor.visibleRanges[0].start.line) / 2, 0)

registerCommand(Command.gotoFirstVisibleLine       , CommandFlags.ChangeSelections, toCharacter( toFirstVisibleLineFunc, DoNotExtend))
registerCommand(Command.gotoFirstVisibleLineExtend , CommandFlags.ChangeSelections, toCharacter( toFirstVisibleLineFunc,      Extend))
registerCommand(Command.gotoMiddleVisibleLine      , CommandFlags.ChangeSelections, toCharacter(toMiddleVisibleLineFunc, DoNotExtend))
registerCommand(Command.gotoMiddleVisibleLineExtend, CommandFlags.ChangeSelections, toCharacter(toMiddleVisibleLineFunc,      Extend))
registerCommand(Command.gotoLastVisibleLine        , CommandFlags.ChangeSelections, toCharacter(  toLastVisibleLineFunc, DoNotExtend))
registerCommand(Command.gotoLastVisibleLineExtend  , CommandFlags.ChangeSelections, toCharacter(  toLastVisibleLineFunc,      Extend))

const toFirstLineFunc: CoordMapper = () => new vscode.Position(0, 0)

const toLastLineStartFunc: CoordMapper = (_, helper) => {
  const document = helper.editor.document
  let line = document.lineCount - 1

  // In case of trailing line break, go to the second last line.
  if (line > 0 && document.lineAt(document.lineCount - 1).text.length === 0)
    line--

  return new vscode.Position(line, 0)
}

// TODO: Also need to set preferredColumn to max.
const toLastLineEndFunc: CoordMapper = (_, helper) => {
  const document = helper.editor.document
  const line = document.lineCount - 1
  const lineLen = document.lineAt(document.lineCount - 1).text.length
  return new vscode.Position(line, lineLen)
}

registerCommand(Command.gotoFirstLine      , CommandFlags.ChangeSelections, toCharacter(toFirstLineFunc, DoNotExtend))
registerCommand(Command.gotoFirstLineExtend, CommandFlags.ChangeSelections, toCharacter(toFirstLineFunc,      Extend))

registerCommand(Command.gotoLastLine           , CommandFlags.ChangeSelections, toCharacter(toLastLineStartFunc, DoNotExtend))
registerCommand(Command.gotoLastLineExtend     , CommandFlags.ChangeSelections, toCharacter(toLastLineStartFunc,      Extend))
registerCommand(Command.gotoLastCharacter      , CommandFlags.ChangeSelections, toCharacter(toLastLineEndFunc  , DoNotExtend))
registerCommand(Command.gotoLastCharacterExtend, CommandFlags.ChangeSelections, toCharacter(toLastLineEndFunc  ,      Extend))

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
