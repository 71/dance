import * as vscode from "vscode";

/**
 * Controls the Dance status bar item.
 */
export class StatusBar implements vscode.Disposable {
  private readonly _segments: StatusBar.Segment[] = [];

  public readonly activeModeSegment: StatusBar.Segment;
  public readonly recordingSegment: StatusBar.Segment;
  public readonly countSegment: StatusBar.Segment;
  public readonly registerSegment: StatusBar.Segment;
  public readonly errorSegment: StatusBar.Segment;

  public constructor() {
    this.activeModeSegment = this.addSegment("Dance - Set mode", "zap", "dance.modes.set");
    this.recordingSegment =
      this.addSegment("Dance - Stop recording", "record", "dance.history.recording.stop");
    this.countSegment = this.addSegment(
      "Dance - Reset count",
      "symbol-number",
      { command: "dance.updateCount", arguments: [{ input: "0" }], title: "" },
    );
    this.registerSegment = this.addSegment(
      "Dance - Unset register",
      "clone",
      { command: "dance.selectRegister", arguments: [{ input: "" }], title: "" },
    );
    this.errorSegment = this.addSegment(
      "Dance - Copy and dismiss error",
      "error",
      "dance.dev.copyLastErrorMessage",
    );
    this.errorSegment.statusBarItem.backgroundColor =
      new vscode.ThemeColor("statusBarItem.errorBackground");
  }

  public dispose() {
    this._segments.splice(0).forEach((s) => s.dispose());
  }

  private addSegment(tooltip: string, icon: string, command: string | vscode.Command) {
    const segment = new StatusBar.Segment(tooltip, icon, 100 - this._segments.length, command);

    this._segments.push(segment);

    return segment;
  }
}

export namespace StatusBar {
  export class Segment implements vscode.Disposable {
    private readonly _statusBarItem: vscode.StatusBarItem;

    private _content?: string;

    public get content() {
      return this._content;
    }

    public get statusBarItem() {
      return this._statusBarItem;
    }

    public constructor(
      public readonly name: string,
      public readonly icon: string,
      public readonly priority: number,
      command: string | vscode.Command,
    ) {
      this._statusBarItem =
        vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, priority);
      this._statusBarItem.tooltip = name;
      this._statusBarItem.command = command;
    }

    public dispose() {
      this._statusBarItem.dispose();
    }

    public setContent(content?: string) {
      this._content = content;

      if (content) {
        this._statusBarItem.text = `$(${this.icon}) ${content}`;
        this._statusBarItem.show();
      } else {
        this._statusBarItem.hide();
      }
    }
  }
}
