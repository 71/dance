import * as vscode from "vscode";
import { EditorState } from "../state/editor";
import { Extension } from "../state/extension";

declare class WeakRef<T extends object> {
  public constructor(value: T);

  public deref(): T | undefined;
}

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

  public disposeOnUserEvent(event: AutoDisposable.Event, editorState: EditorState) {
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
    case "mode-did-change":
      const except = [] as string[];

      if (Array.isArray(eventOpts.except)) {
        except.push(...eventOpts.except);
      } else if (typeof eventOpts.except === "string") {
        except.push(eventOpts.except);
      }

      editorState.extension.onModeDidChange((e) => {
        if (e === editorState && !except.includes(e.mode.name)) {
          this.dispose();
        }
      }, undefined, this._disposables);
      break;

    default:
      throw new Error();
    }
  }
}

export namespace AutoDisposable {
  export const enum EventType {
    OnModeDidChange = "mode-did-change",
  }

  export type Event = EventType
    | readonly [EventType.OnModeDidChange, { except?: string | string[] }];
}
