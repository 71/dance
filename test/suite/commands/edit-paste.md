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

- .select.left.jump
- .edit.paste.after

```
foo
   | 0
foo
bar
```

# b-2
[up](#b-1)

- .select.left.extend { count: 2 }
- .selections.saveText
- .edit.paste.after

```
foooo
 ^^ 0
foo
bar
```
