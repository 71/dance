import * as vscode from "vscode";
import * as TreeSitter from "web-tree-sitter";
import { Query, SyntaxNode, Tree } from "web-tree-sitter";
export { Query, type SyntaxNode, type Tree, TreeSitter };

/**
 * A supported language.
 */
export declare enum Language {
    C = "c",
    Cpp = "cpp",
    Go = "go",
    Html = "html",
    JavaScript = "javascript",
    JavaScriptReact = "javascript",
    Python = "python",
    Rust = "rust",
    TypeScript = "typescript",
    TypeScriptReact = "tsx"
}
/**
 * Ensures that Tree Sitter is loaded.
 */
export declare function ensureLoaded(): Promise<void>;
/**
 * Ensures that the specified language is loaded.
 */
export declare function ensureLoaded(input: HasLanguage): Promise<void>;
/**
 * Type from which a {@link Language} can be determined.
 */
export type HasLanguage = Language | string | vscode.Uri | vscode.TextDocument;
/**
 * Returns the {@link Language} of the file at the given value if it can be
 * reliably determined. Otherwise, returns `undefined`.
 */
export declare function determineLanguage(input: HasLanguage): Language | undefined;
/**
 * Same as {@link determineLanguage()}, but throws an error on failure instead
 * of returning `undefined`.
 */
export declare function determineLanguageOrFail(input: HasLanguage): Language;
/**
 * A cache for trees returned by {@link documentTree()} and
 * {@link documentTreeSync()}.
 */
export declare class Cache {
    constructor();
}
/**
 * Options given to {@link documentTree()} and {@link documentTreeSync()}.
 */
export interface DocumentTreeOptions {
    /**
     * The language to use; if unspecified, it will be determined using
     * {@link determineLanguage()}.
     */
    readonly language?: Language;
    /**
     * The cache used to resolve the tree, or `undefined` if no cache should be
     * used.
     */
    readonly cache?: Cache;
    /**
     * The timeout in milliseconds of the operation.
     */
    readonly timeoutMs?: number;
}
/**
 * Returns the document tree for the specified document,
 * {@link ensureLoaded loading} the necessary code first if necessary.
 */
export declare function documentTree(document: vscode.TextDocument, options?: DocumentTreeOptions): Promise<Tree>;
/**
 * Returns the document tree for the specified document, failing if the
 * relevant language is not already {@link ensureLoaded loaded}.
 */
export declare function documentTreeSync(document: vscode.TextDocument, options?: DocumentTreeOptions): Tree;
/**
 * Compiles the given string into a {@link Query} object which can be used to
 * perform queries on nodes of the given language.
 *
 * @see {@link https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax}
 */
export declare function query(language: HasLanguage): (strings: TemplateStringsArray, ...args: any) => Promise<Query>;
export declare function query(language: HasLanguage, source: string): Promise<Query>;
/**
 * Compiles the given string into a {@link Query} object which can be used to
 * perform queries on nodes of the given language, failing if it is not already
 * {@link ensureLoaded loaded}.
 */
export declare function querySync(language: HasLanguage): (strings: TemplateStringsArray, ...args: any) => Query;
export declare function querySync(language: HasLanguage, source: string): Query;
/**
 * Executes the specified function with the result of {@link documentTree()},
 * {@link Tree.delete() deleting} the tree after the end of the function.
 */
export declare const withDocumentTree: {
    <T>(document: vscode.TextDocument, k: (tree: Tree) => T | PromiseLike<T>): Promise<T>;
    <T_1>(document: vscode.TextDocument, options: DocumentTreeOptions | undefined, k: (tree: Tree) => T_1 | PromiseLike<T_1>): Promise<T_1>;
};
/**
 * Executes the specified function with the result of {@link documentTreeSync()},
 * {@link Tree.delete() deleting} the tree after the end of the function.
 */
export declare const withDocumentTreeSync: {
    <T>(document: vscode.TextDocument, k: (tree: Tree) => T): T;
    <T_1>(document: vscode.TextDocument, options: DocumentTreeOptions | undefined, k: (tree: Tree) => T_1): T_1;
};
/**
 * Executes the specified function with the result of {@link query()},
 * {@link Query.delete() deleting} the query after the end of the function.
 */
export declare const withQuery: <T>(language: HasLanguage, source: string, k: (query: Query) => T | PromiseLike<T>) => Promise<T>;
/**
 * Executes the specified function with the result of {@link querySync()},
 * {@link Query.delete() deleting} the query after the end of the function.
 */
export declare const withQuerySync: <T>(language: HasLanguage, source: string, k: (query: Query) => T) => T;
/**
 * Executes the specified function with the given arguments, calling
 * `arg.delete()` for each `arg` in `args` after the end of its execution.
 *
 * The function may return a `Promise`, in which case a promise will be
 * returned as well.
 */
export declare function using<T, Args extends {
    delete(): void;
}[]>(...args: [...Args, (...args: Args) => T]): T;
/**
 * Returns the built-in {@link Query} for textobjects of the given language, or
 * `undefined` if there is no such built-in query.
 *
 * This function automatically memoizes its results; callers should neither
 * cache nor {@link Query.delete delete} the returned query.
 *
 * @see https://docs.helix-editor.com/guides/textobject.html
 */
export declare function textObjectQueryFor(input: HasLanguage): Promise<Omit<Query, "delete"> | undefined>;
/**
 * A Tree Sitter point with UTF-16-based offsets.
 *
 * @see {@link TreeSitter.Point}
 */
export type Point = TreeSitter.Point;
/**
 * Converts a Tree Sitter {@link Point} to a {@link vscode.Position}.
 */
export declare function toPosition(point: Point): vscode.Position;
/**
 * Converts a {@link vscode.Position} into a Tree Sitter {@link Point}.
 */
export declare function fromPosition(position: vscode.Position): Point;
/**
 * Returns the {@link vscode.Position} of a Tree Sitter syntax node.
 */
export declare function toRange(node: SyntaxNode): vscode.Range;
/**
 * Returns the start and end Tree Sitter {@link Point} positions of a
 * {@link vscode.Range}.
 */
export declare function fromRange(range: vscode.Range): {
    startPosition: Point;
    endPosition: Point;
};
