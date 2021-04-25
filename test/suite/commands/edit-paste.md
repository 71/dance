# initial

```
foo
^^^^ 0
bar
```

# a-1
[up](#initial)

- .selections.saveText
- .edit.paste.after

```
foo
^^^^ 0
foo
bar
```

# a-2
[up](#a-1)

- .edit.paste.after

```
foo
^^^^ 0
foo
foo
bar
```

# b-1
[up](#initial)

- ~normal.behavior <- caret
- .select.left.jump
- .edit.paste.after

```
foo
   | 0
foo
bar
```
