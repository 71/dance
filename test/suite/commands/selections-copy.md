# 1

```
foo
^ 0
bar
baz
qux
```

## 1 copy
[up](#1)

- .selections.copy

```
foo
^ 1
bar
^ 0
baz
qux
```

### 1 copy x
[up](#1-copy)

- .selections.copy

```
foo
^ 2
bar
^ 1
baz
^ 0
qux
```

# 2

```
aaa aaa aaa
  bb bb bb bb
   ^ 0     ^^ 1
    cc cc cc cc
      ddd
     ee
    f
  gg gg gg gg gg
```

## 2 copy
[up](#2)

- .selections.copy

Basic copy with multiple selections.

```
aaa aaa aaa
  bb bb bb bb
   ^ 2     ^^ 3
    cc cc cc cc
   ^ 0     ^^ 1
      ddd
     ee
    f
  gg gg gg gg gg
```

### 2 copy x
[up](#2-copy)

- .selections.copy

Skip a line because it's too short.

```
aaa aaa aaa
  bb bb bb bb
   ^ 4     ^^ 5
    cc cc cc cc
   ^ 2     ^^ 3
      ddd
   ^ 0
     ee
    f
  gg gg gg gg gg
           ^^ 1
```

#### 2 copy x x
[up](#2-copy-x)

- .selections.copy

Do not add selections after the end of the document.

```
aaa aaa aaa
  bb bb bb bb
   ^ 5     ^^ 6
    cc cc cc cc
   ^ 3     ^^ 4
      ddd
   ^ 1
     ee
   ^ 0
    f
  gg gg gg gg gg
           ^^ 2
```

# 3

```
ab
  ^ 0
cd
efg
hi
```

## 3 copy
[up](#3)

- .selections.copy

```
ab
  ^ 1
cd
  ^ 0
efg
hi
```

### 3 copy x
[up](#3-copy)

- .selections.copy

```
ab
  ^ 2
cd
  ^ 1
efg
  ^ 0
hi
```
