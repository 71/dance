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

- .select.up.jump { avoidEol: true }

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

- .select.down.jump { avoidEol: true }

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

- .select.down.jump { count: 2, avoidEol: true }

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

- .select.up.jump { count: 2, avoidEol: true }

```
foo
  ^ 0

bar

```

# initial-3

> behavior <- character

```
foo

^ 0
bar
baz
```

# left-3
[up](#initial-3)

- .select.left.jump

```
foo
   ^ 0

bar
baz
```

# right-3
[up](#initial-3)

- .select.right.jump

```
foo

bar
^ 0
baz
```

# up-3
[up](#initial-3)

- .select.up.jump

```
foo
^ 0

bar
baz
```

# down-3
[up](#initial-3)

- .select.down.jump

```
foo

bar
^ 0
baz
```

# down-3-up
[up](#down-3)

- .select.up.jump

```
foo

^ 0
bar
baz
```

# down-3-up-extend-a
[up](#down-3)

- .select.up.extend

```
foo

| 0
bar
^ 0
baz
```

# down-3-up-extend-b
[up](#down-3-up-extend-a)

- .select.up.extend

```
foo
| 0

^ 0
bar
^ 0
baz
```
