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
- Unlike [VSCodeVim] which attempts to emulate Vim, Cursor Dance's only goal is to provide
  VS Code-native [commands] and [key bindings][keybindings] that are inspired by [Kakoune].
- Kakoune, Vim and VS Code are all fully-fledged text editors; therefore, they have overlapping
  features. For instance, where [VSCodeVim] provides its own multi-cursor and command engines
  to feel more familiar to existing Vim users, Bullet Dance leaves multi-cursor mode and editor
  commands to VS Code entirely.


## Progress

This project is a WIP. It's brand new, and far from complete.

In the following list, if a command is implemented, then its extending equivalent
(activated while pressing `Shift`) then likely is implemented as well.

Most (but not all) commands defined in [`commands`](./commands) are implemented.

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
- [ ] Yanking:
  - [ ] Yank.
  - [ ] Paste.
- [ ] Edits:
  - [ ] Remove word.
  - [ ] Indent / Dedent.
- [ ] Macros.
- [ ] Registers.


## State

I'm working on this project as much as I can. However, since this is mostly something
I'm making for myself, I'm focusing on getting this working **fast**. Therefore, I'm not
focusing much on unit tests for now.

Contributions are welcome.


[Kakoune]: https://github.com/mawww/kakoune
[VSC]: https://github.com/Microsoft/vscode
[VSCodeVim]: https://github.com/VSCodeVim/Vim
[commands]: https://code.visualstudio.com/api/extension-guides/command
[keybindings]: https://code.visualstudio.com/docs/getstarted/keybindings
