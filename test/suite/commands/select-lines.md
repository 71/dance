# initial

```
foo
^ 0
bar
baz
```

# whole buffer
[up](#initial)

- .select.buffer

```
foo
^^^^ 0
bar
^^^^ 0
baz
^^^^ 0
```

# line-1
[up](#initial)

- .select.line.below

```
foo
^^^^ 0
bar
baz
```

# line-extend-1
[up](#initial)

- .select.line.below.extend

```
foo
^^^^ 0
bar
baz
```

# line-2
[up](#line-1)

- .select.line.below

```
foo
bar
^^^^ 0
baz
```

# line-extend-2
[up](#line-extend-1)

- .select.line.below.extend

```
foo
^^^^ 0
bar
^^^^ 0
baz
```

# initial-3

```
hello
   ^^^ 0
world
^^^^^^ 0
  my
^^^ 0
    friends,
  and welcome
```

# line-3
[up](#initial-3)

- .select.line.below

```
hello
world
  my
^^^^^ 0
    friends,
  and welcome
```

# line-extend-3
[up](#initial-3)

- .select.line.below.extend

```
hello
   ^^^ 0
world
^^^^^^ 0
  my
^^^^^ 0
    friends,
  and welcome
```

# line-with-count-3
[up](#initial-3)

- .select.line.below { count: 2 }

```
hello
world
  my
    friends,
^^^^^^^^^^^^^ 0
  and welcome
```

# line-extend-with-count-3
[up](#initial-3)

- .select.line.below.extend { count: 2 }

```
hello
   ^^^ 0
world
^^^^^^ 0
  my
^^^^^ 0
    friends,
^^^^^^^^^^^^^ 0
  and welcome
```

# initial-4

```
hello
  ^^^^ 0
world

my
friend
```

# line-4
[up](#initial-4)

- .select.line.below

The full line is not yet selected, so select it.

```
hello
^^^^^^ 0
world

my
friend
```

# line-with-count-4a
[up](#initial-4)

- .select.line.below { count: 2 }

First select the full first line, then the next line.

```
hello
world
^^^^^^ 0

my
friend
```

# line-with-count-4b
[up](#line-with-count-4a)

- .select.line.below

An empty line is selected now.

```
hello
world

^ 0
my
friend
```

# line-with-count-4c
[up](#line-with-count-4b)

- .select.line.below

```
hello
world

my
^^^ 0
friend
```

# initial-5

The full line is selected, but in reverse direction.

```
hello
|^^^^^ 0
world
```

# line-5
[up](#initial-5)

- .select.line.below

The selection should be reversed without moving on.

```
hello
^^^^^^ 0
world
```

# line-extend-5a
[up](#initial-5)

- .select.line.below.extend

Anchor is unchanged but active moved to the line break, thus selecting it.

```
hello
     ^ 0
world
```

# line-extend-5b
[up](#line-extend-5a)

- .select.line.below.extend

Special case: anchor (instead of active) is moved to the line start, thus
selecting the full line in forward direction.

```
hello
^^^^^^ 0
world
```

# initial-6

```
hello
|^^^^^ 0
world
^ 0
```

# line-extend-6a
[up](#initial-6)

- .select.line.below.extend

The special case above does not apply if anchor is on a different line.

```
hello
world
^ 0
```

# line-extend-6b
[up](#line-extend-6a)

- .select.line.below.extend

So the selection will get stuck there with more `.select.line.below.extend`
commands.

```
hello
world
^ 0
```

# initial-7

```
the quick brown fox
          ^^^ 0
```

# line-start-7
[up](#initial-7)

- .select.lineStart

```
the quick brown fox
|^^^^^^^^^^^^ 0
```

# line-start-extend-7
[up](#initial-7)

- .select.lineStart.extend

```
the quick brown fox
|^^^^^^^^^ 0
```

# line-start-extend-character-7
[up](#initial-7)

> behavior <- character

- .select.lineStart.extend

```
the quick brown fox
|^^^^^^^^^^ 0
```

# line-end-7
[up](#initial-7)

- .select.lineEnd

```
the quick brown fox
             ^^^^^^ 0
```

# line-end-character-7
[up](#initial-7)

> behavior <- character

- .select.lineEnd

```
the quick brown fox
            ^^^^^^^ 0
```

# line-end-extend-7
[up](#initial-7)

- .select.lineEnd.extend

```
the quick brown fox
          ^^^^^^^^^ 0
```
