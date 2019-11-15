import { registerCommand, Command, CommandFlags } from '.'

for (let i = 0; i < 10; i++) {
  const j = i

  registerCommand('dance.count.' + j as Command, CommandFlags.IgnoreInHistory, (_, __, ___, ctx) => {
    ctx.currentCount = ctx.currentCount * 10 + j
  })
}
