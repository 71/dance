# initial

```
a b
^^^ 0
c d
^^^ 0
e f
^^^ 0
g h
```

# join
[up](#initial)

- .edit.join

```
a b c d e f
^^^^^^^^^^^ 0
g h
```

# join-select
[up](#initial)

- .edit.join.select

```
a b c d e f
   ^ 0 ^ 1
g h
```

# initial-2

```
a b
  ^ 0
c d
e f
   ^ 1
g h
i j
```

# join-2
[up](#initial-2)

- .edit.join

```
a b c d
  ^ 0
e f g h
   ^ 1
i j
```

# join-select-2
[up](#initial-2)

- .edit.join.select

```
a b c d
   ^ 0
e f g h
   ^ 1
i j
```
