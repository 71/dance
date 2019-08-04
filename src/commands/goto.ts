import * as vscode from 'vscode'

import { registerCommand, Command, CommandDescriptor, CommandFlags, InputKind } from '.'


const jumps: [string, string][] = [
  ['h', 'go to line start'],
  ['l', 'go to line end'],
  ['i', 'go to non-blank line start'],
  ['g', 'go to first line'],
  ['k', 'go to first line'],
  ['j', 'go to last line'],
  ['e', 'go to last char of last line'],
  ['t', 'go to the first displayed line'],
  ['c', 'go to the middle displayed line'],
  ['b', 'go to the last displayed line'],
  ['a', 'go to previous buffer'],
  ['f', 'go to file whose name is selected'],
  ['.', 'go to last buffer modification position'],
]

function executeGoto(gotoType: number, editor: vscode.TextEditor, count: number, extend: boolean) {
  switch (gotoType) {
    case 0: // go to line start
      executeGotoLine(editor, count, extend, 'true')
      break
    case 1: // go to line end
      executeGotoLine(editor, count, extend, 'end')
      break
    case 2: // go to non-blank line start
      executeGotoLine(editor, count, extend, 'first')
      break
    case 3: // go to first line
    case 4: // go to first line
      executeGotoFirstLine(editor, count, extend)
      break
    case 5: // go to last line
      executeGotoLastLine(editor, count, extend)
      break
    case 6: // go to last char of last line
      executeGotoLastLine(editor, count, extend, true)
      break
    case 7: // go to first displayed line
      executeGotoDisplayLine(editor, count, extend, 'top')
      break
    case 8: // go to middle displayed line
      executeGotoDisplayLine(editor, count, extend, 'center')
      break
    case 9: // go to last displayed line
      executeGotoDisplayLine(editor, count, extend, 'bottom')
      break
    case 10: // go to previous buffer
      break
    case 11: // go to file whose name is selected
      break
    case 12: // go to last buffer modification position
      break
  }
}
function executeGotoLine(editor: vscode.TextEditor, count: number, extend: boolean, position:string = 'default') {
  const positions: { [index:string]: {(x: vscode.Selection): number} } = {
    'first': function (x: vscode.Selection) {
      return editor.document.lineAt(x.active.line).firstNonWhitespaceCharacterIndex
    },
    'end': function (x: vscode.Selection) {
      return editor.document.lineAt(x.active.line).range.end.character
    },
    'start': function (x: vscode.Selection) {
      return 0
    },
    'default': function (x: vscode.Selection) {
      return 0
    }
  };
  editor.selections = editor.selections.map(x =>
    {
      const npos:vscode.Position = new vscode.Position(x.active.line,  (positions[position] || positions['default'])(x));
      return new vscode.Selection(extend ? x.anchor : npos, npos)
    }
  )
}
function executeGotoDisplayLine(editor: vscode.TextEditor, count: number, extend: boolean, position:string) {
  const positions: { [index:string]: {(): number} } = {
    'top': function () {
      return editor.visibleRanges[0].start.line
    },
    'center': function () {
      return (editor.visibleRanges[0].end.line + editor.visibleRanges[0].start.line) / 2
    },
    'bottom': function () {
      //return editor.visibleRanges[editor.visibleRanges.length-1].start.line
      return editor.visibleRanges[0].end.line
    },
    'default': function () {
      return 0
    }
  };
  editor.selections = editor.selections.map(x =>
    {
      const npos:vscode.Position = new vscode.Position((positions[position] || positions['default'])(), 0);
      return new vscode.Selection(extend ? x.anchor : npos, npos)
    }
  )
}

function executeGotoFirstLine(editor: vscode.TextEditor, count: number, extend: boolean) {
  const nanch:vscode.Position = (extend
                                 ? editor.selections.map(x => x.anchor).reduce((prev, current) => (prev.isAfter(current) ? prev : current))
                                 : new vscode.Position(0,0));
  editor.selections = [new vscode.Selection(nanch, new vscode.Position(0,0))];
}
function executeGotoLastLine(editor: vscode.TextEditor, count: number, extend: boolean, gotoLastChar: boolean = false) {
  const lastline:number = (editor.document.lineCount > 0) ? (editor.document.lineCount-1) : editor.document.lineCount ;
  const npos:vscode.Position = new vscode.Position(lastline, gotoLastChar ? editor.document.lineAt(lastline).range.end.character : 0);
  const nanch:vscode.Position = (extend
                                 ? editor.selections.map(x => x.anchor).reduce((prev, current) => (prev.isBefore(current) ? prev : current))
                                 : npos);
  editor.selections = [new vscode.Selection(nanch, npos)];
}

registerCommand(Command.goto, CommandFlags.ChangeSelections, InputKind.ListOneItem, jumps, (editor, state, _, ctx) => {
  return executeGoto(state.input, editor, state.currentCount, false)
})

registerCommand(Command.gotoExtend, CommandFlags.ChangeSelections, InputKind.ListOneItem, jumps, (editor, state, _, ctx) => {
  return executeGoto(state.input, editor, state.currentCount, true)
})
