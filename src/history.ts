import * as vscode from 'vscode'

import { CommandDescriptor, CommandState, InputKind } from './commands'
import { Register } from './registers'
import { OffsetEdgeTransformationBehaviour, OffsetRange, OffsetSelection } from './utils/offsetSelection'


export class HistoryManager {
  private readonly map = new WeakMap<vscode.TextDocument, DocumentHistory>()
  private readonly changeDisposable: vscode.Disposable

  readonly jumpList = [] as vscode.Selection[][]

  constructor() {
    this.changeDisposable = vscode.workspace.onDidChangeTextDocument(change => {
      this.for(change.document).handleChanges(change.contentChanges)
    })
  }

  for (document: vscode.TextDocument) {
    let documentHistory = this.map.get(document)

    if (documentHistory === undefined)
      this.map.set(document, documentHistory = new DocumentHistory())

    return documentHistory
  }

  dispose() {
    this.changeDisposable.dispose()
  }
}

interface PreparedChanges {
  initialRemoveRange: OffsetRange
  remove: OffsetRange
  insert: number
  offsetChange: number
  absOffsetChange: number
  absOffsetChangeBefore: number
}

export class DocumentHistory {
  readonly commands = [] as [CommandDescriptor<any>, CommandState<any>][]
  readonly changes = new WeakMap<CommandState<any>, vscode.TextDocumentContentChangeEvent[]>()
  readonly marks = new Map<Register, OffsetSelection[]>()
  lastSelections = [] as OffsetSelection[]
  lastBufferModification = undefined as vscode.Range | undefined

  private prepareChanges(changes: vscode.TextDocumentContentChangeEvent[]) {
    let prepChanges = changes.slice() // Copy arry with slice
      .sort((c1, c2) => c1.range.start.compareTo(c2.range.start))
      .map(c => {
          let offRange = new OffsetRange(c.rangeOffset, c.rangeOffset + c.rangeLength)
          return <PreparedChanges> {
            initialRemoveRange: offRange,
            remove: offRange,
            insert: c.text.length,
            offsetChange: c.text.length - c.rangeLength,
            absOffsetChange: c.text.length - c.rangeLength,
            absOffsetChangeBefore: 0,
          }
      })
    for (let i = 1; i < prepChanges.length; i++) {
      prepChanges[i].absOffsetChangeBefore = prepChanges[i-1].absOffsetChange 
      prepChanges[i].absOffsetChange       = prepChanges[i-1].absOffsetChange + prepChanges[i].offsetChange
      prepChanges[i].remove                = prepChanges[i].remove.translate(prepChanges[i].absOffsetChangeBefore)
    }

    return prepChanges
  }

  /**
   *    The current implementation tracks the offsets instead of line and column.
   *    Projecting changes to offsets is easier to handle than implementing a routine using lines and characters explicitly.
   *    Moreover it is the most reliable way in VSCode. The only problem with offsets may be the peformance of recomputing positions from offsets.
   *    I have no idea have VSCode is implementing the function editor.positionAt - but the complexity might be higher
   *    than tracking relative line and column changens directly.
   *
   *    If there are performance issues for large files, a reimplementation is necessary.
   *    Then TextDocumentContentChangeEvent.range information can be used to determine
   *
   *      * how many lines are removed for changes occuring before any selection
   *      * special handling when changes are removed on same lines...
   *
   *    Similarily TextDocumentContentChangeEvent.text is used to determine the number of inserted lines by counting the occurrenc of '\n'...
   */
  private updateChanges(offsetSelections: OffsetSelection[], changes: PreparedChanges[]) {
    return offsetSelections.map(s => {
      if (changes.length === 0) return s
      // If current selection is before all changes...
      if (s.end < changes[0].initialRemoveRange.start) return s
      // If current selection is after all changes...
      if (s.start > changes[changes.length - 1].initialRemoveRange.end) return s.translateSelection(changes[changes.length - 1].absOffsetChange)

      const filteredChanges = changes.filter(c => s.intersects(c.initialRemoveRange))
      
      //! Apply all changes
      //! The changes are ordered and hence already should have the right precomputed offset
      if (filteredChanges.length > 0) {
        let newSel: OffsetSelection | undefined = s.translateSelection(filteredChanges[0].absOffsetChangeBefore)
        for (let i = 0; i < filteredChanges.length; ++i) {
          newSel = newSel.removeAndInsert(filteredChanges[i].remove, filteredChanges[i].insert)
          if (newSel === undefined) {
            return undefined
          }
        }
        return newSel
      }
      return s
    }).filter(s => s !== undefined) as OffsetSelection[]
  }

  handleChanges(changes: vscode.TextDocumentContentChangeEvent[]) {
    // Handle marks and selections
    if (changes.length > 0) {
      this.lastBufferModification = changes[0].range
      let changesAccum = this.prepareChanges(changes)
      this.lastSelections = this.updateChanges(this.lastSelections, changesAccum)
      this.marks.forEach(
        (sels, register: Register, map) => map.set(register, this.updateChanges(sels, changesAccum))
      )
    }

    // Handle command changes
    if (this.commands.length === 0)
      return

    const commandState = this.commands[this.commands.length - 1][1]
    const allChanges = this.changes.get(commandState)

    if (allChanges === undefined)
      this.changes.set(commandState, changes)
    else
      allChanges.push(...changes)
  }

  addCommand<I extends InputKind>(command: CommandDescriptor<I>, state: CommandState<I>) {
    this.commands.push([command, state])
  }

  getChanges<I extends InputKind>(commandState: CommandState<I>) {
    return this.changes.get(commandState) || [] as readonly vscode.TextDocumentContentChangeEvent[]
  }

  setLastSelections(document: vscode.TextDocument, newSelections: vscode.Selection[], transformationBehaviour: OffsetEdgeTransformationBehaviour = OffsetEdgeTransformationBehaviour.ExclusiveStart) {
    this.lastSelections = newSelections.map(sel => new OffsetSelection(document.offsetAt(sel.anchor), document.offsetAt(sel.active), transformationBehaviour))
  }

  getLastSelections(document: vscode.TextDocument): vscode.Selection[] {
    return this.lastSelections.map(offsetSel => offsetSel.toVSCodeSelection(document))
  }

  setSelectionsForMark(document: vscode.TextDocument, register: Register, selections: vscode.Selection[]) {
    this.marks.set(register, selections.map(sel => new OffsetSelection(document.offsetAt(sel.anchor), document.offsetAt(sel.active))))
  }

  getSelectionsForMark(document: vscode.TextDocument, register: Register) {
    const offSel = this.marks.get(register)
    
    if (offSel) {
      return offSel.map(offsetSel => offsetSel.toVSCodeSelection(document))
    }
    
    return [] as vscode.Selection[]
  }
}
