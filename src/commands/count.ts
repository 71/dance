import { registerCommand, Command } from '.'

for (let i = 0; i < 10; i++) {
  const j = i

  registerCommand('dance.count.' + j as Command, (_, state) => {
    state.currentCount = state.currentCount * 10 + j
  })
}
