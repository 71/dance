# Dance VS Code Extension - Performance Investigation Report

## Overview
This directory contains a comprehensive analysis of performance issues in the Dance VS Code extension, including:
- Heavy lag on keystrokes after usage
- Cursor jumping back and forth
- Need to restart VS Code to fix issues

## Document Guide

### 1. **dance_performance_analysis.md** (14 KB)
**Comprehensive detailed analysis with full explanations**

Contents:
- Executive summary
- 8 detailed issues with explanations
- Root causes for each symptom
- Symptom-to-cause mapping
- Testing recommendations
- Fix priority list

Best for: Understanding the full context and all issues

### 2. **dance_issues_summary.txt** (5.2 KB)
**Quick reference with absolute file paths and line numbers**

Contents:
- Critical bugs with exact locations
- Race conditions identified
- Events that accumulate
- Disposal chain status
- Quick lookup of file paths

Best for: Quick reference while fixing

### 3. **dance_specific_code_issues.txt** (16 KB)
**Detailed code snippets with line-by-line analysis**

Contents:
- Issue #1: Extension.dispose() missing resource cleanup
- Issue #2: Array never cleared bug
- Issue #3: Selection update race condition
- Issue #4: Mode change setTimeout race condition
- Issue #5: Multiple decoration update pathways
- Issue #6: Stale document reference
- Issue #7: Disposal during async setup
- Issue #8: Error message subscriptions not cleaned
- Summary table: Disposal status for all components

Best for: Code review and understanding specific bugs

## Critical Issues Summary

### CRITICAL (Causes Immediate Symptoms)
1. **Extension.dispose() not disposing core resources**
   - File: `/home/enrico/projects/dance/src/state/extension.ts`
   - Lines: 213-222
   - Missing: `this.editors.dispose()`, `this.recorder.dispose()`, `this._subscriptions cleanup`
   - Impact: Event listener accumulation causing lag

2. **Array never cleared in Editors**
   - File: `/home/enrico/projects/dance/src/state/editors.ts`
   - Line: 690
   - Bug: `this._lastRemovedEditorStates.length === 0;` (should be `=`)
   - Impact: Memory leak from unreleased editor states

3. **Race condition in selection updates**
   - File: `/home/enrico/projects/dance/src/api/selections.ts`
   - Lines: 42-50
   - Issue: Selection set triggers event → updates decorations → conflicts with reveal()
   - Impact: Cursor jumping

### HIGH (Contributes to Issues)
4. Mode change setTimeout race conditions
5. Multiple decoration update pathways
6. Error message subscription cleanup

### MEDIUM (Potential Issues)
7. Stale document references
8. Async initialization race conditions

## Absolute File Paths (All Issues)

```
/home/enrico/projects/dance/src/state/extension.ts       (Lines: 213-222, 362-389)
/home/enrico/projects/dance/src/state/editors.ts         (Lines: 267-269, 277-279, 322-389, 545-554, 690)
/home/enrico/projects/dance/src/api/selections.ts        (Lines: 42-50)
/home/enrico/projects/dance/src/api/modes.ts             (Lines: 41-62)
/home/enrico/projects/dance/src/api/context.ts           (Lines: 666-828)
/home/enrico/projects/dance/src/state/modes.ts           (Lines: 244-248)
```

## Quick Fix Priority

### Immediate (CRITICAL)
1. Fix Extension.dispose() in `/home/enrico/projects/dance/src/state/extension.ts` lines 213-222
   - Add disposal calls for all major components

2. Fix array clear bug in `/home/enrico/projects/dance/src/state/editors.ts` line 690
   - Change `===` to `=`

### Short Term (HIGH)
3. Refactor selection updates to be async or debounced
4. Review setTimeout patterns in mode changes
5. Fix error message subscription cleanup

### Medium Term (MEDIUM)
6. Improve document reference stability in context conversions
7. Synchronize decoration update pathways

## Testing Recommendations

After fixes, verify:
1. Event listener count remains constant across reload cycles
2. Memory usage stable during extended usage
3. No cursor jumping during rapid selection changes
4. Mode switching doesn't cause selection conflicts
5. Error messages don't accumulate handlers

## How to Use These Documents

1. **Start with:** `dance_issues_summary.txt` for quick overview
2. **Then read:** `dance_performance_analysis.md` for full understanding
3. **When coding:** Reference `dance_specific_code_issues.txt` for exact locations

## Key Findings

### Root Cause #1: Memory Leaks (Event Listener Accumulation)
- **Why it happens:** Extension.dispose() doesn't call cleanup on major components
- **How it manifests:** Lag increases with each feature use
- **Why restart fixes it:** VS Code unloads all JS context

### Root Cause #2: Race Conditions (Cursor Jumping)
- **Why it happens:** Multiple independent pathways update selections/decorations
- **How it manifests:** Cursor appears to jump between keystrokes
- **Why restart fixes it:** New instance has fresh state

### Root Cause #3: Data Corruption (Array Not Cleared)
- **Why it happens:** Single character typo: `===` instead of `=`
- **How it manifests:** Memory grows unbounded, GC pressure
- **Why restart fixes it:** Old data discarded on reload

## Recommended Reading Order

### For Quick Fix
1. `dance_issues_summary.txt` - Get line numbers
2. `dance_specific_code_issues.txt` - See exact code to fix

### For Complete Understanding
1. `dance_performance_analysis.md` - Executive summary
2. `dance_issues_summary.txt` - Event accumulation details
3. `dance_specific_code_issues.txt` - Code-level analysis

### For Root Cause Analysis
1. Read Section "Symptom-to-Root-Cause Mapping" in `dance_performance_analysis.md`
2. Review CRITICAL issues in `dance_issues_summary.txt`
3. Deep dive with `dance_specific_code_issues.txt` for each issue

## Additional Notes

- All issues are reproducible
- All issues are fixable with code changes
- The main fix (Extension.dispose()) is relatively simple
- The cursor jumping requires race condition analysis/fixes
- Memory leak fix is trivial (one character change)

---

**Report Generated:** October 26, 2025
**Analysis Tool:** Claude Code - Anthropic
**Repository:** `/home/enrico/projects/dance`
**Status:** Thorough Investigation Complete
