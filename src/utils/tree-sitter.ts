import * as vscode from "vscode";

export type { SyntaxNode, Tree } from "./tree-sitter-api";
export type TreeSitter = typeof import("./tree-sitter-api");

const extensionId = "gregoire.tree-sitter";

/**
 * An event which fires when the [Tree Sitter API](
 * https://github.com/71/vscode-tree-sitter-api) is loaded.
 */
export function onDidLoadTreeSitter(listener: (treeSitter: TreeSitter) => any): vscode.Disposable {
  const processExtensions = () => {
    const extension = vscode.extensions.getExtension<TreeSitter>(extensionId);

    if (extension === undefined) {
      return;
    }

    subscription?.dispose();
    subscription = undefined;

    extension.activate().then((treeSitter) => {
      listener(treeSitter);
    });
  };

  let subscription: vscode.Disposable | undefined = vscode.extensions.onDidChange(() => {
    processExtensions();
  });

  processExtensions();

  return {
    dispose(): void {
      subscription?.dispose();
      subscription = undefined;
    },
  };
}
