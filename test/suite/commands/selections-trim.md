# 1

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

## 1 trim-whitespace
[up](#1)

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

# 2

```
hello
 ^ 0
world
my dear
 |^^^^^ 1
friends
```

## 2 trim
[up](#2)

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

## 2 expand
[up](#2)

- .selections.expandToLines

```
hello
^^^^^^ 0
world
my dear
|^^^^^^^ 1
friends
```

### 2 expand x
[up](#2-expand)

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

# 3

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

## 3 expand
[up](#3)

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

## 3 trim
[up](#3)

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
