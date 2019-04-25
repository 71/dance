import * as vscode from 'vscode'

import { Command } from './commands'


export class HistoryManager {
  private readonly map = new WeakMap<vscode.TextDocument, DocumentHistory>()
  private readonly changeDisposable: vscode.Disposable

  constructor() {
    this.changeDisposable = vscode.workspace.onDidChangeTextDocument(change => {
      this.for(change.document).handleChanges(change.contentChanges)
    })
  }

  for(document: vscode.TextDocument) {
    let documentHistory = this.map.get(document)

    if (documentHistory === undefined)
      this.map.set(document, documentHistory = new DocumentHistory())

    return documentHistory
  }

  dispose() {
    this.changeDisposable.dispose()
  }
}

export class DocumentHistory {
  private readonly changes = [] as HistoryItem[][]
  private currentChanges = [] as HistoryItem[]
  private ignoreChanges  = false

  private addHistoryItem(item: HistoryItem) {
    if (!this.ignoreChanges)
      this.currentChanges.push(item)
  }

  handleChanges(changes: vscode.TextDocumentContentChangeEvent[]) {
    this.addHistoryItem({ type: HistoryItemKind.Change, changes })
  }

  addKeypress(key: string) {
    this.addHistoryItem({ type: HistoryItemKind.Keypress, key })
  }

  addCount(count: number) {
    this.addHistoryItem({ type: HistoryItemKind.Count, count })
  }

  addPromptedText(input: string) {
    this.addHistoryItem({ type: HistoryItemKind.PromptedText, input })
  }

  addPromptedList(input: number | number[]) {
    this.addHistoryItem({ type: HistoryItemKind.PromptedList, input })
  }

  addPromptedRegex(input: RegExp) {
    this.addHistoryItem({ type: HistoryItemKind.PromptedRegex, input })
  }

  startCommand(command: Command) {
    switch (command) {
      case Command.tmpNormal:
      case Command.tmpInsert:
        return
    }

    this.addHistoryItem({ type: HistoryItemKind.Command, command })
    this.ignoreChanges = true
  }

  endCommand(_: Command) {
    this.ignoreChanges = false
  }
}


const enum HistoryItemKind {
  Change, Keypress, Count, PromptedText, PromptedList, PromptedRegex, Command
}

type HistoryItem =
  | { type: HistoryItemKind.Change  , changes: vscode.TextDocumentContentChangeEvent[] }
  | { type: HistoryItemKind.Command , command: Command }
  | { type: HistoryItemKind.Count   , count: number }
  | { type: HistoryItemKind.Keypress, key: string }
  | { type: HistoryItemKind.PromptedList , input: number | number[] }
  | { type: HistoryItemKind.PromptedRegex, input: RegExp }
  | { type: HistoryItemKind.PromptedText , input: string }
