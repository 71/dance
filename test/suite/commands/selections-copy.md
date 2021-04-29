# initial-1

```
foo
^ 0
bar
baz
qux
```

# copy-1a
[up](#initial-1)

- .selections.copy

```
foo
^ 1
bar
^ 0
baz
qux
```

# copy-1b
[up](#copy-1a)

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

# initial-2

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

# copy-2a
[up](#initial-2)

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

# copy-2aa
[up](#copy-2a)

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

# copy-2aaa
[up](#copy-2aa)

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

# initial-3

```
ab
  ^ 0
cd
efg
hi
```

# copy-3a
[up](#initial-3)

- .selections.copy

```
ab
  ^ 1
cd
  ^ 0
efg
hi
```

# copy-3aa
[up](#copy-3a)

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
