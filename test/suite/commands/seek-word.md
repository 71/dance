# initial-1

> behavior <- character

```
console.log()
^ 0
```

# word-end-1a
[up](#initial-1)

- .seek.wordEnd

```
console.log()
^^^^^^^ 0
```

# word-end-extend-1a
[up](#initial-1)

- .seek.wordEnd.extend

```
console.log()
^^^^^^^ 0
```

# word-end-1b
[up](#word-end-1a)

- .seek.wordEnd

```
console.log()
       ^ 0
```

# word-end-extend-1b
[up](#word-end-extend-1a)

- .seek.wordEnd.extend

```
console.log()
^^^^^^^^ 0
```

# word-end-1c
[up](#word-end-1b)

- .seek.wordEnd

```
console.log()
        ^^^ 0
```

# word-end-extend-1c
[up](#word-end-extend-1b)

- .seek.wordEnd.extend

```
console.log()
^^^^^^^^^^^ 0
```

# word-end-extend-1b-word-end
[up](#word-end-extend-1b)

- .seek.wordEnd

```
console.log()
        ^^^ 0
```

# word-end-1c-start-a
[up](#word-end-1c)

- .seek.word.backward

```
console.log()
        |^^ 0
```

# word-end-1c-start-b
[up](#word-end-1c-start-a)

- .seek.word.backward

```
console.log()
       ^ 0
```

# word-end-1c-start-c
[up](#word-end-1c-start-b)

- .seek.word.backward

```
console.log()
|^^^^^^ 0
```

# initial-2

> behavior <- character

```
foo

bar
^ 0
```

# word-start-backward-2
[up](#initial-2)

- .seek.word.backward

```
foo
|^^ 0

bar
```

# initial-3

Now with spaces.

> behavior <- character

```
aaa bbb ccc ddd
      ^ 0
```

# word-end-3a
[up](#initial-3)

- .seek.wordEnd

```
aaa bbb ccc ddd
       ^^^^ 0
```

# word-end-3b
[up](#word-end-3a)

- .seek.wordEnd

```
aaa bbb ccc ddd
           ^^^^ 0
```

# word-end-3b-previous
[up](#word-end-3b)

- .seek.word.backward

```
aaa bbb ccc ddd
            |^^ 0
```

# word-end-3b-previous-with-count
[up](#word-end-3b)

- .seek.word.backward { count: 2 }

```
aaa bbb ccc ddd
        |^^^ 0
```

# initial-4

```
aaa bbb
   ^ 0
  ccc
dd
```

# word-start-4a
[up](#initial-4)

- .seek.word

```
aaa bbb
    ^^^ 0
  ccc
dd
```

# word-start-4b
[up](#word-start-4a)

- .seek.wordEnd

```
aaa bbb
  ccc
^^^^^ 0
dd
```

# initial-5

> behavior <- character

```
foo x bar.baz ex
^ 0
la
```

# word-end-5a
[up](#initial-5)

- .seek.wordEnd

```
foo x bar.baz ex
^^^ 0
la
```

# word-end-5b
[up](#word-end-5a)

- .seek.wordEnd

```
foo x bar.baz ex
   ^^ 0
la
```

# word-end-5c
[up](#word-end-5b)

- .seek.wordEnd

```
foo x bar.baz ex
     ^^^^ 0
la
```

# word-end-5d
[up](#word-end-5c)

- .seek.wordEnd

```
foo x bar.baz ex
         ^ 0
la
```

# initial-6

> behavior <- character

```
a b c d
  ^ 0
```

# word-end-6
[up](#initial-6)

- .seek.wordEnd

```
a b c d
   ^^ 0
```

# word-start-6
[up](#initial-6)

- .seek.word

```
a b c d
   ^^ 0
```

# word-start-backward-6
[up](#initial-6)

- .seek.word.backward

```
a b c d
|^ 0
```

# word-end-extend-6
[up](#initial-6)

- .seek.wordEnd.extend

```
a b c d
  ^^^ 0
```

# word-start-extend-6
[up](#initial-6)

- .seek.word.extend

```
a b c d
  ^^ 0
```

# word-start-extend-backward-6
[up](#initial-6)

- .seek.word.extend.backward

```
a b c d
|^^ 0
```
