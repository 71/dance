# initial-1

```

^ 0
there are two blank lines before me
         ^ 0                       | 1
   some whitespaces around me    
                                ^ 1
and some more words
^^^^^^^^^^^^^ 2
finally a selection    
                    ^^^ 3
    that contains only whitespace
^^^| 3
```

# trim-whitespace-1
[up](#initial-1)

- .selections.trimWhitespace

```

there are two blank lines before me
^^^^^^^^^ 0
   some whitespaces around me    
   |^^^^^^^^^^^^^^^^^^^^^^^^^ 1
and some more words
^^^^^^^^^^^^^ 2
finally a selection    
    that contains only whitespace
```

# initial-2

```
hello
 ^ 0
world
my dear
 |^^^^^ 1
friends
```

# trim-2
[up](#initial-2)

- .selections.trimLines

Neither selection contains a full line but deleting both would eliminate all
selections. Thus leave everything unchanged.

```
hello
 ^ 0
world
my dear
 |^^^^^ 1
friends
```

# expand-2a
[up](#initial-2)

- .selections.expandToLines

```
hello
^^^^^^ 0
world
my dear
|^^^^^^^ 1
friends
```

# expand-2b
[up](#expand-2a)

- .selections.expandToLines

No changes, each selection is already a full line.

```
hello
^^^^^^ 0
world
my dear
|^^^^^^^ 1
friends
```

# initial-3

```
hello
 |^^^^ 0
world
^^ 0
my
  ^ 1
dear
^^^^^ 1
friends
^^^ 1
```

# expand-3
[up](#initial-3)

- .selections.expandToLines

Selection #1 is at document end since there is no trailing line break.
VS Code will take care of merging the two selections next.

```
hello
|^^^^^ 0
world
^^^^^^ 0
my
^^^ 1
dear
^^^^^ 1
friends
^^^^^^^^ 1
```

# trim-3
[up](#initial-3)

- .selections.trimLines

Old selection #0 disappears because it contains no full lines.

```
hello
world
my
dear
^^^^^ 0
friends
```
