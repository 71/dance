import * as vscode from 'vscode'


export function getOppositePosition(document: vscode.TextDocument, text: string, position: vscode.Position, isStart: boolean) {
  if (isStart) {
    let line = position.line
    let char = position.character

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\r') {
        line++
        i++
        char = 0
      } else if (text[i] === '\n') {
        line++
        char = 0
      } else {
        char++
      }
    }

    return new vscode.Position(line, char)
  } else {
    let line = position.line
    let char = position.character

    for (let i = text.length - 1; i >= 0; i--) {
      if (text[i] === '\r') {
        line--
        i--
        char = document.lineAt(line).range.end.character
      } else if (text[i] === '\n') {
        line--
        char = document.lineAt(line).range.end.character
      } else {
        char--
      }
    }

    return new vscode.Position(line, char)
  }
}

export function getSelectionFromStart(document: vscode.TextDocument, text: string, position: vscode.Position) {
  return new vscode.Selection(position, getOppositePosition(document, text, position, true))
}

export function getSelectionFromEnd(document: vscode.TextDocument, text: string, position: vscode.Position) {
  return new vscode.Selection(getOppositePosition(document, text, position, false), position)
}
