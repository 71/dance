# Writing command tests

Command tests are plain text files that are separated in several sections.

### Sections
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

### Section content
Each section has content (the `...` in the example above). That content is plain text to which
one or more selections must be added using a `{...}` / `|{...}` syntax, where `...` is a number.

`{0}` represents the anchor of the 1st selection, and `|{2}` represents the active position of the 3rd selection.

Selections can be given in any order, but must be complete; that is, if a selection `3` is given, then the
selections `0`, `1`, and `2` must be defined at some point too. The anchor can be omitted, and will default to
the active position.

### Tests generation
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
