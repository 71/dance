Dance
=====

[Kakoune]-inspired key bindings for [Visual Studio Code][VSC].


## Huh?

Dance provides [Kakoune]-inspired commands and key bindings for [Visual Studio Code][VSC].

These key bindings are (mostly) compatible with [Kakoune]'s, but are meant to be an addition
to [Visual Studio Code][VSC], rather than an emulation layer on top of it.

#### Why [VS Code][VSC], and not [Kakoune] directly?
- Kakoune is an efficient and lightweight editor with a very small ecosystem.
  VS Code is an entire IDE with a huge ecosystem and many existing extensions.
- Kakoune is Unix only.

#### Why [Kakoune]'s key bindings, and not [Vim]'s?
- Whether you prefer Vim, Emacs or Kakoune key bindings is a matter of preference. I, for one,
  prefer [Kakoune's](https://github.com/mawww/kakoune/blob/master/doc/pages/keys.asciidoc).
- Vim's key bindings are [already available to VS Code users][VSCodeVim].

#### Why is it merely 'inspired' by [Kakoune]?
- Unlike [VSCodeVim] which attempts to emulate Vim, Dance's only goal is to provide
  VS Code-native [commands][VSCCommands] and [key bindings][VSCKeyBindings] that are inspired by [Kakoune].
- Kakoune, Vim and VS Code are all fully-fledged text editors; therefore, they have overlapping
  features. For instance, where [VSCodeVim] provides its own multi-cursor and command engines
  to feel more familiar to existing Vim users, Dance leaves multi-cursor mode and editor
  commands to VS Code entirely.


## User Guide

For most [commands], the usage is the same as in [Kakoune]. However, the following changes have been made:

### Pipes
- Pipes no longer accept shell commands, but instead accept 'expressions', those being:
  - `#<shell command>`: Pipes each selection into a shell command (the shell is taken from the `terminal.external.exec` value).
  - `/<pattern>[/<replacement>[/<flags>]`: A RegExp literal, as [defined in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions). Do note the addition of a `replacement`, for commands that add or replace text.
  - `<JS expression>`: A JavaScript expression in which the following variables are available:
    - `$`: Text of the current selection.
    - `$$`: Array of the text of all the selections.
    - `i`: Index of the current selection.

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
- `i + 1` replaces `1,1,1,1,1` into `1,2,3,4,5`, assuming that each selection is on a different digit.


## Progress

This project is a WIP. It's brand new, and far from complete.

In the following list, if a command is implemented, then its extending equivalent
(activated while pressing `Shift`) then likely is implemented as well.

Most (but not all) commands defined in [`commands`][commands] are implemented.

- [X] Basic movements:
  - [X] Arrows, hjkl.
  - [X] Move to character, move until character.
  - [X] Move to next word, move to previous word.
- [X] Insert mode:
  - [X] Enter insert mode with `a`, `i`, `o`, and their `Alt` / `Shift` equivalents.
  - [X] Exit insert mode with `Escape`.
- [X] Basic selections:
  - [X] Search in selections.
  - [X] Split in selections.
  - [X] Split selections by lines.
  - [X] Extend selections by taking lines.
  - [X] Trim selections.
- [X] Pipes.
- [X] Object selection.
- [X] Yanking:
  - [X] Yank.
  - [X] Paste.
- [ ] Changes:
  - [X] Join.
  - [X] Replace.
  - [ ] Delete.
  - [X] Indent.
  - [ ] Dedent.
  - [ ] Swap case.
- [ ] Macros.
- [ ] Registers.


## State

I'm working on this project as much as I can. However, since this is mostly something
I'm making for myself, I'm focusing on getting this working **fast**. Therefore, I'm not
focusing much on unit tests for now.

Contributions are welcome.


[commands]: ./commands
[Vim]: https://www.vim.org
[Kakoune]: https://github.com/mawww/kakoune
[VSC]: https://github.com/Microsoft/vscode
[VSCodeVim]: https://github.com/VSCodeVim/Vim
[VSCCommands]: https://code.visualstudio.com/api/extension-guides/command
[VSCKeyBindings]: https://code.visualstudio.com/docs/getstarted/keybindings
