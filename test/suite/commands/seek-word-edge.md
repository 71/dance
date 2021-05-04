# 1

```
the quick brown fox
|^ 0
```

## 1 word-start-backward
[up](#1)

- .seek.word.backward

No more selections remaining, just keep the last one.

```
the quick brown fox
|^ 0
```

## 1 word-start-4
[up](#1)

- .seek.word { count: 4 }

```
the quick brown fox
                ^^^ 0
```

### 1 word-start-4 word-start
[up](#1-word-start-4)

- .seek.word

No more selections remaining, just keep the last one.

```
the quick brown fox
                ^^^ 0
```

#### 1 word-start-4 word-start x
[up](#1-word-start-4-word-start)

- .seek.word

No more selections remaining, do not change.

```
the quick brown fox
                ^^^ 0
```

### 1 word-start-4 word-start-backward
[up](#1-word-start-4)

- .seek.word.backward

```
the quick brown fox
                |^^ 0
```

### 1 word-start-4 word-start-backward-2
[up](#1-word-start-4)

- .seek.word.backward { count: 2 }

```
the quick brown fox
          |^^^^^ 0
```

### 1 word-start-4 word-start-backward-5
[up](#1-word-start-4)

- .seek.word.backward { count: 5 }

Move 4 times, but don't move again (no more selections remaining otherwise).

```
the quick brown fox
|^^^ 0
```

## 1 word-start-5
[up](#1)

- .seek.word { count: 5 }

Move 4 times, but don't move again (no more selections remaining otherwise).

```
the quick brown fox
                ^^^ 0
```

# 2

```
foo bar
       ^ 0
baz
```

## 2 word-start-backward
[up](#2)

- .seek.word.backward

```
foo bar
    |^^ 0
baz
```

# 3

> behavior <- character

```
the quick brown fox
|^^^ 0
      |^ 1
```

## 3 word-start-backward
[up](#3)

- .seek.word.backward

Selection #0 overflowed and was removed. Selection #1 moved.

```
the quick brown fox
    |^^ 0
```

## 3 word-start-backward-9
[up](#3)

- .seek.word.backward { count: 9 }

Both overflowed and both falled back to the selection below.

```
the quick brown fox
|^^^ 0
```

## 3 word-end-4
[up](#3)

- .seek.wordEnd { count: 4 }

Selection #1 overflowed and was removed. Selection #0 moved.

```
the quick brown fox
               ^^^^ 0
```

## 3 word-end-5
[up](#3)

- .seek.wordEnd { count: 5 }

Both overflowed and both falled back to the selection below.

```
the quick brown fox
               ^^^^ 0
```

# 4

> behavior <- character

```

there is a blank line before me
|^^^^ 0
```

## 4 word-start-backward
[up](#4)

- .seek.word.backward

Special case in Kakoune: anchor is moved to beginning of document and active is
moved to the first character of the second line.

```

^ 0
there is a blank line before me
^ 0
```

### 4 word-start-backward x
[up](#4-word-start-backward)

- .seek.word.backward

Going to previous again will just keep the selection the same.

```

^ 0
there is a blank line before me
^ 0
```

## 4 word-start-backward-4
[up](#4)

- .seek.word.backward { count: 9 }

Similarly, more repetitions won't do anything either.

```

^ 0
there is a blank line before me
^ 0
```

# 5

> behavior <- character

```


there are two blank lines before me
|^^^^ 0
```

## 5 word-start-backward
[up](#5)

- .seek.word.backward

Special case in Kak: anchor is moved to beginning of document and active is
moved to the first character (line break in this case) of the second line.

```

^ 0

^ 0
there are two blank lines before me
```

### 5 word-start-backward x
[up](#5-word-start-backward)

- .seek.word.backward

Going to previous again will just keep the selection the same.

```

^ 0

^ 0
there are two blank lines before me
```

## 5 word-start-backward-9
[up](#5)

- .seek.word.backward { count: 9 }

```

^ 0

^ 0
there are two blank lines before me
```

TODO: Write tests for document with trailing empty lines.
