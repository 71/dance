# 1

```
foo
^ 0
bar
baz
```

## 1 whole-buffer
[up](#1)

- .select.buffer

```
foo
^^^^ 0
bar
^^^^ 0
baz
^^^ 0
```

## 1 select-line
[up](#1)

- .select.line.below

```
foo
^^^^ 0
bar
baz
```

### 1 select-line x
[up](#1-select-line)

- .select.line.below

```
foo
bar
^^^^ 0
baz
```

## 1 extend-line
[up](#1)

- .select.line.below.extend

```
foo
^^^^ 0
bar
baz
```

### 1 extend-line x
[up](#1-extend-line)

- .select.line.below.extend

```
foo
^^^^ 0
bar
^^^^ 0
baz
```

# 2

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

## 2 line
[up](#2)

- .select.line.below

```
hello
world
  my
^^^^^ 0
    friends,
  and welcome
```

## 2 line-extend
[up](#2)

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

## 2 line-2
[up](#2)

- .select.line.below { count: 2 }

```
hello
world
  my
    friends,
^^^^^^^^^^^^^ 0
  and welcome
```

## 2 line-extend-2
[up](#2)

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

# 3

```
hello
  ^^^^ 0
world

my
friend
```

## 3 line
[up](#3)

- .select.line.below

The full line is not yet selected, so select it.

```
hello
^^^^^^ 0
world

my
friend
```

## 3 line-2
[up](#3)

- .select.line.below { count: 2 }

First select the full first line, then the next line.

```
hello
world
^^^^^^ 0

my
friend
```

### 3 line-2 line
[up](#3-line-2)

- .select.line.below

An empty line is selected now.

```
hello
world

^ 0
my
friend
```

#### 3 line-2 line x
[up](#3-line-2-line)

- .select.line.below

```
hello
world

my
^^^ 0
friend
```

# 4

The full line is selected, but in reverse direction.

```
hello
|^^^^^ 0
world
```

## 4 line
[up](#4)

- .select.line.below

The selection should be reversed without moving on.

```
hello
^^^^^^ 0
world
```

# 5

```
hello
|^^^^^ 0
world
^ 0
```

## 5 line-extend
[up](#5)

- .select.line.below.extend

The special case above does not apply if anchor is on a different line.

```
hello
world
^ 0
```

### 5 line-extend x
[up](#5-line-extend)

- .select.line.below.extend

```
hello
world
^^^^^ 0
```

# 6

```
foo
 | 0
bar
baz
quux
```

## 6 line
[up](#6)

- .select.line.below

```
foo
^^^^ 0
bar
baz
quux
```

### 6 line x
[up](#6-line)

- .select.line.below

```
foo
bar
^^^^ 0
baz
quux
```

#### 6 line x x
[up](#6-line-x)

- .select.line.below

```
foo
bar
baz
^^^^ 0
quux
```

### 6 line line-extend
[up](#6-line)

- .select.line.below.extend

```
foo
^^^^ 0
bar
^^^^ 0
baz
quux
```

## 6 line-extend
[up](#6)

- .select.line.below.extend

```
foo
^^^^ 0
bar
baz
quux
```
