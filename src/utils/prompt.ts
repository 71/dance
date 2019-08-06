import * as vscode from 'vscode'


export function prompt(opts: vscode.InputBoxOptions, cancellationToken?: vscode.CancellationToken) {
  return vscode.window.showInputBox(opts, cancellationToken)
}

export function promptRegex(flags?: string) {
  return prompt({
    prompt: 'Selection RegExp',
    validateInput(input) {
      try {
        new RegExp(input)

        return undefined
      } catch {
        return 'Invalid ECMA RegExp.'
      }
    }
  }).then(x => x === undefined ? undefined : new RegExp(x, flags))
}

export function keypress(cancellationToken?: vscode.CancellationToken): Thenable<string> {
  return new Promise(resolve => {
    try {
      let done = false
      let subscription = vscode.commands.registerCommand('type', async ({ text }: { text: string}) => {
        if (!done) {
          subscription.dispose()
          done = true

          resolve(text)
        }
      })

      if (cancellationToken !== undefined)
        cancellationToken.onCancellationRequested(() => {
          if (!done) {
            subscription.dispose()
            done = true
          }

          return undefined
        })
    } catch {
      vscode.window.showErrorMessage('Unable to listen to keyboard events; is an extension overriding the "type" command (e.g VSCodeVim)?')
    }
  })
}


export function promptInList(canPickMany: true , items: [string, string][]): Thenable<undefined | number[]>
export function promptInList(canPickMany: false, items: [string, string][]): Thenable<undefined | number>

export function promptInList(canPickMany: boolean, items: [string, string][]): Thenable<undefined | number | number[]> {
  return new Promise<undefined | number | number[]>(resolve => {
    const quickPick = vscode.window.createQuickPick()

    quickPick.title = 'Object'
    quickPick.items = items.map(x => ({ label: x[0], description: x[1] }))
    quickPick.placeholder = 'Press one of the below keys.'
    quickPick.onDidChangeValue(key => {
      const index = items.findIndex(x => x[0].split(', ').includes(key))

      if (index === -1) {
        quickPick.value = ''

        return
      }

      quickPick.dispose()

      if (canPickMany)
        resolve(index === -1 ? undefined : [ index ])
      else
        resolve(index === -1 ? undefined : index)
    })

    quickPick.onDidHide(() => {
      const picked = quickPick.selectedItems

      quickPick.dispose()

      if (picked === undefined)
        resolve(undefined)

      if (canPickMany)
        resolve(picked.map(x => items.findIndex(item => item[1] === x.description)))
      else
        resolve(items.findIndex(x => x[1] === picked[0].description))
    })

    quickPick.show()
  })
}
