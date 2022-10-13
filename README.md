## Dance with Helix bindings
This is a modification to the [Dance](https://github.com/71/dance) VsCode
extension, that aims to replace the [Kakoune][kakoune]-inspired 
Keybindings with [Helix](https://helix-editor.com) inspired keybindings 

*** This is a WIP ***

A lot of stuff is working, but there are key things that are missing, broken or untestet!

For example match-mode is pretty broken at the current time


Original README:

# Dance

[Kakoune]-inspired key bindings, modes, menus and scripting for
[Visual Studio Code][vsc].

## Huh?

Dance provides [Kakoune]-inspired commands and key bindings for
[Visual Studio Code][vsc], as well as support for custom modes and scripting.

Added key bindings are (mostly) compatible with [Kakoune]'s, but are meant to be
an addition to [Visual Studio Code][vsc], rather than an emulation layer on top
of it.

#### Why [VS Code][vsc], and not [Kakoune] directly?

- Kakoune is an efficient and lightweight editor with a very small ecosystem.
  VS Code is an entire IDE with a huge ecosystem and many existing extensions.
- Kakoune is Unix-only.

#### Why [Kakoune]'s key bindings, and not [Vim]'s?

- Whether you prefer Vim, Emacs or Kakoune key bindings is a matter of
  preference. I, for one, prefer
  [Kakoune's](https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc).
- Vim's key bindings are [already available to VS Code users][vscodevim].

#### Why is it merely 'inspired' by [Kakoune]?

- Unlike [VSCodeVim] which attempts to emulate Vim, Dance's only goal is to
  provide VS Code-native [commands][vsccommands] and
  [key bindings][vsckeybindings] that are inspired by [Kakoune].
  - Some features are provided to mimic Kakoune's behavior (e.g. treating
    positions as coordinates of characters, rather than carets between
    characters like VS Code), but are optional.
- Kakoune, Vim and VS Code are all fully-fledged text editors; therefore, they
  have overlapping features. For instance, where [VSCodeVim] provides its own
  multi-cursor and command engines to feel more familiar to existing Vim users,
  Dance leaves multi-cursor mode and editor commands to VS Code entirely.

## User Guide

For most [commands], the usage is the same as in [Kakoune]. However, the
following changes have been made:

### Custom modes

All modes are custom. By default, the `normal` and `insert` modes are defined,
and many [Kakoune]-inspired keybindings are available. More modes can be
created, though. These modes are configured with `dance.modes`.

### Selection behaviors

Dance by default uses caret-based selections just like VS Code. This means a
selection is anchored between two carets (i.e. positions between characters),
and may be empty.

If you prefer character-based selections like Kakoune, please set
`"selectionBehavior": "character"` in the configuration of the mode in which you
wish to use character-based selections. This mode is designed to work with
block-style cursors, so your configuration would typically look like:

```jsonc
"dance.modes": {
  "insert": {
    // ...
  },
  "normal": {
    "cursorStyle": "block",
    "selectionBehavior": "character",
    // ...
  }
},
```

If this is enabled, Dance will internally treat selections as inclusive ranges
between two characters and imply that each selection contains at least one
character.

### Scripting

Most keybindings exposed by Dance are actually implemented by running several
Dance commands in a row. For instance, `dance.modes.set.normal` is actually a
wrapper around `dance.modes.set` with the argument `{ mode: "normal" }`.
Commands that take an input, like `dance.modes.set`, will prompt a user for a
value if no argument is given.

Additionally to having commands with many settings, Dance also exposes the
`dance.run` command, which runs JavaScript code. That code has access to the
[Dance API][API], and can perform operations with more control than Dance
commands. Where Dance commands in the `dance.selections` namespace operate the
same way on all selections at once, `dance.run` can be used to individually
manipulate selections.

Finally, the [Dance API][API] is exported by Dance. Other VS Code extensions
can specify that they depend on Dance (with the [`extensionDependencies`
property](https://code.visualstudio.com/api/references/extension-manifest#fields)),
and then access the API by calling [`activate`](
https://code.visualstudio.com/api/references/vscode-api#Extension.activate):

```js
const { api } = await vscode.extensions.getExtension("gregoire.dance").activate();
```

### Pipes

Pipes no longer accept shell commands, but instead accept "expressions", those
being:
- `#<shell command>`: Pipes each selection into a shell command (the shell
  respects the `terminal.integrated.automationProfile.<os>` profile).
- `/<pattern>[/<replacement>[/<flags>]`: A RegExp literal, as
  [defined in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions).
  Do note the addition of a `replacement`, for commands that add or replace
  text.
- `<JS expression>`: A JavaScript expression in which the following variables
  are available:
  - `$`: Text of the current selection.
  - `$$`: Array of the text of all the selections.
  - `i`: Index of the current selection.
  - `n`: Number of selections in `$$`.

  Depending on the result of the expression, it will be inserted differently:
  - `string`: Inserted directly.
  - `number`: Inserted in its string representation.
  - `boolean`: Inserted as `true` or `false`.
  - `null`: Inserted as `null`.
  - `undefined`: Inserted as an empty string.
  - `object`: Inserted as JSON.
  - Any other type: Leads to an error.

#### Examples

- `/(\d+),(\d+)/$1.$2/g` replaces `12,34` into `12.34`.
- `i + 1` replaces `1,1,1,1,1` into `1,2,3,4,5`, assuming that each selection is
  on a different digit.

### Status bar

Dance provides several status bar segments (left-aligned) exposing info similar
to Kakoune's default mode-line. Most of them are hidden by default and only shown
contextually:

- current mode: click to switch to another mode
- macro recording status: click to stop recording
- current count prefix: click to reset to 0
- current register: click to unset
- dance error: click to copy the full description of the last error

### Dance view

Dance also provides a [custom view](
https://code.visualstudio.com/docs/getstarted/userinterface#_views) which lists
all registers and their contents.

### Miscellaneous changes

A few changes were made from Kakoune, mostly out of personal preference, and to
make the extension integrate better with VS Code.

- The default yank register `"` maps to the system clipboard.
- Registers can have arbitrary names. If the name of a register starts with a
  single space character, it will be local to the current document.
- When using the default configuration (that is to say, these settings can be
  modified):
  - The cursor is not a block, but a line: Dance focuses on selections, and
    using a line instead of a block makes it obvious whether zero or one
    characters are selected. Besides, the line-shaped cursor is the default in
    VS Code.
  - Changing the mode will also change the `editor.lineNumbers` configuration
    value to `on` in `insert` mode, and `relative` in normal mode.

### Troubleshooting

- Dance uses the built-in VS Code key bindings, and therefore does not override
  the `type` command. **However**, it sometimes needs access to the `type`
  command, in dialogs and register selection, for instance. Consequently, it is
  not compatible with extensions that always override the `type` command, such
  as [VSCodeVim]; these extensions must therefore be disabled.
- If you're on Linux and your keybindings don't work as expected (for instance,
  `swapescape` is not respected), take a look at the [VS Code guide for
  troubleshooting Linux keybindings](
  https://github.com/Microsoft/vscode/wiki/Keybinding-Issues#troubleshoot-linux-keybindings).
  TL;DR: adding `"keyboard.dispatch": "keyCode"` to your VS Code settings will
  likely fix it.

## Contributing

### Bugs

There are unfortunately still bugs lurking around. If you find one, please
ensure that it has not been reported yet and submit a [test](./test/README.md)
that does not pass and can be used to reliably reproduce the bug.

### Features

If you'd like to add or improve a feature, please make sure that no similar
feature has been requested in the [issues] and file a new issue for it. This
will ensure that no two people work on the same feature at the same time, and
will be a good place to ask for help in case you want to tackle this yourself.  
Since some features are not general enough, it may be requested of you to make a
plugin that uses the Dance API or to simply use scripts in the meantime.

When contributing, please be mindful of the existing coding conventions and
naming.

Your PR will be rebased on top of `master` in order to keep a clean commit
history. Please avoid unnecessary commits (`git commit --amend` is your friend).

[api]: ./src/api
[commands]: ./src/commands
[issues]: https://github.com/71/dance/issues
[vim]: https://www.vim.org
[kakoune]: https://github.com/mawww/kakoune
[vsc]: https://github.com/Microsoft/vscode
[vscodevim]: https://github.com/VSCodeVim/Vim
[vsccommands]: https://code.visualstudio.com/api/extension-guides/command
[vsckeybindings]: https://code.visualstudio.com/docs/getstarted/keybindings
