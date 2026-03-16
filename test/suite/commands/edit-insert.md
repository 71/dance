# 1

```
foo bar
   ^^ 0
```

## 1 delete
[up](#1)

- .edit.delete

```
fooar
   | 0
```

## 1 delete-character
[up](#1)

> behavior <- character

- .edit.delete

```
fooar
   ^ 0
```

### 1 delete-character x
[up](#1-delete-character)

- .edit.delete

```
foor
   ^ 0
```

# 2

```
foo 
   ^ 0
bar
```

## 2 delete-line
[up](#2)

- .select.line.below.extend
- .edit.delete

```
bar
| 0
```

## 2 delete-line-preserving-lines
[up](#2)

- .select.line.below.extend
- .edit.delete-insert-preserving-lines

```

| 0
bar
```

