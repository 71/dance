import * as vscode from 'vscode'

import { DocumentState }           from './document'
import { Mode, SelectionBehavior } from './extension'
import { CommandState, InputKind, Command } from '../commands'
import { extensionName }           from '../extension'
import { assert }                  from '../utils/assert'
import { SavedSelection }          from '../utils/savedSelection'
import { MacroRegister } from '../registers'


/**
 * Editor-specific state.
 */
export class EditorState {
  /**
   * The internal identifir of the ID.
   *
   * Unlike documents, VS Code does not reuse `vscode.TextEditor` objects,
   * so comparing by reference using `===` may not always return `true`,
   * even for the same document. To keep editor-specific state anyway,
   * we're using its internal identifier, which seems to be unique and
   * to stay the same over time.
   */
  private _id: string

  /** The last matching editor. */
  private _editor: vscode.TextEditor

  /** Selections that we had before entering insert mode. */
  private _insertModeSelections?: readonly SavedSelection[]

  /** Whether a selection change event should be expected while in insert mode. */
  private _expectSelectionChangeEvent = false

  /** Whether the next selection change event should be ignored. */
  private _ignoreSelectionChangeEvent = false

  /** The ongoing recording of a macro in this editor. */
  private _macroRecording?: MacroRecording

  private _mode!: Mode

  /**
   * The mode of the editor.
   */
  get mode() {
    return this._mode
  }

  /**
   * The extension for which state is being kept.
   */
  get extension() {
    return this.documentState.extension
  }

  /**
   * The editor for which state is being kept.
   */
  get editor() {
    return this._editor
  }

  /**
   * Whether the editor for which state is being kept is the active text editor.
   */
  get isActive() {
    return vscode.window.activeTextEditor === this._editor
  }

  get selectionBehavior() {
    return this.documentState.extension.selectionBehavior
  }

  /**
   * Preferred columns when navigating up and down.
   */
  readonly preferredColumns: number[] = []

  constructor(
    /** The state of the document for which this editor exists. */
    readonly documentState: DocumentState,

    /** The text editor for which state is being kept. */
    editor: vscode.TextEditor,
  ) {
    this._id = getEditorId(editor)
    this._editor = editor

    this.setMode(Mode.Normal)
  }

  /**
   * Disposes of the resources owned by and of the subscriptions of this instance.
   */
  dispose() {
    const lineNumbering = vscode.workspace.getConfiguration('editor').get('lineNumbers'),
          options = this._editor.options

    options.lineNumbers = lineNumbering === 'on'       ? vscode.TextEditorLineNumbersStyle.On
                        : lineNumbering === 'relative' ? vscode.TextEditorLineNumbersStyle.Relative
                        : lineNumbering === 'interval' ? vscode.TextEditorLineNumbersStyle.Relative + 1
                        :                                vscode.TextEditorLineNumbersStyle.Off

    this.clearDecorations(this.extension.normalMode.decorationType)
    this.clearDecorations(this.extension.insertMode.decorationType)
    this._macroRecording?.dispose()
  }

  /**
   * Updates the instance of `vscode.TextEditor` for this editor.
   */
  updateEditor(editor: vscode.TextEditor) {
    assert(this.isFor(editor))

    this._editor = editor

    return this
  }

  /**
   * Returns whether this state is for the given editor.
   */
  isFor(editor: vscode.TextEditor) {
    return this.documentState.document === editor.document
        && this._id === getEditorId(editor)
  }

  /**
   * Sets the mode of the editor.
   */
  setMode(mode: Mode) {
    if (this._mode === mode)
      return

    const { insertMode, normalMode } = this.extension,
          documentState = this.documentState

    this._mode = mode

    if (mode === Mode.Insert) {
      this.clearDecorations(normalMode.decorationType)
      this.setDecorations(insertMode.decorationType)

      const selections = this.editor.selections,
            documentState = this.documentState,
            savedSelections = [] as SavedSelection[]

      for (let i = 0, len = selections.length; i < len; i++) {
        savedSelections.push(documentState.saveSelection(selections[i]))
      }

      this._insertModeSelections = savedSelections
      this._ignoreSelectionChangeEvent = true

      if (this.extension.insertModeSelectionStyle !== undefined)
        this.editor.setDecorations(this.extension.insertModeSelectionStyle, selections)
    } else {
      if (this._insertModeSelections !== undefined) {
        const savedSelections = this._insertModeSelections,
              editorSelections = this._editor.selections,
              document = this.documentState.document

        assert(editorSelections.length === savedSelections.length)

        for (let i = 0, len = savedSelections.length; i < len; i++) {
          editorSelections[i] = savedSelections[i].selection(document)
        }

        documentState.forgetSelections(this._insertModeSelections)

        this._editor.selections = editorSelections
        this._insertModeSelections = undefined
      }

      this.clearDecorations(insertMode.decorationType)
      this.clearDecorations(this.extension.insertModeSelectionStyle)
      this.setDecorations(normalMode.decorationType)

      this.normalizeSelections()
    }

    if (this.isActive) {
      this.onDidBecomeActive()
    }
  }

  /**
   * Starts recording a macro, setting up relevant handlers and UI elements.
   */
  startMacroRecording(register: MacroRegister & { readonly name: string }) {
    if (this._macroRecording !== undefined)
      return undefined

    const statusBarItem = vscode.window.createStatusBarItem()

    statusBarItem.command = Command.macrosRecordStop
    statusBarItem.text = `Macro recording in ${register.name}`

    this._macroRecording = new MacroRecording(register, this._commands.length, statusBarItem)

    return this._macroRecording.show().then(() => this._macroRecording)
  }

  /**
   * Stops recording a macro, disposing of its resources.
   */
  stopMacroRecording() {
    const recording = this._macroRecording

    if (recording === undefined)
      return undefined

    this._macroRecording = undefined

    return recording.dispose().then(() => recording)
  }

  /**
   * Called when `vscode.window.onDidChangeActiveTextEditor` is triggered with this editor.
   */
  onDidBecomeActive() {
    const { editor, mode } = this,
          modeConfiguration = mode === Mode.Insert ? this.extension.insertMode : this.extension.normalMode

    if (mode === Mode.Insert) {
      this.extension.statusBarItem.text = '$(pencil) INSERT'
    } else if (mode === Mode.Normal) {
      this.extension.statusBarItem.text = '$(beaker) NORMAL'
    }

    this._macroRecording?.show()

    editor.options.lineNumbers = modeConfiguration.lineNumbers
    editor.options.cursorStyle = modeConfiguration.cursorStyle

    vscode.commands.executeCommand('setContext', extensionName + '.mode', mode)
  }

  /**
   * Called when `vscode.window.onDidChangeActiveTextEditor` is triggered with another editor.
   */
  onDidBecomeInactive() {
    if (this.mode === Mode.Awaiting)
      this.setMode(Mode.Normal)

    this._macroRecording?.hide()
  }

  /**
   * Called when `vscode.window.onDidChangeTextEditorSelection` is triggered.
   */
  onDidChangeTextEditorSelection(e: vscode.TextEditorSelectionChangeEvent) {
    const mode = this.mode

    if (mode === Mode.Awaiting)
      this.setMode(Mode.Normal)

    // Update decorations.
    if (mode === Mode.Insert) {
      if (this._ignoreSelectionChangeEvent) {
        this._ignoreSelectionChangeEvent = false

        return
      }

      this.setDecorations(this.extension.insertMode.decorationType)

      // Update insert mode decorations that keep track of previous selections.
      const mustDropSelections = e.kind === vscode.TextEditorSelectionChangeKind.Command
                              || e.kind === vscode.TextEditorSelectionChangeKind.Mouse
                              || !this._expectSelectionChangeEvent

      const selectionStyle = this.extension.insertModeSelectionStyle,
            decorationRanges = [] as vscode.Range[]

      if (mustDropSelections) {
        this._insertModeSelections = []

        if (selectionStyle !== undefined)
          this.editor.setDecorations(selectionStyle, [])
      } else if (selectionStyle !== undefined) {
        const insertModeSelections = this._insertModeSelections

        if (insertModeSelections !== undefined) {
          const document = this.documentState.document

          for (let i = 0, len = insertModeSelections.length; i < len; i++) {
            const insertModeSelection = insertModeSelections[i]

            if (insertModeSelection.activeOffset !== insertModeSelection.anchorOffset)
              decorationRanges.push(insertModeSelection.selection(document))
          }
        }

        this.editor.setDecorations(selectionStyle, decorationRanges)
      }
    } else {
      this.setDecorations(this.extension.normalMode.decorationType)
    }

    // Debounce normalization.
    if (this.normalizeTimeoutToken !== undefined) {
      clearTimeout(this.normalizeTimeoutToken)
      this.normalizeTimeoutToken = undefined
    }

    if (e.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
      this.normalizeTimeoutToken = setTimeout(() => {
        this.normalizeSelections()
        this.normalizeTimeoutToken = undefined
      }, 200)
    } else {
      this.normalizeSelections()
    }
  }

  /**
   * Called when `vscode.workspace.onDidChangeTextDocument` is triggered on the document of the editor.
   */
  onDidChangeTextDocument(e: vscode.TextDocumentChangeEvent) {
    if (this._mode === Mode.Insert) {
      const changes = e.contentChanges

      if (this.editor.selections.length !== changes.length) {
        return
      }

      // Find all matching selections for the given changes.
      // If all selections have a match, we can continue.
      const remainingSelections = new Set(this.editor.selections)

      for (let i = 0, len = changes.length; i < len; i++) {
        const change = changes[i]

        for (const selection of remainingSelections) {
          if (selection.active.isEqual(change.range.start) || selection.active.isEqual(change.range.end)) {
            remainingSelections.delete(selection)

            break
          }
        }

        if (remainingSelections.size !== len - i - 1)
          return
      }

      this._expectSelectionChangeEvent = true

      setImmediate(() => this._expectSelectionChangeEvent = false)
    }
  }


  // =============================================================================================
  // ==  DECORATIONS  ============================================================================
  // =============================================================================================

  private clearDecorations(decorationType: vscode.TextEditorDecorationType | undefined) {
    if (decorationType !== undefined)
      this._editor.setDecorations(decorationType, [])
  }

  setDecorations(decorationType: vscode.TextEditorDecorationType | undefined) {
    if (decorationType === undefined)
      return

    const editor = this._editor,
          selection = editor.selection,
          extension = this.extension

    if (selection.end.character === 0 && selection.end.line > 0 && extension.selectionBehavior === SelectionBehavior.Character) {
      editor.setDecorations(decorationType, [new vscode.Range(selection.start, selection.end.with(selection.end.line - 1, 0))])
      editor.options.cursorStyle = vscode.TextEditorCursorStyle.LineThin
    } else {
      editor.setDecorations(decorationType, [selection])
      editor.options.cursorStyle = this.mode === Mode.Insert ? extension.insertMode.cursorStyle : extension.normalMode.cursorStyle
    }
  }


  // =============================================================================================
  // ==  HISTORY  ================================================================================
  // =============================================================================================

  private readonly _commands = [] as CommandState<any>[]

  /**
   * The commands that were last used in this editor, from the earliest to the latest.
   */
  get recordedCommands() {
    return this._commands as readonly CommandState<any>[]
  }

  /**
   * Records invocation of a command.
   */
  recordCommand<I extends InputKind>(state: CommandState<I>) {
    this.documentState.recordCommand(state)
    this._commands.push(state)

    if (this._macroRecording) {
      if (this._commands.length === 50)
        vscode.window.showWarningMessage(
          "You're recording a lot of commands. This may increase memory usage.")
    } else {
      // If not recording, limit history to 20 items to avoid eating RAM.
      while (this._commands.length > 20) this._commands.shift()
    }
  }

  // =============================================================================================
  // ==  SELECTION NORMALIZATION  ================================================================
  // =============================================================================================

  private normalizeTimeoutToken: NodeJS.Timeout | undefined = undefined

  /**
   * Whether selection changes should be ignored, therefore not automatically normalizing selections.
   */
  ignoreSelectionChanges = false

  /**
   * Make all selections in the editor non-empty by selecting at least one character.
   */
  normalizeSelections() {
    if (this._mode !== Mode.Normal || this.extension.selectionBehavior === SelectionBehavior.Caret || this.ignoreSelectionChanges)
      return

    const editor = this._editor

    // Since this is called every time when selection changes, avoid allocations
    // unless really needed and iterate manually without using helper functions.
    let normalizedSelections: vscode.Selection[] | undefined = undefined

    for (let i = 0; i < editor.selections.length; i++) {
      const selection = editor.selections[i]
      const isReversedOneCharacterSelection = selection.isSingleLine
        ? (selection.anchor.character === selection.active.character + 1)
        : (selection.anchor.character === 0 && selection.anchor.line === selection.active.line + 1 && editor.document.lineAt(selection.active).text.length === selection.active.character)

      if (isReversedOneCharacterSelection) {
        if (normalizedSelections === undefined) {
          // Change needed. Allocate the new array and copy what we have so far.
          normalizedSelections = editor.selections.slice(0, i)
        }

        normalizedSelections.push(new vscode.Selection(selection.active, selection.anchor))
      } else if (selection.isEmpty) {
        if (normalizedSelections === undefined) {
          // Change needed. Allocate the new array and copy what we have so far.
          normalizedSelections = editor.selections.slice(0, i)
        }

        const active = selection.active

        if (active.character >= editor.document.lineAt(active.line).range.end.character) {
          // Selection is at line end. Select line break.
          if (active.line === editor.document.lineCount - 1) {
            // Selection is at the very end of the document as well. Select the last character instead.
            if (active.character === 0) {
              if (active.line === 0) {
                // There is no character in this document, so we give up on normalizing.
                continue
              } else {
                normalizedSelections.push(new vscode.Selection(new vscode.Position(active.line - 1, Number.MAX_SAFE_INTEGER), active))
              }
            } else {
              normalizedSelections.push(new vscode.Selection(active.translate(0, -1), active))
            }
          } else {
            normalizedSelections.push(new vscode.Selection(active, new vscode.Position(active.line + 1, 0)))
          }
        } else {
          const offset = editor.document.offsetAt(selection.active)
          const nextPos = editor.document.positionAt(offset + 1)

          if (nextPos.isAfter(selection.active)) {
            // Move cursor forward.
            normalizedSelections.push(new vscode.Selection(active, active.translate(0, 1)))
          } else {
            // Selection is at the very end of the document. Select the last character instead.
            normalizedSelections.push(new vscode.Selection(active.translate(0, -1), active))
          }
        }
      } else if (normalizedSelections !== undefined) {
        normalizedSelections.push(selection)
      }
    }

    if (normalizedSelections !== undefined)
      editor.selections = normalizedSelections
  }
}

function getEditorId(editor: vscode.TextEditor) {
  return (editor as unknown as { readonly id: string }).id
}

/**
 * An ongoing recording of a macro.
 */
export class MacroRecording {
  constructor(
    readonly register: MacroRegister,
    public lastHistoryEntry: number,
    readonly statusBarItem: vscode.StatusBarItem,
  ) {}

  show() {
    this.statusBarItem.show()

    return vscode.commands.executeCommand('setContext', extensionName + '.recordingMacro', true)
  }

  hide() {
    this.statusBarItem.hide()

    return vscode.commands.executeCommand('setContext', extensionName + '.recordingMacro', false)
  }

  dispose() {
    this.statusBarItem.dispose()

    return vscode.commands.executeCommand('setContext', extensionName + '.recordingMacro', false)
  }
}
