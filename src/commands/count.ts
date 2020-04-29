import { registerCommand, Command, CommandFlags } from '.'

for (let i = 0; i < 10; i++) {
  const j = i

  registerCommand('dance.count.' + j as Command, CommandFlags.IgnoreInHistory, (_, { extension }) => {
    extension.currentCount = extension.currentCount * 10 + j
  })
}
