# initial-1

```
the quick brown fox
          ^^^ 0
```

# line-start-1
[up](#initial-1)

- .select.lineStart

```
the quick brown fox
|^^^^^^^^^^^^ 0
```

# line-start-extend-1
[up](#initial-1)

- .select.lineStart.extend

```
the quick brown fox
|^^^^^^^^^ 0
```

# line-start-extend-character-1
[up](#initial-1)

> behavior <- character

- .select.lineStart.extend

```
the quick brown fox
|^^^^^^^^^^ 0
```

# line-end-1
[up](#initial-1)

- .select.lineEnd

```
the quick brown fox
             ^^^^^^ 0
```

# line-end-character-1
[up](#initial-1)

> behavior <- character

- .select.lineEnd

```
the quick brown fox
            ^^^^^^^ 0
```

# line-end-extend-1
[up](#initial-1)

- .select.lineEnd.extend

```
the quick brown fox
          ^^^^^^^^^ 0
```
