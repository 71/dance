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
  - Some features are provided to mimic Kakoune's behavior (e.g. treating positions as coordonates
    of characters, rather than carets between characters like VS Code), but are optional.
- Kakoune, Vim and VS Code are all fully-fledged text editors; therefore, they have overlapping
  features. For instance, where [VSCodeVim] provides its own multi-cursor and command engines
  to feel more familiar to existing Vim users, Dance leaves multi-cursor mode and editor
  commands to VS Code entirely.


## User Guide

For most [commands], the usage is the same as in [Kakoune]. However, the following changes have been made:

### Selection behaviors

Dance by default uses caret-based selections just like VSCode. This means a selection is anchored between two carets (i.e. positions between characters), and may be empty.

If you prefer character-based selections like Kakoune, please set `"dance.selectionBehavior": "character"` in your settings. This will make Dance treat selections as inclusive ranges between two characters, and implies that each selection will contain at least one character. (This behavior is recommended for Kakoune-users who have already developed muscle memory, e.g. hitting `;d` to delete one character.)

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


### Miscellaneous changes
A few changes were made from Kakoune, mostly out of personal preference, and to make the
extension integrate better in VS Code. If you disagree with any of these changes,
you're welcome to open an issue to discuss it, or to add an option for it by submitting a PR.

- The cursor is not a block, but a line: Dance focuses on selections, and using a line instead of
  a block makes it obvious whether zero or one characters are selected. Besides, the line-shaped
  cursor is the default in VS Code.
- Changing the mode will also change the `editor.lineNumbers` configuration value to `on` in `insert`
  mode, and `relative` in normal mode.
- The default yank register `"` maps to the system clipboard.
- There are some additional features not documented here but mentioned in [issues] and/or in
  the configuration of the plugin. TODO: document them here.


### Troubleshooting
Dance uses the built-in VS Code key bindings, and therefore does not override the `type` command.
**However**, it sometimes needs access to the `type` command, in dialogs and register selection,
for instance. Consequently, it is not compatible with extensions that always override the `type`
command, such as [VSCodeVim]; these extensions must therefore be disabled.


## Progress

This project is still a WIP. It has gotten better over the years, but may have annoying bugs
and lack some features, especially for Kakoune users. Despite this, several users use Dance
daily.

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
- [X] Rotate:
  - [X] Rotate selections only.
  - [X] Rotate selections content only.
  - [X] Rotate selections and content.
- [X] Changes:
  - [X] Join.
  - [X] Replace.
  - [X] Delete.
  - [X] Indent.
  - [X] Dedent.
  - [X] Change case.
- [X] Search.
- [ ] History:
  - [X] Undo / redo.
  - [ ] Forward / backward.
  - [X] Repeat command.
  - [ ] Repeat insertion.
- [X] Macros.
- [ ] Registers.


## Contributing

### Plugins
Dance was designed to nicely interopate with other extensions: it does not override
the `type` command, and allows any extension to execute its commands.  
It should therefore be possible to create other extensions that work with Dance. If
you'd like to add new features to Dance directly, please file an issue.

### Bugs and features
There are unfortunately still bugs lurking around features missing. If you'd like to
fix bugs or add features, please look at the [issues] and file one if no other issue
matches your request. This will ensure that no two people work on the same feature
at the same time, and will be a good place to ask for help in case you want
to tackle this yourself.

When contributing, please be mindful of the existing coding conventions and naming.

Your PR will be rebased on top of `master` in order to keep a clean commit history.
Please avoid unnecessary commits (`git commit --amend` is your friend).

### Tests
We recently started adding tests to Dance. Most tests are in `test/suite/commands`,
as plain text files that are separated into several sections.

Tests can be run and debugged in VS Code in the run menu, under "Run Extension Tests".

#### Sections
Each section has a name, which is any string that has no whitespace.

Except for the first section (implicitly named `0` or `root`), each section
is associated with some transition that consists of several Dance commands to run.

For instance, let's look at the following code:

```
...

//== 0 > 1
//= dance.select.line
...

//== 1 > 2
//= dance.select.line.extend
...

//== 1 > 3
//= dance.select.line
//= dance.select.line.extend
...
```

It defines three sections:
- `1`, which is reached after executing `dance.select.line` from section `0`.
- `2`, which is reached after executing `dance.select.line.extend` from section `1`.
- `3`, which is reached after executing `dance.select.line` and then `dance.select.line.extend` from section `1`.

As you can see, several sections can depend on the same parent section. Do note that
sections must be defined in order; that is, a section `a` cannot depend on a section `b`
if section `b` is defined after `a`.

#### Section content
Each section has content (the `...` in the example above). That content is plain text to which
one or more selections must be added using a `{...}` / `|{...}` syntax, where `...` is a number.

`{0}` represents the anchor of the 1st selection, and `|{2}` represents the active position of the 3rd selection.

Selections can be given in any order, but must be complete; that is, if a selection `3` is given, then the
selections `0`, `1`, and `2` must be defined at some point too. The anchor can be omitted, and will default to
the active position.

#### Tests generation
For each transition, a test will be generated making sure that executing the corresponding commands
will lead to some document with selections at some locations.

Let's look at the following code:

```
{0}f|{0}oo

//== 0 > 1
//= dance.right
f{0}o|{0}o

//== 1 > 2
//= dance.delete.yank
f{0}o|{0}
```

The first generated test asserts that calling `dance.right` in the document `foo` where `f` is the main selection
leads to a document `foo` with the first `o` selected.

The second generated test asserts that calling `dance.delete.yank` in the document `foo` where the first `o` is
the main selection leads to a document `fo` with `o` selected.

#### Other features
- Command test files ending with `.caret` will we run with `selectionBehavior == "caret"`. Otherwise,
  `selectionBehavior == "character"` is used.
- Comments can be added by having lines start with "// ".
- When arguments must be passed to the command, JSON can be used, e.g.
  ```
  //= {"command": "dance.objects.performSelection", "args": [{"object": "parens", "action": "selectToEnd"}]}
  ```
- When a command awaits a key press, it can be added **after** the command, e.g.
  ```
  //= dance.select.to.included
  //= type:c
  ```


[commands]: ./commands
[issues]: https://github.com/71/dance/issues
[Vim]: https://www.vim.org
[Kakoune]: https://github.com/mawww/kakoune
[VSC]: https://github.com/Microsoft/vscode
[VSCodeVim]: https://github.com/VSCodeVim/Vim
[VSCCommands]: https://code.visualstudio.com/api/extension-guides/command
[VSCKeyBindings]: https://code.visualstudio.com/docs/getstarted/keybindings
