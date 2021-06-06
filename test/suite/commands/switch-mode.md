# 1

> behavior <- character

```
abc def
  ^ 0
```

## 1 insert-before
[up](#1)

- .modes.insert.before

```
abc def
  | 0
```

### 1 insert-before restore
[up](#1-insert-before)

- .modes.set.normal

```
abc def
  ^ 0
```

## 1 insert-after
[up](#1)

- .modes.insert.after

```
abc def
   | 0
```

It would be nice to test the `restore` version too, but right now this does not
work in tests because tests don't work too well with saved selections.

# 2

> behavior <- character

```
abc
def
 ^ 0
ghi
```

## 2 insert-next-line-below
[up](#2)

- .edit.newLine.below.insert

```
abc
def

| 0
ghi
```

It would be nice to test the `restore` version too, but right now this does not
work in tests because tests don't work too well with saved selections.

## 2 insert-next-line-above
[up](#2)

- .edit.newLine.above.insert

```
abc

| 0
def
ghi
```

It would be nice to test the `restore` version too, but right now this does not
work in tests because tests don't work too well with saved selections.
