import * as vscode from "vscode";

import type { Context } from "../api";
import { Entry } from "../state/recorder";

export interface NotifyingDisposable extends vscode.Disposable {
  readonly onDisposed: vscode.Event<this>;
}

/**
 * A wrapper around a set of `vscode.Disposable`s that can be scheduled to
 * automatically be disposed (along with its wrapped disposables) when a certain
 * event happens.
 */
export class AutoDisposable implements vscode.Disposable {
  private _boundDispose?: AutoDisposable["dispose"] = this.dispose.bind(this);
  private readonly _disposables: vscode.Disposable[];

  public constructor(disposables: vscode.Disposable[] = []) {
    this._disposables = disposables;
  }

  /**
   * Disposes of all the wrapped disposables.
   */
  public dispose() {
    if (this._boundDispose === undefined) {
      return;
    }

    this._boundDispose = undefined;

    const disposables = this._disposables;

    for (let i = 0, len = disposables.length; i < len; i++) {
      disposables[i].dispose();
    }

    disposables.length = 0;
  }

  /**
   * Whether the `AutoDisposable` has been disposed of.
   */
  public get isDisposed() {
    return this._boundDispose === undefined;
  }

  /**
   * Adds a new disposable that will be disposed of when this `AutoDisposable`
   * is itself disposed of.
   *
   * Calling this after disposing of the `AutoDisposable` will immediately
   * dispose of the given disposable.
   */
  public addDisposable(disposable: vscode.Disposable) {
    if (this._boundDispose === undefined) {
      disposable.dispose();
      return this;
    }

    this._disposables.push(disposable);

    return this;
  }

  public addNotifyingDisposable(disposable: NotifyingDisposable) {
    return this.addDisposable(disposable).disposeOnEvent(disposable.onDisposed);
  }

  /**
   * Automatically disposes of this disposable when the given event is
   * triggered.
   */
  public disposeOnEvent<T>(event: vscode.Event<T>) {
    const boundDispose = this._boundDispose;

    if (boundDispose !== undefined) {
      this._disposables.push(event(boundDispose));
    }

    return this;
  }

  /**
   * Automatically disposes of this disposable when the given promise is
   * resolved.
   */
  public disposeOnPromiseResolution<T>(thenable: Thenable<T>) {
    if (this._boundDispose === undefined) {
      return this;
    }

    const weakThis = new WeakRef(this);

    thenable.then(() => weakThis.deref()?.dispose());

    return this;
  }

  /**
   * Automatically disposes of this disposable when the cancellation of the
   * given `CancellationToken` is requested.
   */
  public disposeOnCancellation(token: vscode.CancellationToken) {
    if (this._boundDispose === undefined) {
      return this;
    }

    if (token.isCancellationRequested) {
      this.dispose();

      return this;
    }

    return this.disposeOnEvent(token.onCancellationRequested);
  }

  /**
   * Automatically disposes of this disposable when `ms` milliseconds have
   * elapsed.
   */
  public disposeAfterTimeout(ms: number) {
    const boundDispose = this._boundDispose;

    if (boundDispose === undefined) {
      return this;
    }

    const token = setTimeout(boundDispose, ms);

    this._disposables.push({
      dispose() {
        clearTimeout(token);
      },
    });

    return this;
  }

  public disposeOnUserEvent(event: AutoDisposable.Event, context: Context) {
    const editorState = context.extension.editors.getState(context.editor as any)!;
    let eventName: AutoDisposable.EventType,
        eventOpts: Record<string, unknown>;

    if (Array.isArray(event)) {
      if (event.length === 0) {
        throw new Error();
      }

      if (typeof event[0] === "string") {
        eventName = event[0] as AutoDisposable.EventType;
      } else {
        throw new Error();
      }

      if (event.length === 2) {
        eventOpts = event[1];

        if (typeof eventOpts !== "object" || eventOpts === null) {
          throw new Error();
        }
      } else if (event.length === 1) {
        eventOpts = {};
      } else {
        throw new Error();
      }
    } else if (typeof event === "string") {
      eventName = event;
      eventOpts = {};
    } else {
      throw new Error();
    }

    switch (eventName) {
    case AutoDisposable.EventType.OnEditorWasClosed:
      this.disposeOnEvent(editorState.onEditorWasClosed);
      break;

    case AutoDisposable.EventType.OnModeDidChange:
      const except = [] as string[];

      if (Array.isArray(eventOpts["except"])) {
        except.push(...eventOpts["except"]);
      } else if (typeof eventOpts["except"] === "string") {
        except.push(eventOpts["except"]);
      }

      const include = [] as string[];

      if (Array.isArray(eventOpts["include"])) {
        include.push(...eventOpts["include"]);
      } else if (typeof eventOpts["include"] === "string") {
        include.push(eventOpts["include"]);
      }

      editorState.extension.editors.onModeDidChange((e) => {
        if (e === editorState && !except.includes(e.mode.name)
            && (include.length === 0 || include.includes(e.mode.name))) {
          this.dispose();
        }
      }, undefined, this._disposables);
      break;

    case AutoDisposable.EventType.OnSelectionsDidChange:
      vscode.window.onDidChangeTextEditorSelection((e) => {
        if (editorState.editor !== e.textEditor) {
          return;
        }

        const cursor = context.extension.recorder.cursorFromEnd();

        if (cursor.previous()) {
          if (cursor.is(Entry.DeleteAfter) || cursor.is(Entry.DeleteBefore)
              || cursor.is(Entry.InsertAfter) || cursor.is(Entry.InsertBefore)
              || cursor.is(Entry.ReplaceWith)) {
            // Regular edit.
            return;
          }
        }

        this.dispose();
      }, undefined, this._disposables);
      break;

    default:
      throw new Error();
    }
  }
}

export /* enum */ namespace AutoDisposable {
  export const enum EventType {
    OnEditorWasClosed = "editor-was-closed",
    OnModeDidChange = "mode-did-change",
    OnSelectionsDidChange = "selections-did-change",
  }
}

export declare namespace AutoDisposable {
  export type Event = EventType
    | readonly [EventType.OnModeDidChange,
                { except?: string | string[]; include?: string | string[] }];
}
