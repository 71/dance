Recipes
=======

This directory contains Dance "recipes" -- example configurations and commands
meant to show what can be done with Dance.

For more examples, please see the [test suite](../test) and the [Dance API](
../src/api) documentation, both of which contain many different tested
examples.

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

## Using `#` to search for current word under cursor

We will use `dance.run` and combine multiple commands to mimic the behavior of `#` in Vim:
1. Select to the end of the current word
2. Select back to the begin of the current word
3. Call search current selection command

```json
{
   "key": "shift+3",
   "command": "dance.run",
   "args": {
       "commands": [
           {
               "command": "dance.seek.word",
               "args": { "stopAtEnd": true }
           },
           {
               "command": "dance.seek.word",
               "args": { "direction": -1 }
           },
           {
               "command": "dance.search.selection",
               "args": { "smart": true }
           },
       ]
   },
   "when": "editorTextFocus && dance.mode == 'normal'"
}
```
