import * as vscode from 'vscode'

import { CommandDescriptor, CommandState, InputKind } from './commands'


export class HistoryManager {
  private readonly map = new WeakMap<vscode.TextDocument, DocumentHistory>()
  private readonly changeDisposable: vscode.Disposable

  readonly jumpList = [] as vscode.Selection[][]

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
  readonly commands = [] as [CommandDescriptor<any>, CommandState<any>][]
  readonly changes = new WeakMap<CommandState<any>, vscode.TextDocumentContentChangeEvent[]>()

  handleChanges(changes: vscode.TextDocumentContentChangeEvent[]) {
    if (this.commands.length === 0)
      return

    const commandState = this.commands[this.commands.length - 1][1]
    const allChanges = this.changes.get(commandState)

    if (allChanges === undefined)
      this.changes.set(commandState, [...changes])
    else
      allChanges.push(...changes)
  }

  addCommand<I extends InputKind>(command: CommandDescriptor<I>, state: CommandState<I>) {
    this.commands.push([command, state])
  }

  getChanges<I extends InputKind>(commandState: CommandState<I>) {
    return this.changes.get(commandState) || [] as readonly vscode.TextDocumentContentChangeEvent[]
  }
}
