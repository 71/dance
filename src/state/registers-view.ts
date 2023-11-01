import * as vscode from "vscode";
import { Register, Registers, RegisterSet } from "./registers";

/**
 * A {@link vscode.TreeDataProvider} for Dance registers.
 */
export class RegistersView implements vscode.TreeDataProvider<TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();

  private readonly _registerToItemMap = new Map<Register, RegisterTreeItem>();
  private readonly _documentToItemMap = new Map<vscode.TextDocument, RegisterSetTreeItem>();
  private _globalDocumentItem?: RegisterSetTreeItem;

  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  public get isActive() {
    return this._globalDocumentItem !== undefined;
  }

  public constructor(
    public readonly registers: Registers,
  ) {}

  public getTreeItem(element: TreeItem) {
    return element;
  }

  public async getChildren(element?: TreeItem): Promise<vscode.TreeItem[]> {
    if (element === undefined) {
      if (this._globalDocumentItem === undefined) {
        this._globalDocumentItem = new RegisterSetTreeItem(
          this.registers,
          () => this._onDidChangeTreeData.fire(this._globalDocumentItem),
        );
      }

      const document = vscode.window.activeTextEditor?.document;

      return document === undefined
        ? [this._globalDocumentItem]
        : [this._globalDocumentItem, this._itemForDocument(document)];
    }

    if (element instanceof ValueTreeItem) {
      return [];
    }

    if (element instanceof RegisterTreeItem) {
      return await element.values();
    }

    let registers = [...element.registers.registers]
      .filter((r) => r.iconName !== undefined && r.canRead());

    if (element !== this._globalDocumentItem) {
      registers = registers.filter((r) => /^[a-zA-Z]|.{2,}$/.test(r.name));
    }

    const items = registers
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => this._itemForRegister(r as Register & Register.Readable, element));
    const shouldShowItem = await Promise.all(items.map(async (item) => await item.shouldShow()));

    return items.filter((_, i) => shouldShowItem[i]);
  }

  private _itemForDocument(document: vscode.TextDocument) {
    const existing = this._documentToItemMap.get(document);

    if (existing !== undefined) {
      return existing;
    }

    const item: RegisterSetTreeItem = new RegisterSetTreeItem(
      this.registers.forDocument(document),
      () => this._onDidChangeTreeData.fire(item),
      document,
    );

    this._documentToItemMap.set(document, item);

    return item;
  }

  private _itemForRegister(register: Register & Register.Readable, documentItem: RegisterSetTreeItem) {
    const existing = this._registerToItemMap.get(register);

    if (existing !== undefined) {
      return existing;
    }

    const item: RegisterTreeItem = new RegisterTreeItem(
      register,
      async (wasShown) => {
        this._onDidChangeTreeData.fire(item);

        if (await item.shouldShow() !== wasShown) {
          this._onDidChangeTreeData.fire(documentItem);
        }
      },
    );

    this._registerToItemMap.set(register, item);

    return item;
  }

  public register(): vscode.Disposable {
    const treeDataProviderDisposable = vscode.window.createTreeView("registers", {
            treeDataProvider: this,
            showCollapseAll: true,
          }),
          editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(() =>
            this.isActive && this._onDidChangeTreeData.fire(undefined),
          ),
          documentChangeDisposable = vscode.workspace.onDidCloseTextDocument((e) => {
            if (!this.isActive) {
              return;
            }

            this._documentToItemMap.get(e)?.dispose();
            this._documentToItemMap.delete(e);

            for (const register of this.registers.forDocument(e).registers) {
              this._registerToItemMap.get(register)?.dispose();
              this._registerToItemMap.delete(register);
            }
          });

    return {
      dispose: () => {
        for (const item of this._documentToItemMap.values()) {
          item.dispose();
        }

        for (const item of this._registerToItemMap.values()) {
          item.dispose();
        }

        this._globalDocumentItem?.dispose();
        this._documentToItemMap.clear();
        this._registerToItemMap.clear();

        treeDataProviderDisposable.dispose();
        editorChangeDisposable.dispose();
        documentChangeDisposable.dispose();
      },
    };
  }
}

class RegisterSetTreeItem extends vscode.TreeItem implements vscode.Disposable {
  private readonly _disposable: vscode.Disposable;

  public constructor(
    public readonly registers: RegisterSet,
    notifyChange: () => void,
    document?: vscode.TextDocument,
  ) {
    super(
      document?.fileName ?? "Global",
      vscode.TreeItemCollapsibleState.Expanded,
    );

    this.iconPath = new vscode.ThemeIcon(document === undefined ? "root-folder" : "folder-active");

    this._disposable = registers.onRegisterChange(() => notifyChange());
  }

  public dispose() {
    this._disposable.dispose();
  }
}

class RegisterTreeItem extends vscode.TreeItem implements vscode.Disposable {
  private readonly _disposable: vscode.Disposable;

  private _shouldShow?: Thenable<boolean>;
  private _values?: Thenable<ValueTreeItem[]>;

  public constructor(
    public readonly register: Register & Register.Readable,
    notifyChange: (wasVisible: boolean) => void,
  ) {
    super(
      register.name,
      /^(["/@^|.]|[a-zA-Z0-9]+)$/.test(register.name)
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed,
    );

    if (register.iconName !== undefined) {
      this.iconPath = new vscode.ThemeIcon(register.iconName);
    }

    this._disposable = register.onChange(async () => {
      const wasVisible = await this.shouldShow();

      this._shouldShow = undefined;
      this._values = undefined;

      notifyChange(wasVisible);
    });
  }

  private _shouldShowEmpty() {
    return /^["/@^|.]$/.test(this.register.name);
  }

  public async shouldShow() {
    if (this._shouldShowEmpty()) {
      return true;
    }

    if (this._shouldShow === undefined) {
      this._shouldShow = this.values().then((values) => values.length > 0);
    }

    return await this._shouldShow;
  }

  public async values() {
    if (this._values === undefined) {
      this._values = (async () => {
        try {
          const values = await this.register.get();

          return values?.map((v) => new ValueTreeItem(v)) ?? [];
        } catch (e) {
          return [new ValueTreeItem(`${e}`, "warning")];
        }
      })();
    }

    return await this._values;
  }

  public dispose() {
    this._disposable.dispose();
  }
}

class ValueTreeItem extends vscode.TreeItem {
  public constructor(label: string, icon: string = "symbol-string") {
    super(label, vscode.TreeItemCollapsibleState.None);

    this.iconPath = new vscode.ThemeIcon(icon);
  }
}

type TreeItem = RegisterSetTreeItem | RegisterTreeItem | ValueTreeItem;
