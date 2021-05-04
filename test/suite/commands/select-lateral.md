# 1

> behavior <- character

```
foo
bar
   ^ 0
baz
quxxx
```

## 1 left
[up](#1)

- .select.left.jump

```
foo
bar
  ^ 0
baz
quxxx
```

## 1 right
[up](#1)

- .select.right.jump

```
foo
bar
baz
^ 0
quxxx
```

## 1 up
[up](#1)

- .select.up.jump

```
foo
   ^ 0
bar
baz
quxxx
```

## 1 up-skip-eol
[up](#1)

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

## 1 down
[up](#1)

- .select.down.jump

```
foo
bar
baz
   ^ 0
quxxx
```

## 1 down-skip-eol
[up](#1)

- .select.down.jump { avoidEol: true }

Similarly to the [test case above](#1-up-skip-eol), "desired column" is 4 so we
select the last character.

```
foo
bar
baz
  ^ 0
quxxx
```

## 1 down-skip-eol-2
[up](#1)

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

# 2

> behavior <- character

```
foo

bar
   ^ 0

```

## 2 up
[up](#2)

- .select.up.jump

The second line is blank, so we will select its line break.

```
foo

^ 0
bar

```

## 2 up-skip-eol-2
[up](#2)

- .select.up.jump { count: 2, avoidEol: true }

```
foo
  ^ 0

bar

```

# 3

> behavior <- character

```
foo

^ 0
bar
baz
```

## 3 left
[up](#3)

- .select.left.jump

```
foo
   ^ 0

bar
baz
```

## 3 right
[up](#3)

- .select.right.jump

```
foo

bar
^ 0
baz
```

## 3 up
[up](#3)

- .select.up.jump

```
foo
^ 0

bar
baz
```

## 3 down
[up](#3)

- .select.down.jump

```
foo

bar
^ 0
baz
```

### 3 down up
[up](#3-down)

- .select.up.jump

```
foo

^ 0
bar
baz
```

### 3 down up-extend
[up](#3-down)

- .select.up.extend

```
foo

| 0
bar
^ 0
baz
```

#### 3 down up-extend x
[up](#3-down-up-extend)

- .select.up.extend

```
foo
| 0

^ 0
bar
^ 0
baz
```
