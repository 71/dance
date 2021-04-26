# initial

> behavior <- character

```
foo
bar
   ^ 0
baz
quxxx
```

# left
[up](#initial)

- .select.left.jump

```
foo
bar
  ^ 0
baz
quxxx
```

# right
[up](#initial)

- .select.right.jump

```
foo
bar
baz
^ 0
quxxx
```

# up
[up](#initial)

- .select.up.jump

```
foo
   ^ 0
bar
baz
quxxx
```

# up-skip-eol
[up](#initial)

- .select.up.jump { skipEol: true }

When at line end, moving to a different line will always select the last
character instead of line end. "Desired column" is set to `len + 1` (= 4)
though.

```
foo
  ^ 0
bar
baz
quxxx
```

# down
[up](#initial)

- .select.down.jump

```
foo
bar
baz
   ^ 0
quxxx
```

# down-skip-eol-1
[up](#initial)

- .select.down.jump { skipEol: true }

Similarly to the [test case above](#up-skip-eol), "desired column" is 4 so we
select the last character.

```
foo
bar
baz
  ^ 0
quxxx
```

# down-skip-eol-2
[up](#initial)

- .select.down.jump { count: 2, skipEol: true }

As explained above, the 4th character should be selected because it's on the
desired column.

```
foo
bar
baz
quxxx
   ^ 0
```

# blank-initial

> behavior <- character

```
foo

bar
   ^ 0

```

# blank-up-1
[up](#blank-initial)

- .select.up.jump

The second line is blank, so we will select its line break.

```
foo

^ 0
bar

```

# blank-up-2
[up](#blank-initial)

- .select.up.jump { count: 2, skipEol: true }

```
foo
  ^ 0

bar

```
