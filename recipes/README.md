Recipes
=======

This directory contains Dance "recipes" -- example configurations and commands
meant to show what can be done with Dance.

For more examples, please see the [test suite](../test) and the [Dance API](
../src/api) documentation, both of which contain many different tested
examples.

## Generating code using commented JavaScript code
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
