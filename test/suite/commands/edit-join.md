# 1

```
a b
^^^ 0
c d
^^^ 0
e f
^^^ 0
g h
```

## 1 join
[up](#1)

- .edit.join

```
a b c d e f
^^^^^^^^^^^ 0
g h
```

## 1 join-select
[up](#1)

- .edit.join.select

```
a b c d e f
   ^ 0 ^ 1
g h
```

# 2

```
a b
  ^ 0
c d
e f
   ^ 1
g h
i j
```

## 2 join
[up](#2)

- .edit.join

```
a b c d
  ^ 0
e f g h
   ^ 1
i j
```

## 2 join-select
[up](#2)

- .edit.join.select

```
a b c d
   ^ 0
e f g h
   ^ 1
i j
```
