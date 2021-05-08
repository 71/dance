# 1

```
foo
^^^^ 0
bar
```

## 1 paste
[up](#1)

- .selections.saveText
- .edit.paste.after

```
foo
^^^^ 0
foo
bar
```

### 1 paste x
[up](#1-paste)

- .edit.paste.after

```
foo
^^^^ 0
foo
foo
bar
```

## 1 move-then-paste
[up](#1)

- .select.left.jump
- .edit.paste.after

```
foo
   | 0
foo
bar
```

### 1 move-then-paste move-2-then-paste
[up](#1-move-then-paste)

- .select.left.extend { count: 2 }
- .selections.saveText
- .edit.paste.after

```
foooo
 ^^ 0
foo
bar
```

# 2

```
hello
^^^^^^ 0

```

## 2 paste-3
[up](#2)

- .selections.saveText
- .edit.paste.after { count: 3 }

```
hello
^^^^^^ 0
hello
hello
hello

```

# 3

```
foo bar
^^ 0 ^^ 1
```

## 3 paste-select
[up](#3)

- .selections.saveText
- .edit.paste.after.select

```
fofoaro barfoar
  ^^ 3     ^^ 1
    ^^ 2     ^^ 0
```

## 3 paste-select-from-empty
[up](#3)

- .selections.saveText
- .selections.reduce
- .edit.paste.after.select

```
fofoaro barfoar
  ^^ 3     ^^ 1
    ^^ 2     ^^ 0
```

## 3 paste-select-before
[up](#3)

- .selections.saveText
- .edit.paste.before.select

```
foarfoo bfoarar
^^ 3     ^^ 1
  ^^ 2     ^^ 0
```

## 3 paste-select-before-from-empty
[up](#3)

- .selections.saveText
- .selections.reduce { where: "start" }
- .edit.paste.before.select

```
foarfoo bfoarar
^^ 3     ^^ 1
  ^^ 2     ^^ 0
```
