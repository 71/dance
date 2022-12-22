import * as vscode from "vscode";

import { Context } from "./context";
import type { CommandDescriptor, Commands } from "../commands";
import { parseRegExpWithReplacement } from "../utils/regexp";

/**
 * Runs the given string of JavaScript code.
 */
export function run(string: string, context?: object): Thenable<unknown>;

/**
 * Runs the given strings of JavaScript code.
 */
export function run(strings: readonly string[], context?: object): Thenable<unknown[]>;

export function run(strings: string | readonly string[], context: object = {}) {
  const isSingleStringArgument = typeof strings === "string";

  if (isSingleStringArgument) {
    strings = [strings as string];
  }

  const functions: ((...args: any[]) => Thenable<unknown>)[] = [];

  for (const code of strings) {
    functions.push(compileFunction(code, Object.keys(context)));
  }

  const parameterValues = runParameterValues();

  if (isSingleStringArgument) {
    return Context.WithoutActiveEditor.wrap(
      functions[0](...parameterValues, ...Object.values(context)),
    );
  }

  const promises: Thenable<unknown>[] = [],
        contextValues = Object.values(context);

  for (const func of functions) {
    promises.push(func(...parameterValues, ...contextValues));
  }

  return Context.WithoutActiveEditor.wrap(Promise.all(promises));
}

const cachedParameterNames = [] as string[],
      cachedParameters = [] as unknown[];
let globalsObject: Record<string, any> = {};

function ensureCacheIsPopulated() {
  if (cachedParameterNames.length > 0) {
    return;
  }

  for (const name in globalsObject) {
    cachedParameterNames.push(name);
    cachedParameters.push(globalsObject[name]);
  }

  cachedParameterNames.push("vscode");
  cachedParameters.push(vscode);
}

/**
 * Sets the globals available within {@link run} expressions.
 */
export function setRunGlobals(globals: object) {
  cachedParameterNames.length = 0;
  cachedParameters.length = 0;

  globalsObject = globals;
}

/**
 * Returns the parameter names given to dynamically run functions.
 */
export function runParameterNames() {
  ensureCacheIsPopulated();

  return cachedParameterNames as readonly string[];
}

/**
 * Returns the parameter values given to dynamically run functions.
 */
export function runParameterValues() {
  ensureCacheIsPopulated();

  return cachedParameters as readonly unknown[];
}

let canRunArbitraryCode = true;

/**
 * Disables usage of the {@link compileFunction} and {@link run} functions,
 * preventing the execution of arbitrary user inputs.
 *
 * For security purposes, execution cannot be re-enabled after calling this
 * function.
 */
export function disableRunFunction() {
  canRunArbitraryCode = false;
}

/**
 * Returns whether {@link compileFunction} and {@link run} can be used.
 */
export function runIsEnabled() {
  return canRunArbitraryCode;
}

interface CompiledFunction {
  (...args: any[]): Thenable<unknown>;
}

const AsyncFunction: new (...names: string[]) => CompiledFunction =
        async function () {}.constructor as any,
      functionCache = new Map<string, CachedFunction>();

type CachedFunction = [funct: CompiledFunction, lastAccessTimestamp: number];

/**
 * A few common inputs.
 */
const safeExpressions = [
  /^(return +)?(\$\$?|[in]|\d+|count) *([=!]==?|[<>]=?|&{1,2}|\|{1,2}|[-+*/^]) *(\$\$?|[in]|\d+|count)$/,
  /^(return +)?`\${await register\(["']\w+["'], *[i0-9]\)}` !== ["']false["']$/,
];

/**
 * Compiles the given JavaScript code into a function.
 */
export function compileFunction(code: string, additionalParameterNames: readonly string[] = []) {
  if (!canRunArbitraryCode && !safeExpressions.some((re) => re.test(code))) {
    throw new Error("execution of arbitrary code is disabled");
  }

  const cacheId = additionalParameterNames.join(";") + code,
        cached = functionCache.get(cacheId);

  if (cached !== undefined) {
    cached[1] = Date.now();

    return cached[0];
  }

  let func: CompiledFunction;

  try {
    // Wrap code in block to allow shadowing of parameters.
    func = new AsyncFunction(...runParameterNames(), ...additionalParameterNames, `{\n${code}\n}`);
  } catch (e) {
    throw new Error(`cannot parse function body: ${code}: ${e}`);
  }

  functionCache.set(cacheId, [func, Date.now()]);

  return func;
}

/**
 * Removes all functions that were not used in the last n milliseconds from
 * the cache.
 */
export function clearCompiledFunctionsCache(olderThanMs: number): void;

/**
 * Removes all functions that were not used in the last 5 minutes from the
 * cache.
 */
export function clearCompiledFunctionsCache(): void;

export function clearCompiledFunctionsCache(olderThanMs = 1000 * 60 * 5) {
  if (olderThanMs === 0) {
    return functionCache.clear();
  }

  const olderThan = Date.now() - olderThanMs,
        toDelete = [] as string[];

  for (const [code, value] of functionCache) {
    if (value[1] < olderThan) {
      toDelete.push(code);
    }
  }

  for (const code of toDelete) {
    functionCache.delete(code);
  }
}

interface ArgumentAssignment {
  baseValue: Record<string, any>;
  include?: readonly string[];
  exclude?: ReadonlySet<string>;
}

type ArgumentAssignments = readonly ArgumentAssignment[];

function assignArgument(
  assignment: ArgumentAssignment,
  argument: Record<string, any>,
): Record<string, any> {
  const ownedArgument = Object.assign({}, assignment.baseValue);

  if ("include" in assignment) {
    for (const propName of assignment.include!) {
      const propValue = argument[propName];

      if (propValue !== undefined) {
        ownedArgument[propName] = propValue;
      }
    }
  } else if ("exclude" in assignment) {
    const excluded = assignment.exclude!;

    for (const propName in argument) {
      if (excluded.has(propName)) {
        continue;
      }

      ownedArgument[propName] = argument[propName];
    }
  }

  return ownedArgument;
}

function buildAssignment(argument: unknown): ArgumentAssignment {
  if (typeof argument !== "object" || argument === null) {
    return { baseValue: {} };
  }

  const { $include, $exclude, ...baseValue } = argument as Record<string, any>,
        assignment: ArgumentAssignment = { baseValue };

  if (Array.isArray($include)) {
    assignment.include = $include;
  } else if (Array.isArray($exclude)) {
    assignment.exclude = new Set<string>($exclude);
  }

  return assignment;
}

function assignArguments(
  assignment: ArgumentAssignments,
  argument: Record<string, any>,
): readonly Record<string, any>[] {
  return assignment.map((assignment) => assignArgument(assignment, argument));
}

function buildAssignments(args: unknown): ArgumentAssignments {
  if (!Array.isArray(args)) {
    if (typeof args === "object") {
      return [buildAssignment(args)];
    }

    return [];
  }

  return args.map(buildAssignment);
}

/**
 * Builds a function which can be called with an `argument` object, which will
 * execute the list of given commands.
 */
export function buildCommands(
  commands: readonly command.Any[],
  extension: { readonly commands: Commands } = Context.WithoutActiveEditor.current.extension,
) {
  const batches = [] as (
          [CommandDescriptor, ArgumentAssignment][] | [string, ArgumentAssignments])[],
        currentBatch = [] as [CommandDescriptor, ArgumentAssignment][];

  // Build and validate commands.
  for (let i = 0, len = commands.length; i < len; i++) {
    let commandName: string,
        commandArguments: unknown;

    const command = commands[i];

    if (typeof command === "string") {
      commandName = command;
      commandArguments = undefined;
    } else if (Array.isArray(command)) {
      commandName = command[0];
      commandArguments = command.slice(1);

      if (typeof commandName !== "string") {
        throw new Error("the first element of a command tuple must be a command name");
      }
    } else if (typeof command === "object" && command !== null) {
      commandName = (command as command.Command).command;
      commandArguments = (command as command.Command).args;

      if (typeof commandName !== "string") {
        throw new Error("the \"command\" property of a command object must be a command name");
      }
    } else {
      throw new Error(
        "commands must be command names, {command: string, args: any} objects or arrays",
      );
    }

    if (commandName.startsWith(".")) {
      commandName = `dance${commandName}`;
    }

    if (commandName.startsWith("dance.")) {
      const descriptor = extension.commands[commandName];

      if (descriptor === undefined) {
        throw new Error(`command ${JSON.stringify(commandName)} does not exist`);
      }

      const argument = Array.isArray(commandArguments) ? commandArguments[0] : commandArguments,
            assignment = buildAssignment(argument);

      currentBatch.push([descriptor, assignment]);
    } else {
      if (currentBatch.length > 0) {
        batches.push(currentBatch.splice(0));
      }

      batches.push([commandName, buildAssignments(commandArguments)]);
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return async (argument: Record<string, any>, context = Context.WithoutActiveEditor.current) => {
    // Execute all commands.
    const results: unknown[] = [],
          ownedArguments: any[] = [];

    for (const batch of batches) {
      if (typeof batch[0] === "string") {
        const ownedArgument = assignArguments(batch[1] as ArgumentAssignments, argument);

        results.push(await vscode.commands.executeCommand(batch[0], ...ownedArgument));
        ownedArguments.push(ownedArgument);
      } else {
        const context = Context.WithoutActiveEditor.current;
        let { currentCount, currentRegister } = context.extension;

        for (const [descriptor, assignment] of batch as [CommandDescriptor, ArgumentAssignment][]) {
          const ownedArgument = assignArgument(assignment, argument);

          if (currentCount !== context.extension.currentCount) {
            currentCount = ownedArgument["count"] = context.extension.currentCount;

            context.extension.currentCount = 0;
          }

          if (currentRegister !== context.extension.currentRegister) {
            currentRegister = ownedArgument["register"] = context.extension.currentRegister;

            context.extension.currentRegister = undefined;
          }

          if (ownedArgument["try"]) {
            delete ownedArgument["try"];

            try {
              results.push(await descriptor.handler(context, ownedArgument));
            } catch {
              results.push(undefined);
            }
          } else {
            results.push(await descriptor.handler(context, ownedArgument));
          }

          ownedArguments.push(ownedArgument);
        }
      }
    }

    if (context.shouldRecord()) {
      const recorder = context.extension.recorder;
      let i = 0;

      for (const batch of batches) {
        if (typeof batch[0] === "string") {
          const ownedArgument = ownedArguments[i++];

          recorder.recordExternalCommand(batch[0], ownedArgument);
        } else {
          for (const [descriptor] of batch as [CommandDescriptor, never][]) {
            const ownedArgument = ownedArguments[i++];

            if (ownedArgument["record"] === false) {
              continue;
            }

            recorder.recordCommand(descriptor, ownedArgument);
          }
        }
      }
    }

    return results;
  };
}

/**
 * Runs the VS Code command with the given identifier and optional arguments.
 */
export async function command(commandName: string, ...args: readonly any[]): Promise<any> {
  return (await commands([commandName, ...args]))[0];
}

/**
 * Runs the VS Code commands with the given identifiers and optional arguments.
 */
export async function commands(...commands: readonly command.Any[]): Promise<any[]> {
  return await buildCommands(commands)({});
}

export declare namespace command {
  /**
   * A tuple given to {@link command}.
   */
  export type Tuple = readonly [commandId: string, ...args: any[]];

  /**
   * An object given to {@link command}.
   */
  export interface Command {
    readonly command: string;
    readonly args?: any;
  }

  export type Any = string | Tuple | Command;
}

let canExecuteArbitraryCommands = true;
const commonSpawnOptions = { stdio: "pipe", windowsHide: true } as const;

/**
 * Executes a shell command.
 */
export function execute(
  command: string,
  input?: string,
  options: { cwd?: string; env?: Record<string, string> } = {},
  cancellationToken = Context.WithoutActiveEditor.current.cancellationToken,
) {
  const {
    cwd = function () {
      const currentFileUri = Context.currentOrUndefined?.document.uri;

      return currentFileUri?.scheme === "file"
        ? vscode.Uri.joinPath(currentFileUri, "..").fsPath
        : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }(),
    env: givenEnv = process.env,
  } = options;

  if (process.platform as string === "web") {
    return Context.WithoutActiveEditor.wrap(
      Promise.reject(new Error("execution of arbitrary commands is not supported on the web")),
    );
  }

  if (!canExecuteArbitraryCommands) {
    return Context.WithoutActiveEditor.wrap(
      Promise.reject(new Error("execution of arbitrary commands is disabled")),
    );
  }

  const promise = import("child_process").then((cp) =>
    new Promise<string>((resolve, reject) => {
      const automationProfile = getAutomationProfile(),
            shell = typeof automationProfile?.path === "string" ? automationProfile.path : "",
            args = Array.isArray(automationProfile?.args) ? automationProfile!.args : [],
            env = {
              ...(cwd == null ? {} : { PWD: cwd }),
              ...(typeof automationProfile?.env === "object" ? automationProfile.env : {}),
              ...givenEnv,
            },
            child = shell.length === 0
              ? cp.spawn(command, { ...commonSpawnOptions, shell: true, env, cwd })
              : cp.spawn(shell,
                         [...args, command],
                         { ...commonSpawnOptions, shell: false, env, cwd });

      let stdout = "",
          stderr = "";

      const disposable = cancellationToken.onCancellationRequested(() => {
        child.kill("SIGINT");
      });

      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf-8")));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf-8")));
      child.stdin.end(input, "utf-8");

      child.once("error", (err) => {
        disposable.dispose();

        reject(err);
      });
      child.once("exit", (code) => {
        disposable.dispose();

        code === 0
          ? resolve(stdout.trimRight())
          : reject(new Error(`Command exited with error ${code}: ${
              stderr.length > 0 ? stderr.trimRight() : "<No error output>"
            }`));
      });
    }),
  );

  return Context.WithoutActiveEditor.wrap(promise);
}

/**
 * Disables usage of the {@link execute} function, preventing the execution of
 * arbitrary user commands.
 *
 * For security purposes, execution cannot be re-enabled after calling this
 * function.
 */
export function disableExecuteFunction() {
  canExecuteArbitraryCommands = false;
}

interface AutomationProfile {
  readonly path?: string;
  readonly args?: readonly string[];
  readonly env?: Record<string, string>;
}

function getAutomationProfile() {
  let os: string;

  switch (process.platform) {
  case "cygwin":
  case "linux":
    os = "linux";
    break;

  case "darwin":
    os = "osx";
    break;

  case "win32":
    os = "windows";
    break;

  default:
    return undefined;
  }

  return vscode.workspace.getConfiguration("terminal.integrated.automationProfile")
    .get<AutomationProfile | null>(os);
}

/**
 * Runs the given string of JavaScript code on the given input, except in two
 * cases:
 * 1. If the string is a complete RegExp expression, instead its match will be
 *    returned.
 * 2. If the string starts with "#", instead a command will be run.
 */
export function switchRun(string: string, context: { $: string } & Record<string, any>) {
  if (string.length === 0) {
    // An empty expression is just `undefined`.
    return Context.WithoutActiveEditor.wrap(Promise.resolve());
  }

  if (string[0] === "/") {
    // RegExp replace or match.
    const [regexp, replacement] = parseRegExpWithReplacement(string);

    if (replacement === undefined) {
      return Context.WithoutActiveEditor.wrap(Promise.resolve(regexp.exec(context.$)));
    }

    return Context.WithoutActiveEditor.wrap(Promise.resolve(context.$.replace(regexp, replacement)));
  }

  if (string[0] === "#") {
    // Shell command.
    return execute(string.slice(1), context.$);
  }

  // JavaScript expression.
  return run("return " + string, context);
}

/**
 * Validates the given input string for use in {@link switchRun}. If it is
 * invalid, an exception will be thrown.
 */
export function validateForSwitchRun(string: string) {
  if (string.trim().length === 0) {
    throw new Error("the given string cannot be empty");
  }

  if (string[0] === "/") {
    parseRegExpWithReplacement(string);
    return;
  }

  if (string[0] === "#") {
    if (string.slice(1).trim().length === 0) {
      throw new Error("the given shell command cannot be empty");
    }
    return;
  }

  compileFunction("return " + string);
}
