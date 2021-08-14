Recipes
=======

This directory contains Dance "recipes" -- example configurations and commands
meant to show what can be done with Dance.

For more examples, please see the [test suite](../test) and the [Dance API](
../src/api) documentation, both of which contain many different tested
examples.

## Enabling or disabling Dance

Unlike, say, [VSCodeVim](https://github.com/VSCodeVim/Vim), Dance does not
provide a "disable Dance" command or option. This is by design, since Dance
features can be selectively disabled by using a custom mode. For instance, we
can define a dummy `disabled` mode that will not respond to any default Dance
keybinding:

`settings.json`:
```json
"dance.modes": {
  "disabled": {},
},
```

`keybindings.json`:
```json
{
  "key": "...",
  "command": "dance.modes.set",
  "args": {
    "input": "disabled"
  },
  "when": "dance.mode != 'disabled'",
},
{
  "key": "...",
  "command": "dance.modes.set",
  "args": {
    "input": "normal"
  },
  "when": "dance.mode == 'disabled'",
},
```

An advantage of using modes rather than a complete "disable Dance" command is
that other Dance features, such as `dance.run` and `dance.openMenu`, can keep
working. If you truly want to completely disable Dance for some reason, please
[disable it from the VS Code extensions panel](
https://code.visualstudio.com/docs/editor/extension-marketplace#_disable-an-extension).

## Generating code using commented JavaScript code

The following script can be used:
```js
await run(Selections.map((text) => text.replace(/^\/\/ |START$[\s\S]+?END$/gm, "")));
```

Before:
```
// await replace((text) => text.replace(/(\/\/ START\n)([\s\S]+?)(\/\/ END\n)/m, (_, before, after) =>
^
//   before + "const alphabet = " + JSON.stringify(
//     Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i)),
//     undefined, 2,
//   ) + "\n" + after);
// START

// END
     ^ 0
```

After:
```
// await replace((text) => text.replace(/(\/\/ START\n)([\s\S]+?)(\/\/ END\n)/m, (_, before, after) =>
^
//   before + "const alphabet = " + JSON.stringify(
//     Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i)),
//     undefined, 2,
//   ) + ";\n" + after);
// START
const alphabet = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z"
];
// END
     ^ 0
```

## Using `jj` to escape `insert` mode

Using the `prefix` argument of the [`dance.openMenu`](../src/commands#openmenu)
command:

```json
{
  "key": "j",
  "command": "dance.openMenu",
  "args": {
    "menu": {
      "items": {
        "j": {
          "text": "escape to Normal",
          "command": "dance.modes.set.normal",
        },
      },
    },
    "prefix": "j",
  },
  "when": "editorTextFocus && dance.mode == 'insert'",
}
```

For more information, please refer to [this issue](
https://github.com/71/dance/issues/74#issuecomment-819557435).
