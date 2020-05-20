import { registerCommand, Command, CommandFlags } from '.'

registerCommand(Command.cancel, CommandFlags.IgnoreInHistory, () => {
  // Nop, because the caller cancels everything before calling us.
})
