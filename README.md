# Dance

[Kakoune]-inspired key bindings for [Visual Studio Code][vsc].

## Important note

The next release of Dance (available in this branch) is a complete rewrite from
the previous release. It adds many features (to list a few, custom modes, better
commands, and a scripting API) and has many QOL improvements (better status bar
buttons, better [character mode](#selection-behaviors), better history, support
for multiple editors for one document, more tests, and better internal
architecture).

While this will improve the quality of Dance over time, in the short term this
will make it much less stable due to bugs. If you encounter a bug, please file
an issue (or directly submit a PR) containing [test cases](./test) for the
command.

Thanks for bearing with me!

## Huh?

Dance provides [Kakoune]-inspired commands and key bindings for
[Visual Studio Code][vsc], as well as support for custom modes and scripting.

Added key bindings are (mostly) compatible with [Kakoune]'s, but are meant to be
an addition to [Visual Studio Code][vsc], rather than an emulation layer on top
of it.

#### Why [VS Code][vsc], and not [Kakoune] directly?

- Kakoune is an efficient and lightweight editor with a very small ecosystem.
  VS Code is an entire IDE with a huge ecosystem and many existing extensions.
- Kakoune is Unix only.

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
    positions as coordonates of characters, rather than carets between
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

Dance by default uses caret-based selections just like VSCode. This means a
selection is anchored between two carets (i.e. positions between characters),
and may be empty.

If you prefer character-based selections like Kakoune, please set
`"selectionBehavior": "character"` in the configuration of the mode in which you
wish to use character-based selections. This mode is designed to work with
block-style cursors, so your configuration would typically look like:

```json
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
wrapper around `dance.modes.set` with the argument `{ input: "normal" }`.
Commands that take an input, like `dance.modes.set`, will prompt a user for a
value if no argument is given.

Additionally to having commands with many settings, Dance also exposes the
`dance.run` command, which runs JavaScript code. That code has access to the
[Dance API][API], and can perform operations with more control than Dance
commands. Where Dance commands in the `dance.selections` namespace operate the
same way on all selections at once, `dance.run` can be used to individually
manipulate selections.

### Pipes

Pipes no longer accept shell commands, but instead accept "expressions", those
being:
- `#<shell command>`: Pipes each selection into a shell command (the shell is
  taken from the `terminal.external.exec` value).
- `/<pattern>[/<replacement>[/<flags>]`: A RegExp literal, as
  [defined in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions).
  Do note the addition of a `replacement`, for commands that add or replace
  text.
- `<JS expression>`: A JavaScript expression in which the following variables are available:
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

### Miscellaneous changes

A few changes were made from Kakoune, mostly out of personal preference, and to make the
extension integrate better in VS Code. If you disagree with any of these changes,
you're welcome to open an issue to discuss it, or to add an option for it by submitting a PR.

- The default yank register `"` maps to the system clipboard.
- When using the default configuration:
  - The cursor is not a block, but a line: Dance focuses on selections, and using a line instead of
    a block makes it obvious whether zero or one characters are selected. Besides, the line-shaped
    cursor is the default in VS Code.
  - Changing the mode will also change the `editor.lineNumbers` configuration value to `on` in `insert`
    mode, and `relative` in normal mode.

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

## Progress

This project is still a WIP. It has gotten better over the years, but may have annoying bugs
and lack some features, especially for Kakoune users. Despite this, several users use Dance
daily.

In the following list, if a command is implemented, then its extending equivalent
(activated while pressing `Shift`) then likely is implemented as well.

Most (but not all) commands defined in [`commands`][commands] are implemented.

- [x] Basic movements:
  - [x] Arrows, hjkl.
  - [x] Move to character, move until character.
  - [x] Move to next word, move to previous word.
- [x] Insert mode:
  - [x] Enter insert mode with `a`, `i`, `o`, and their `Alt` / `Shift` equivalents.
  - [x] Exit insert mode with `Escape`.
- [x] Basic selections:
  - [x] Search in selections.
  - [x] Split in selections.
  - [x] Split selections by lines.
  - [x] Extend selections by taking lines.
  - [x] Trim selections.
- [x] Pipes.
- [x] Object selection.
- [x] Yanking:
  - [x] Yank.
  - [x] Paste.
- [x] Rotate:
  - [x] Rotate selections only.
  - [x] Rotate selections content only.
  - [x] Rotate selections and content.
- [x] Changes:
  - [x] Join.
  - [x] Replace.
  - [x] Delete.
  - [x] Indent.
  - [x] Dedent.
  - [x] Change case.
- [x] Search.
- [ ] History:
  - [x] Undo / redo.
  - [ ] Forward / backward.
  - [x] Repeat command.
  - [-] Repeat insertion.
- [x] Macros.
- [x] Registers.

## Contributing

### Plugins

Dance was designed to nicely interopate with other extensions: it does not
override the `type` command, and allows any extension to execute its commands.  
It should therefore be possible to create other extensions that work with Dance.
If you'd like to add new features to Dance directly, please file an issue.

### Bugs and features

There are unfortunately still bugs lurking around features missing. If you'd
like to fix bugs or add features, please look at the [issues] and file one if no
other issue matches your request. This will ensure that no two people work on
the same feature at the same time, and will be a good place to ask for help in
case you want to tackle this yourself.

When contributing, please be mindful of the existing coding conventions and
naming.

Your PR will be rebased on top of `master` in order to keep a clean commit
history. Please avoid unnecessary commits (`git commit --amend` is your friend).

### Tests

Refer to the [`test`](./test/README.md) directory.

[api]: ./src/api
[commands]: ./src/commands
[issues]: https://github.com/71/dance/issues
[vim]: https://www.vim.org
[kakoune]: https://github.com/mawww/kakoune
[vsc]: https://github.com/Microsoft/vscode
[vscodevim]: https://github.com/VSCodeVim/Vim
[vsccommands]: https://code.visualstudio.com/api/extension-guides/command
[vsckeybindings]: https://code.visualstudio.com/docs/getstarted/keybindings
