import * as vscode from "vscode";

import { Context } from "./context";
import { track } from "./selections";
import type { Register } from "../state/registers";

/**
 * Returns the register with the given name.
 */
export function get(registerOrName: string | Register) {
  if (typeof registerOrName === "object") {
    return registerOrName;
  }

  return Context.current.extension.registers.get(registerOrName);
}

/**
 * Returns the string values stored in the specified register, or `undefined` if
 * no values are available.
 */
export function values(registerOrName: string | Register.WithFlags<Register.Flags.CanRead>) {
  const register: Register = get(registerOrName);

  try {
    register.ensureCanRead();
  } catch (e) {
    return Promise.reject(e);
  }

  return register.get();
}

/**
 * Returns the string value stored at the given index of the specified register,
 * or `undefined` if such a value is unavailable.
 */
export function value(
  registerOrName: string | Register.WithFlags<Register.Flags.CanRead>,
  index: number,
) {
  return values(registerOrName).then((values) => values?.[index]);
}

/**
 * Stores and returns the string values in the specified register.
 */
export function storeValues(
  registerOrName: string | Register.WithFlags<Register.Flags.CanWrite>,
  text?: readonly string[],
) {
  const register: Register = get(registerOrName);

  register.ensureCanWrite();
  register.set(text);

  return text;
}

/**
 * Updates and returns the string values in the specified register according to
 * the given function.
 */
export async function updateValues(
  registerOrName: string | Register.WithFlags<Register.Flags.CanRead | Register.Flags.CanWrite>,
  update: (values: readonly string[] | undefined) => Thenable<readonly string[] | undefined>,
) {
  const register: Register = get(registerOrName);

  register.ensureCanRead();
  register.ensureCanWrite();

  const newValues = await update(await register.get());

  await register.set(newValues);

  return newValues;
}

/**
 * Clears the string values stored in the specified register.
 */
export function clearValues(registerOrName: string | Register.WithFlags<Register.Flags.CanWrite>) {
  const register: Register = get(registerOrName);

  register.ensureCanWrite();

  return register.set(undefined);
}

/**
 * Returns the selections stored in the specified register, or `undefined` if no
 * selections are available.
 */
export function selections(
  registerOrName: string | Register.WithFlags<Register.Flags.CanReadSelections>,
) {
  const register: Register = get(registerOrName);

  try {
    register.ensureCanReadSelections();
  } catch (e) {
    return Promise.reject(e);
  }

  return Promise.resolve(register.getSelections());
}

/**
 * Returns the selection stored at the given index of the specified register, or
 * `undefined` if such a selection is unavailable.
 */
export function selection(
  registerOrName: string | Register.WithFlags<Register.Flags.CanReadSelections>,
  index: number,
) {
  return selections(registerOrName).then((selections) => selections?.[index]);
}

/**
 * Stores and returns the selections in the specified register.
 */
export function storeSelections(
  registerOrName: string | Register.WithFlags<Register.Flags.CanWriteSelections>,
  selections?: readonly vscode.Selection[],
) {
  const register: Register = get(registerOrName);

  register.ensureCanWriteSelections();
  register.replaceSelectionSet(track(selections))?.dispose();

  return selections;
}

/**
 * Updates and returns the selections in the specified register according to the
 * given function.
 */
export async function updateSelections(
  registerOrName: string | Register.WithFlags<
      Register.Flags.CanReadSelections | Register.Flags.CanWriteSelections>,
  update: (values: readonly vscode.Selection[] | undefined) =>
      Thenable<readonly vscode.Selection[] | undefined>,
) {
  const register: Register = get(registerOrName);

  register.ensureCanReadSelections();
  register.ensureCanWriteSelections();

  const newSelections = await update(register.getSelections());

  if (newSelections === undefined) {
    register.replaceSelectionSet()?.dispose();
  } else {
    register.replaceSelectionSet(track(newSelections))?.dispose();
  }

  return newSelections;
}

/**
 * Clears the selections stored in the specified register.
 */
export function clearSelections(
  registerOrName: string | Register.WithFlags<Register.Flags.CanWriteSelections>,
) {
  const register: Register = get(registerOrName);

  register.ensureCanWriteSelections();
  register.replaceSelectionSet()?.dispose();

  return Promise.resolve();
}
