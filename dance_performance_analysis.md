# Dance VS Code Extension - Performance Issues Analysis

## Executive Summary

The Dance extension has multiple critical performance and stability issues that cause:
- Heavy lag on keystrokes after some usage
- Cursor jumping back and forth
- Requirement to restart VS Code to fix

Root causes involve memory leaks, event listener accumulation, race conditions, and improper resource cleanup.

---

## Critical Issues Found

### 1. CRITICAL: Extension.dispose() Not Disposing Core Resources

**Location:** `/home/enrico/projects/dance/src/state/extension.ts` lines 213-222

**Problem:**
The Extension class maintains several disposable resources but does NOT dispose them:
- `this.editors` (Editors instance with multiple event subscriptions)
- `this.registers` (Registers instance)
- `this.modes` (Modes instance)
- `this.recorder` (Recorder instance)
- `this._subscriptions` array (contains command descriptors, view registrations, tree-sitter handlers)

```typescript
public dispose() {
  this._cancellationTokenSource.cancel();
  this._cancellationTokenSource.dispose();

  this._autoDisposables.forEach((disposable) => disposable.dispose());

  assert(this._autoDisposables.size === 0);

  this.statusBar.dispose();
  // Missing: this.editors.dispose(), this.recorder.dispose(), etc.
  // Missing: this._subscriptions.splice(0).forEach((d) => d.dispose());
}
```

**Impact:**
- When the extension is deactivated and reactivated, old event listeners persist
- The Editors class holds subscriptions to: `onDidChangeActiveTextEditor`, `onDidChangeTextEditorSelection`, `onDidChangeTextEditorVisibleRanges`, `onDidChangeVisibleTextEditors`, `onDidOpenTextDocument`, `onDidCloseTextDocument`
- These listeners are NOT cleaned up, causing accumulation with each restart
- Result: Multiple handlers fire for the same events, causing selection conflicts

**Lines to Compare:**
- `Editors.dispose()` at line 557: Properly disposes subscriptions
- `Recorder.dispose()` at line 75: Properly disposes subscriptions
- Extension.dispose() is MISSING these calls

---

### 2. BUG: Editors._lastRemovedEditorStates Array Never Cleared

**Location:** `/home/enrico/projects/dance/src/state/editors.ts` line 690

**Problem:**
```typescript
private _handleDidCloseTextDocument(document: vscode.TextDocument) {
  // Dispose of previous document state, if any.
  for (const state of this._lastRemovedEditorStates) {
    state.dispose();
  }

  this._lastRemovedEditorStates.length === 0;  // BUG: This is comparison, not assignment!
  // Should be: this._lastRemovedEditorStates.length = 0;
```

**Impact:**
- The array is never cleared, it keeps growing
- Disposed editor states accumulate in memory
- Each document close adds to the leak
- Can cause significant memory growth over time

---

### 3. RACE CONDITION: Selection Update Chain with Decoration Updates

**Location:** `/home/enrico/projects/dance/src/api/selections.ts` lines 42-50

**Problem:**
The `set()` function has a potential race condition:
```typescript
export function set(selections: readonly vscode.Selection[], context = Context.current) {
  NotASelectionError.throwIfNotASelectionArray(selections);

  context.selections = selections;           // Sets editor.selections (triggers onDidChangeTextEditorSelection)
  reveal(selections[0], context);            // Reveals range immediately
  vscode.commands.executeCommand("editor.action.wordHighlight.trigger");  // Extra command

  return selections;
}
```

**Issue:**
1. Setting `editor.selections` triggers `onDidChangeTextEditorSelection` event
2. This event handler (`_handleDidChangeTextEditorSelection`) calls `notifyDidChangeTextEditorSelection()`
3. Which calls `_updateDecorations()` 
4. All happening synchronously before the function returns
5. This can conflict with the `reveal()` call and word highlight command

**Impact:**
- Cursor position may be modified by decoration updates
- VS Code's native selection handling can conflict with Dance's updates
- Word highlighting command can interfere with selection state

---

### 4. MEMORY LEAK: Event Listeners in PerEditorState

**Location:** `/home/enrico/projects/dance/src/state/editors.ts` lines 174-196

**Problem:**
In `setMode()`, a mode change subscription is created but the previous one is disposed:
```typescript
private _changeSubscription!: vscode.Disposable;

public async setMode(mode: Mode) {
  if (previousMode !== undefined) {
    this._modeChangeSubscription.dispose();  // Good: disposes old subscription
    // ...
  }

  this._modeChangeSubscription = mode.onChanged(([mode, props]) => {
    for (const prop of props) {
      switch (prop) {
        // ... handles various props ...
      }
    }
  });
}
```

**However**, if mode changes happen rapidly or if the editor is disposed before the handler is attached, there could be stale handlers.

---

### 5. CONFLICT: Multiple Decoration Update Pathways

**Location:** `/home/enrico/projects/dance/src/state/editors.ts` lines 322-389

**Problem:**
Three independent update mechanisms trigger decoration updates:
1. `notifyDidChangeTextEditorSelection()` → `_updateDecorations()`
2. Mode changes trigger updates via subscriptions
3. `notifyDidChangeTextEditorVisibleRanges()` → `_updateOffscreenSelectionsIndicators()`

All three can execute in quick succession, and if a selection update happens while decorations are being updated, cursor position can jump due to timing issues.

---

### 6. ASYNC TIMING ISSUE: setTimeout in toMode()

**Location:** `/home/enrico/projects/dance/src/api/modes.ts` lines 41-62

**Problem:**
```typescript
await context.switchToMode(mode);

// We must start listening for events after a short delay...
setTimeout(() => {
  disposable
    .addDisposable(extension.recorder.onDidAddEntry((entry) => {
      // ... handles events ...
    }));
}, 0);
```

**Issue:**
- The event listener is added AFTER the mode switch completes
- With `setTimeout(..., 0)`, there's a race condition window
- User inputs during this window might not be properly recorded
- If extension is reloaded during this period, the disposable setup fails

**Impact:**
- Undocumented delay in event handler registration
- Potential for events to be missed during mode transitions
- Not properly cleaned up on extension deactivation

---

### 7. RACE CONDITION: Disposition During Setup

**Location:** `/home/enrico/projects/dance/src/state/editors.ts` lines 545-554

**Problem:**
```typescript
constructor(...) {
  // ... setup event handlers ...
  
  queueMicrotask(() => {
    this._handleDidChangeVisibleTextEditors(vscode.window.visibleTextEditors);

    const activeTextEditor = vscode.window.activeTextEditor;

    if (activeTextEditor !== undefined) {
      this._activeEditor = this._editors.get(activeTextEditor);
      this._activeEditor?.notifyDidBecomeActive();
    }
  });
}
```

**Issue:**
- The queueMicrotask happens AFTER constructor completion
- Event handlers are already registered and could fire before this setup
- If extension is deactivated before the microtask executes, `this._editors` might be invalid
- The `notifyDidBecomeActive()` call depends on proper state initialization

---

### 8. INSUFFICIENT CLEANUP IN showDismissibleErrorMessage()

**Location:** `/home/enrico/projects/dance/src/state/extension.ts` lines 362-389

**Problem:**
```typescript
public showDismissibleErrorMessage(message: string) {
  // ...
  
  const dispose = () => {
    this.statusBar.errorSegment.setContent();
    this._dismissErrorMessage = undefined;
    subscriptions.splice(0).forEach((d) => d.dispose());
  };

  const subscriptions = [
    vscode.window.onDidChangeActiveTextEditor(dispose),
    vscode.window.onDidChangeTextEditorSelection(dispose),
  ];

  this._dismissErrorMessage = dispose;
}
```

**Issue:**
- These subscriptions are tied to the error message, not the extension lifecycle
- If extension is deactivated while error is showing, subscriptions persist
- Creates stray event handlers that won't be cleaned up

---

## Symptom-to-Root-Cause Mapping

### "Heavy lag on keystrokes after some usage"
- **Primary cause:** Event listener accumulation (Issue #1)
  - Each keystroke triggers multiple event handlers (onDidChangeTextEditorSelection)
  - With multiple listeners registered, processing compounds
  - After restart: VS Code cleans up, extension reloads cleanly

- **Secondary cause:** Memory growth from unreleased resources (Issue #2)
  - Causes garbage collection pressure
  - Slower event processing as heap grows

### "Cursor jumps back and forth"
- **Primary cause:** Race condition in selection updates (Issue #3, #5)
  - Selection set → triggers event → updates decorations → event fires again
  - Multiple update pathways cause conflicting cursor positions

- **Secondary cause:** Conflict with VS Code's word highlighting (Issue #3)
  - The explicit `editor.action.wordHighlight.trigger` command
  - Can interfere with selection state in tight timing windows

- **Tertiary cause:** Async timing issues in mode switches (Issue #6)
  - Mode change with `setTimeout(0)` can cause selection to be in wrong state
  - Rapid mode changes create race conditions

### "Requires restarting VS Code to fix"
- Extension unload/reload clears all JS event listeners
- New instance starts fresh without accumulated handlers
- Indicates the issue is about resource accumulation, not logic bugs

---

## Detailed Code References

### The Missing Disposals Chain
The extension maintains these disposable resources:
1. `this.statusBar` → ✓ disposed
2. `this.editors` → ✗ NOT disposed
3. `this.recorder` → ✗ NOT disposed  
4. `this.modes` → ✗ NOT disposed
5. `this.registers` → ✗ NOT disposed
6. `this._subscriptions[]` → ✗ NOT disposed

Each of these holds event subscriptions that should be cleaned up.

### Editors Subscriptions Not Disposed
In `/home/enrico/projects/dance/src/state/editors.ts` constructor:
```typescript
vscode.window.onDidChangeActiveTextEditor(
  this._handleDidChangeActiveTextEditor, this, this._subscriptions);
vscode.window.onDidChangeTextEditorSelection(
  this._handleDidChangeTextEditorSelection, this, this._subscriptions);
vscode.window.onDidChangeTextEditorVisibleRanges(
  this._handleDidChangeTextEditorVisibleRanges, this, this._subscriptions);
vscode.window.onDidChangeVisibleTextEditors(
  this._handleDidChangeVisibleTextEditors, this, this._subscriptions);
vscode.workspace.onDidOpenTextDocument(
  this._handleDidOpenTextDocument, this, this._subscriptions);
vscode.workspace.onDidCloseTextDocument(
  this._handleDidCloseTextDocument, this, this._subscriptions);
```

These are properly added to `this._subscriptions` and disposed in `Editors.dispose()`.

However, `Extension.dispose()` never calls `this.editors.dispose()`.

---

## Specific Line Numbers for Fixes Needed

1. **File:** `/home/enrico/projects/dance/src/state/extension.ts`
   - **Line 213-222:** Add disposal of core resources in `dispose()` method
   - Should add: `this.editors.dispose()`, `this.recorder.dispose()`, `this._subscriptions.splice(0).forEach(d => d.dispose())`

2. **File:** `/home/enrico/projects/dance/src/state/editors.ts`
   - **Line 690:** Fix the comparison bug `this._lastRemovedEditorStates.length === 0` → `this._lastRemovedEditorStates.length = 0`

3. **File:** `/home/enrico/projects/dance/src/api/selections.ts`
   - **Lines 42-50:** Review the `set()` function for race conditions
   - Consider making decoration updates happen asynchronously or debouncing

4. **File:** `/home/enrico/projects/dance/src/api/modes.ts`
   - **Lines 41-62:** Review setTimeout(0) pattern and disposal on deactivation

5. **File:** `/home/enrico/projects/dance/src/state/extension.ts`
   - **Lines 362-389:** Consider disposing error message subscriptions when extension deactivates

---

## Additional Issues Identified

### Character Mode Conversion
**File:** `/home/enrico/projects/dance/src/api/context.ts` lines 666-828

The `selectionsToCharacterMode()` and `selectionsFromCharacterMode()` functions have complex logic that can introduce subtle bugs when selections are rapidly updated. The document access pattern:
```typescript
if (document === undefined) {
  document = Context.current.document;
}
```

This could access a stale document if the context changes during the conversion.

### Decoration Type Creation Without Cleanup
**File:** `/home/enrico/projects/dance/src/state/modes.ts` lines 244-248

```typescript
this._decorations = decorations.flatMap((d) => {
  // ...
  type: vscode.window.createTextEditorDecorationType(renderOptions),
});
```

While these ARE disposed when modes are disposed, if Mode disposal is never called, these decoration types leak.

---

## Summary of Issues by Severity

### Critical (Causes Symptoms)
1. **Extension.dispose() missing resource cleanup** - Direct cause of event handler accumulation
2. **Editors array clear bug** - Memory leak
3. **Race condition in set()** - Direct cause of cursor jumping
4. **Missing Editors.dispose() call** - Prevents cleanup

### High (Contributes to Issues)
5. Mode change decoration updates
6. setTimeout race conditions
7. Error message subscription cleanup

### Medium (Potential Issues)
8. CharacterMode conversion edge cases
9. Decoration type lifecycle management

---

## Testing Recommendations

1. **Check event listener count** during regular usage
2. **Monitor memory growth** after extended usage
3. **Test rapid selection changes** to identify race conditions
4. **Test mode switching** with rapid input
5. **Test extension reload** and verify cleanup

---

## Recommended Fix Priority

1. Fix Extension.dispose() to call all resource disposals (CRITICAL)
2. Fix the array.length === 0 bug (CRITICAL)
3. Add async handling to selection updates (HIGH)
4. Review and fix setTimeout timing issues (HIGH)
5. Add proper error message subscription cleanup (MEDIUM)
6. Refactor character mode conversion to use stable context (MEDIUM)

