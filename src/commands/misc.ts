import { Command, CommandFlags, registerCommand } from ".";

registerCommand(Command.cancel, CommandFlags.IgnoreInHistory, () => {
  // Nop, because the caller cancels everything before calling us.
});
