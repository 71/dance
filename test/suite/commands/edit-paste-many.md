# 1

```
foo bar quux
^^^ 2   ^^^^ 0
    ^^^ 1
```

## 1 paste-after-select
[up](#1)

- .selections.saveText
- .edit.paste.after.select

```
foofoo barbar quuxquux
   ^^^ 2          ^^^^ 0
          ^^^ 1
```

## 1 paste-before-select
[up](#1)

- .selections.saveText
- .edit.paste.before.select

```
foofoo barbar quuxquux
^^^ 2         ^^^^ 0
       ^^^ 1
```

## 1 paste-all-after-select
[up](#1)

- .selections.saveText
- .edit.pasteAll.after.select

```
foofoobarquux barfoobarquux quuxfoobarquux
   ^^^ 8 ^^^^ 6  ^^^ 5 ^^^^ 3   ^^^ 2 ^^^^ 0
      ^^^ 7         ^^^ 4          ^^^ 1
```

## 1 paste-all-before-select
[up](#1)

- .selections.saveText
- .edit.pasteAll.before.select

```
foobarquuxfoo foobarquuxbar foobarquuxquux
^^^ 8 ^^^^ 6  ^^^ 5 ^^^^ 3  ^^^ 2 ^^^^ 0
   ^^^ 7         ^^^ 4         ^^^ 1
```
