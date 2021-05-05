# 1

```
foo
bar
| 0
baz

```

## 1 to-first-line
[up](#1)

- .select.lineStart { count: 1, shift: "jump" }

```
foo
| 0
bar
baz

```

## 1 to-last-line
[up](#1)

- .select.lastLine { shift: "jump" }

Note that the last empty line is not selected.

```
foo
bar
baz
| 0

```
