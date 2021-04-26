# initial-1

```
abcabc
| 0
```

# select-to-1a
[up](#initial-1)

- .seek { input: "c", include: true }

```
abcabc
^^^ 0
```

# select-to-1b
[up](#select-to-1a)

- .seek { input: "c" }

```
abcabc
   ^^ 0
```

# select-to-1b-character
[up](#select-to-1a)

> behavior <- character

- .seek { input: "c" }

```
abcabc
  ^^^ 0
```

# select-to-1c
[up](#initial-1)

- .seek { input: "c", count: 2 }

```
abcabc
^^^^^ 0
```

# select-to-1d
[up](#select-to-1c)

- .seek { input: "c" }

```
abcabc
^^^^^ 0
```

# select-to-1d-character
[up](#select-to-1c)

> behavior <- character

- .seek { input: "c" }

```
abcabc
^^^^^ 0
```

# select-to-backward-1a
[up](#select-to-1d)

- .seek { input: "b", direction: -1 }

```
abcabc
     | 0
```

# select-to-backward-1a-character
[up](#select-to-1d-character)

- .seek { input: "b", direction: -1 }

```
abcabc
  |^^ 0
```

# select-to-backward-1b
[up](#select-to-backward-1a)

- .seek { input: "a", direction: -1 }

```
abcabc
    ^ 0
```

# initial-2

```
abcdefghijk
   ^^^^ 0
```

# extend-backward-2a
[up](#initial-2)

- .seek { input: "e", direction: -1, shift: "extend", include: true }

```
abcdefghijk
   ^^ 0
```

# extend-backward-2b
[up](#initial-2)

- .seek { input: "g", direction: -1, shift: "extend", include: true }

Selection left unchanged since it can't find another "g" before this.

```
abcdefghijk
   ^^^^ 0
```

# extend-backward-2c
[up](#initial-2)

- .seek { input: "d", direction: -1, shift: "extend", include: true }

```
abcdefghijk
   ^ 0
```

# extend-backward-2d
[up](#initial-2)

- .seek { input: "b", direction: -1, shift: "extend", include: true }

```
abcdefghijk
 |^ 0
```

# extend-backward-2d-character
[up](#initial-2)

> behavior <- character

- .seek { input: "b", direction: -1, shift: "extend", include: true }

```
abcdefghijk
 |^^ 0
```

# extend-backward-2e
[up](#initial-2)

- .seek { input: "g", direction: -1, shift: "extend" }

Selection left unchanged since it can't find another "g" before this.

```
abcdefghijk
   ^^^^ 0
```

# extend-backward-2f
[up](#initial-2)

- .seek { input: "f", direction: -1, shift: "extend" }

```
abcdefghijk
   ^^^ 0
```

# extend-backward-2g
[up](#initial-2)

- .seek { input: "e", direction: -1, shift: "extend" }

```
abcdefghijk
   ^^ 0
```

# extend-backward-2h
[up](#initial-2)

- .seek { input: "c", direction: -1, shift: "extend" }

```
abcdefghijk
   | 0
```

# extend-backward-2i
[up](#initial-2)

- .seek { input: "b", direction: -1, shift: "extend" }

```
abcdefghijk
  ^ 0
```
