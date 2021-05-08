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
