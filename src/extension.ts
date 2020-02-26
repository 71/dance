import * as vscode from 'vscode'

import { commands, Mode }      from './commands/index'
import { HistoryManager }      from './history'
import { Register, Registers } from './registers'
import { OffsetEdgeTransformationBehaviour }      from './utils/offsetSelection'


/** Name of the extension, used in commands and settings. */
export const extensionName = 'dance'

type CursorStyle = 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin' | 'inherit'
type LineNumbers = 'on' | 'off' | 'relative' | 'inherit'

/** Mode-specific configuration. */
class ModeConfiguration {
  private constructor(
    readonly mode: Mode,
    readonly modePrefix: string,

    public lineNumbers: vscode.TextEditorLineNumbersStyle,
    public cursorStyle: vscode.TextEditorCursorStyle,
    public decorationType?: vscode.TextEditorDecorationType,
  ) {}

  static insert() {
    return new ModeConfiguration(
      Mode.Insert,
      'insertMode',

      vscode.TextEditorLineNumbersStyle.On,
      vscode.TextEditorCursorStyle.Line,
    )
  }

  static normal() {
    return new ModeConfiguration(
      Mode.Normal,
      'normalMode',

      vscode.TextEditorLineNumbersStyle.Relative,
      vscode.TextEditorCursorStyle.Line,
    )
  }

  observeLineHighlightPreference(extension: Extension, defaultValue: string | null) {
    extension.observePreference<string | null>(this.modePrefix + '.lineHighlight', defaultValue, value => {
      extension.updateDecorations(this, value)
    }, true)
  }

  observeLineNumbersPreference(extension: Extension, defaultValue: LineNumbers) {
    extension.observePreference<LineNumbers>(this.modePrefix + '.lineNumbers', defaultValue, value => {
      this.lineNumbers = this.lineNumbersStringToLineNumbersStyle(value)
    }, true)
  }

  updateLineNumbers(extension: Extension, defaultValue: LineNumbers) {
    this.lineNumbers = this.lineNumbersStringToLineNumbersStyle(
      extension.configuration.get(this.modePrefix + '.lineNumbers') ?? defaultValue
    )
  }

  observeCursorStylePreference(extension: Extension, defaultValue: CursorStyle) {
    extension.observePreference<CursorStyle>(this.modePrefix + '.cursorStyle', defaultValue, value => {
      this.cursorStyle = this.cursorStyleStringToCursorStyle(value)
    }, true)
  }

  updateCursorStyle(extension: Extension, defaultValue: CursorStyle) {
    this.cursorStyle = this.cursorStyleStringToCursorStyle(
      extension.configuration.get(this.modePrefix + '.cursorStyle') ?? defaultValue
    )
  }

  private lineNumbersStringToLineNumbersStyle(lineNumbers: LineNumbers) {
    switch (lineNumbers) {
      case 'on':
        return vscode.TextEditorLineNumbersStyle.On
      case 'off':
        return vscode.TextEditorLineNumbersStyle.Off
      case 'relative':
        return vscode.TextEditorLineNumbersStyle.Relative
      case 'inherit':
      default:
        const vscodeLineNumbers = vscode.workspace.getConfiguration().get<LineNumbers | 'interval'>('editor.lineNumbers', 'on')

        switch (vscodeLineNumbers) {
          case 'on':
            return vscode.TextEditorLineNumbersStyle.On
          case 'off':
            return vscode.TextEditorLineNumbersStyle.Off
          case 'relative':
            return vscode.TextEditorLineNumbersStyle.Relative
          case 'interval': // This is a real option but its not in vscode.d.ts
            return 3
          default:
            return vscode.TextEditorLineNumbersStyle.On
        }
    }
  }

  private cursorStyleStringToCursorStyle(cursorStyle: CursorStyle) {
    switch (cursorStyle) {
      case 'block':
        return vscode.TextEditorCursorStyle.Block
      case 'block-outline':
        return vscode.TextEditorCursorStyle.BlockOutline
      case 'line':
        return vscode.TextEditorCursorStyle.Line
      case 'line-thin':
        return vscode.TextEditorCursorStyle.LineThin
      case 'underline':
        return vscode.TextEditorCursorStyle.Underline
      case 'underline-thin':
        return vscode.TextEditorCursorStyle.UnderlineThin

      case 'inherit':
      default:
        const vscodeCursorStyle = vscode.workspace.getConfiguration().get<CursorStyle>('editor.cursorStyle', 'line')

        switch (vscodeCursorStyle) {
          case 'block':
            return vscode.TextEditorCursorStyle.Block
          case 'block-outline':
            return vscode.TextEditorCursorStyle.BlockOutline
          case 'line':
            return vscode.TextEditorCursorStyle.Line
          case 'line-thin':
            return vscode.TextEditorCursorStyle.LineThin
          case 'underline':
            return vscode.TextEditorCursorStyle.Underline
          case 'underline-thin':
            return vscode.TextEditorCursorStyle.UnderlineThin
          default:
            return vscode.TextEditorCursorStyle.Line
        }
    }
  }
}

/**
 * Global state of the extension.
 */
export class Extension implements vscode.Disposable {
  private readonly configurationChangeHandlers = new Map<string, () => void>()
  configuration = vscode.workspace.getConfiguration(extensionName)

  enabled: boolean = false

  allowEmptySelections: boolean = true
  private normalizeTimeoutToken: NodeJS.Timeout | undefined = undefined

  typeCommand: vscode.Disposable | undefined = undefined
  changeEditorCommand: vscode.Disposable | undefined = undefined

  currentCount: number = 0
  currentRegister: Register | undefined = undefined

  ignoreSelectionChanges = false

  readonly subscriptions: vscode.Disposable[] = []

  readonly statusBarItem: vscode.StatusBarItem

  readonly modeMap = new WeakMap<vscode.TextDocument, Mode>()

  readonly registers = new Registers()
  readonly history   = new HistoryManager()

  readonly selectionDecorationType = vscode.window.createTextEditorDecorationType(
    <vscode.DecorationRenderOptions> {
      color:  { id: "editor.foreground" },
      backgroundColor:  { id: "editor.selectionBackground" }
    }
  )
  
  readonly selectionInsertDecorationType = vscode.window.createTextEditorDecorationType(
    <vscode.DecorationRenderOptions> {
      color:  { id: "editor.foreground" },
      backgroundColor:  { id: "editor.background" }
    }
  )
  readonly insertMode = ModeConfiguration.insert()
  readonly normalMode = ModeConfiguration.normal()

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(undefined, 100)
    this.statusBarItem.tooltip = 'Current mode'

    // This needs to be before setEnabled for normalizing selections on start.
    this.observePreference<boolean>('selections.allowEmpty', true, value => {
      this.allowEmptySelections = value
    }, true)

    // Configuration: line highlight.
    this.insertMode.observeLineHighlightPreference(this, null)
    this.normalMode.observeLineHighlightPreference(this, 'editor.hoverHighlightBackground')

    // Configuration: line numbering.
    this.insertMode.observeLineNumbersPreference(this, 'inherit')
    this.normalMode.observeLineNumbersPreference(this, 'relative')

    this.configurationChangeHandlers.set('editor.lineNumbers', () => {
      this.insertMode.updateLineNumbers(this, 'inherit')
      this.normalMode.updateLineNumbers(this, 'relative')
    })

    // Configuration: cursor style.
    this.insertMode.observeCursorStylePreference(this, 'inherit')
    this.normalMode.observeCursorStylePreference(this, 'inherit')

    this.configurationChangeHandlers.set('editor.cursorStyle', () => {
      this.insertMode.updateCursorStyle(this, 'inherit')
      this.normalMode.updateCursorStyle(this, 'inherit')
    })

    // Lastly, enable the extension and set up modes.
    this.setEnabled(this.configuration.get('enabled', true), false)
  }

  resetLastSelections(editor: vscode.TextEditor) {
    this.history.for(editor.document).setLastSelections(editor.document, [])
    editor.setDecorations(this.selectionDecorationType, [])
    editor.setDecorations(this.selectionInsertDecorationType, [])
  }

  prepareInsertion(editor: vscode.TextEditor, pos: 'before' | 'after' | 'start' | 'end' | 'above' | 'below') {
    if (pos == 'before' || pos == 'after' ) {
      this.history.for(editor.document).setLastSelections(editor.document, editor.selections, (pos == 'before' ? OffsetEdgeTransformationBehaviour.ExclusiveStart : OffsetEdgeTransformationBehaviour.Inclusive))
      editor.setDecorations(this.selectionDecorationType, editor.selections.map( sel => new vscode.Range( sel.start, sel.end) ))
      //! And an overlay to normalize inserted text -- reproduces kakoune behaviour
      if (pos == 'before') {
        editor.setDecorations(this.selectionInsertDecorationType, editor.selections.map( sel => new vscode.Range( sel.start, sel.start) ))
      }
    } else {
      this.resetLastSelections(editor)
    }
  }
  
  updateDecorations(mode: ModeConfiguration, color: string | null) {
    if (mode.decorationType !== undefined)
      mode.decorationType.dispose()

    if (color === null || color.length === 0)
      return mode.decorationType = undefined

    mode.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: color[0] === '#' ? color : new vscode.ThemeColor(color),
      isWholeLine: true,
    })

    if (this.getMode() === mode.mode && vscode.window.activeTextEditor !== undefined)
      this.setDecorations(vscode.window.activeTextEditor, mode.decorationType)

    return
  }

  restoreLastSelections(editor: vscode.TextEditor) {
    let documentHistory = this.history.for(editor.document)
    let lastSels = documentHistory.getLastSelections(editor.document)
    if (lastSels.length > 0 ) {
      editor.selections = lastSels
    }
  }

  setEditorMode(editor: vscode.TextEditor, mode: Mode) {
    if (this.modeMap.get(editor.document) === mode)
      return Promise.resolve()

    this.modeMap.set(editor.document, mode)

    if (mode === Mode.Normal) {
      // Force selection to be non-empty when switching to normal. This is only
      // necessary because we do not restore selections yet.
      // TODO: Remove this once https://github.com/71/dance/issues/31 is fixed.
      this.normalizeSelections(editor)
    }

    if (mode === Mode.Insert) {
      this.clearDecorations(editor, this.normalMode.decorationType)
      this.setDecorations(editor, this.insertMode.decorationType)

      editor.options.lineNumbers = this.insertMode.lineNumbers
      editor.options.cursorStyle = this.insertMode.cursorStyle
    } else {
      if (mode === Mode.Awaiting) {
        this.typeCommand?.dispose()
        this.typeCommand = undefined
      }
      
      this.clearDecorations(editor, this.selectionDecorationType)
      this.clearDecorations(editor, this.selectionInsertDecorationType)
      this.clearDecorations(editor, this.insertMode.decorationType)
      this.setDecorations(editor, this.normalMode.decorationType)

      editor.options.lineNumbers = this.normalMode.lineNumbers
      editor.options.cursorStyle = this.normalMode.cursorStyle
      
      this.restoreLastSelections(editor)
    }

    if (vscode.window.activeTextEditor === editor)
      return this.onActiveModeChanged(mode)

    return Promise.resolve()
  }

  getMode() {
    const editor = vscode.window.activeTextEditor

    return editor === undefined
      ? Mode.Disabled
      : this.modeMap.get(editor.document) || Mode.Normal
  }

  setMode(mode: Mode) {
    const editor = vscode.window.activeTextEditor

    return editor === undefined
      ? Promise.resolve()
      : this.setEditorMode(editor, mode)
  }

  private async onActiveModeChanged(mode: Mode) {
    if (mode === Mode.Insert) {
      this.statusBarItem.text = '$(pencil) INSERT'
    } else if (mode === Mode.Normal) {
      this.statusBarItem.text = '$(beaker) NORMAL'
    }

    await vscode.commands.executeCommand('setContext', extensionName + '.mode', mode)
  }

  private clearDecorations(editor: vscode.TextEditor, decorationType: vscode.TextEditorDecorationType | undefined) {
    if (decorationType !== undefined)
      editor.setDecorations(decorationType, [])
  }

  private setDecorations(editor: vscode.TextEditor, decorationType: vscode.TextEditorDecorationType | undefined) {
    if (decorationType === undefined)
      return

    const lines: number[] = [],
          selections = editor.selections

    let needsCopy = false

    for (let i = 0; i < selections.length; i++) {
      const selection = selections[i]

      for (let line = selection.start.line; line <= selection.end.line; line++) {
        if (lines.indexOf(line) === -1) {
          lines.push(line)
        } else {
          // There is some overlap, so we need a copy
          needsCopy = true
        }
      }
    }

    if (needsCopy) {
      const ranges: vscode.Range[] = []

      for (let i = 0; i < lines.length; i++) {
        const pos = new vscode.Position(lines[i], 0),
              range = new vscode.Range(pos, pos)

        ranges.push(range)
      }

      editor.setDecorations(decorationType, ranges)
    } else {
      editor.setDecorations(decorationType, selections)
    }
  }

  setEnabled(enabled: boolean, changeConfiguration: boolean) {
    if (enabled === this.enabled)
      return

    this.subscriptions.splice(0).forEach(x => x.dispose())

    if (!enabled) {
      const restoreLineNumbering = (visibleEditors: vscode.TextEditor[]) => {
        for (const editor of visibleEditors) {
          if (!this.modeMap.delete(editor.document))
            continue

          const lineNumbering = vscode.workspace.getConfiguration('editor').get('lineNumbers')

          editor.options.lineNumbers = lineNumbering === 'on'       ? vscode.TextEditorLineNumbersStyle.On
                                     : lineNumbering === 'relative' ? vscode.TextEditorLineNumbersStyle.Relative
                                     : lineNumbering === 'interval' ? vscode.TextEditorLineNumbersStyle.Relative + 1
                                     :                                vscode.TextEditorLineNumbersStyle.Off

          this.clearDecorations(editor, this.normalMode.decorationType)
          this.clearDecorations(editor, this.insertMode.decorationType)
        }
      }

      this.statusBarItem.hide()

      this.setMode(Mode.Disabled)
      this.changeEditorCommand!.dispose()

      this.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors(restoreLineNumbering)
      )

      restoreLineNumbering(vscode.window.visibleTextEditors)

      if (changeConfiguration)
        vscode.workspace.getConfiguration(extensionName).update('enabled', false)
    } else {
      this.statusBarItem.show()

      this.setMode(Mode.Normal)
      this.changeEditorCommand = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor === undefined)
          return

        let mode = this.modeMap.get(editor.document)

        if (mode === undefined)
          return this.setEditorMode(editor, mode = Mode.Normal)
        else
          return this.onActiveModeChanged(mode)
      })

      this.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(e => {
          const mode = this.modeMap.get(e.textEditor.document)

          if (mode === Mode.Insert) {
            this.setDecorations(e.textEditor, this.insertMode.decorationType)
            let reset = true
            //! If selection kind is Command it should/can be produced by insertion/append from dance
            //! If selection kind is Keyboard it should/can be produced by textchanges
            if(!!e.kind && ((e.kind == vscode.TextEditorSelectionChangeKind.Command) || (e.kind == vscode.TextEditorSelectionChangeKind.Keyboard))) {
              //! Luckily document changes are fired before selection changes,
              //! hence the 'last selections' in the document history has been already updated.
              //! If new selections intersect with last selections of document changes, 
              //! it is assumed that the last selection must not be reset.
              let documentHistory = this.history.for(e.textEditor.document)
              let lastSels = documentHistory.getLastSelections(e.textEditor.document)
              if(lastSels.length == e.selections.length) {
                reset = false
                for (let index in e.selections) {
                  let intersection = lastSels[index].intersection(e.selections[index])
                  if(lastSels[index].intersection(e.selections[index]) === undefined) {
                    reset = true
                    continue
                  }
                }
              } 
            }
            if(reset) {
              this.resetLastSelections(e.textEditor)
            }
          } else {
            this.setDecorations(e.textEditor, this.normalMode.decorationType)
          }

          if (this.normalizeTimeoutToken !== undefined) {
            clearTimeout(this.normalizeTimeoutToken)
            this.normalizeTimeoutToken = undefined
          }

          if (e.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
            this.normalizeTimeoutToken = setTimeout(() => {
              this.normalizeSelections(e.textEditor)
              this.normalizeTimeoutToken = undefined
            }, 200)
          } else {
            this.normalizeSelections(e.textEditor)
          }
        }),

        vscode.workspace.onDidChangeConfiguration(e => {
          this.configuration = vscode.workspace.getConfiguration(extensionName)

          for (const [section, handler] of this.configurationChangeHandlers.entries()) {
            if (e.affectsConfiguration(section))
              handler()
          }
        }),
      )

      for (let i = 0; i < commands.length; i++)
        this.subscriptions.push(commands[i].register(this))

      if (changeConfiguration)
        vscode.workspace.getConfiguration(extensionName).update('enabled', true)
    }

    return this.enabled = enabled
  }

  /**
   * Make all selections in the editor non-empty by selecting at least one character.
   */
  normalizeSelections(editor: vscode.TextEditor) {
    if (this.allowEmptySelections || this.ignoreSelectionChanges)
      return

    if (this.modeMap.get(editor.document) !== Mode.Normal)
      return

    // Since this is called every time when selection changes, avoid allocations
    // unless really needed and iterate manually without using helper functions.
    let normalizedSelections: vscode.Selection[] | undefined = undefined

    for (let i = 0; i < editor.selections.length; i++) {
      const selection = editor.selections[i]

      if (selection.isEmpty) {
        if (normalizedSelections === undefined) {
          // Change needed. Allocate the new array and copy what we have so far.
          normalizedSelections = editor.selections.slice(0, i)
        }

        const active = selection.active

        if (active.character >= editor.document.lineAt(active.line).range.end.character) {
          // Selection is at line end. Just keep it that way.
          normalizedSelections.push(selection)
        } else {
          const offset = editor.document.offsetAt(selection.active)
          const nextPos = editor.document.positionAt(offset + 1)

          if (nextPos.isAfter(selection.active)) {
            // Move anchor to select 1 character after, but keep the cursor position.
            normalizedSelections.push(new vscode.Selection(active.translate(0, 1), active))
          } else {
            // Selection is at the very end of the document. Select the last character instead.
            normalizedSelections.push(new vscode.Selection(active, active.translate(0, -1)))
          }
        }
      } else if (normalizedSelections !== undefined) {
        normalizedSelections.push(selection)
      }
    }

    if (normalizedSelections !== undefined)
      editor.selections = normalizedSelections
  }

  dispose() {
    this.history.dispose()
    this.statusBarItem.dispose()

    if (!this.enabled)
      return

    this.typeCommand!.dispose()
  }

  /**
   * Listen for changes to the specified preference and calls the given handler when a change occurs.
   *
   * Must be called in the constructor.
   *
   * @param triggerNow If `true`, the handler will also be triggered immediately with the current value.
   */
  observePreference<T>(section: string, defaultValue: T, handler: (value: T) => void, triggerNow = false) {
    this.configurationChangeHandlers.set('dance.' + section, () => {
      handler(this.configuration.get(section, defaultValue))
    })

    if (triggerNow) {
      handler(this.configuration.get(section, defaultValue))
    }
  }
}

export let state: Extension

export function activate(context: vscode.ExtensionContext) {
  state = new Extension()

  context.subscriptions.push(
    vscode.commands.registerCommand(extensionName + '.toggle', () => state.setEnabled(!state.enabled, false)),
  )

  if (process.env.VERBOSE_LOGGING === 'true') {
    // Log all commands we need to implement
    Promise.all([ vscode.commands.getCommands(true), import('../commands/index') ])
      .then(([registeredCommands, { commands }]) => {
        for (const command of Object.values(commands)) {
          if (registeredCommands.indexOf(command.id) === -1)
            console.warn('Command', command.id, 'is defined but not implemented.')
        }
      })
  }
}

export function deactivate() {
  state.dispose()
}
