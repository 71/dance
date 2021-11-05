import { Context } from "./context";

export * from "../utils/errors";

/**
 * Throws an exception indicating that the caller is not implemented yet.
 */
export function todo(): never {
  const context = Context.WithoutActiveEditor.currentOrUndefined;

  if (context?.commandDescriptor !== undefined) {
    throw new Error(`command not implemented: ${context.commandDescriptor.identifier}`);
  }

  throw new Error("function not implemented");
}
