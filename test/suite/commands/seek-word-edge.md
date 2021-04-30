# 1

```
|{0}th{0}e quick brown fox
```

## 1 word-start-backward
[up](#1)

- .seek.word.backward

No more selections remaining, just keep the last one.

```
|{0}th{0}e quick brown fox
```

## 1 word-start-4
[up](#1)

- .seek.word { count: 4 }

```
the quick brown {0}fox|{0}
```

### 1 word-start-4 word-start
[up](#1-word-start-4)

- .seek.word

No more selections remaining, just keep the last one.

```
the quick brown {0}fox|{0}
```

#### 1 word-start-4 word-start x
[up](#1-word-start-4-word-start)

- .seek.word

No more selections remaining, do not change.

```
the quick brown {0}fox|{0}
```

### 1 word-start-4 word-start-backward-4
[up](#1-word-start-4)

- .seek.word.backward { count: 4 }

```
|{0}the {0}quick brown fox
```

### 1 word-start-4 word-start-backward-5
[up](#1-word-start-4)

- .seek.word.backward { count: 5 }

Move 4 times, but don't move again (no more selections remaining otherwise).

```
|{0}the {0}quick brown fox
```

## 1 word-start-5
[up](#1)

- .seek.word { count: 5 }

Move 4 times, but don't move again (no more selections remaining otherwise).

```
the quick brown {0}fox|{0}
```

# 2

```
foo bar{0}
|{0}baz
```

## 2 word-start-backward
[up](#2)

- .seek.word.backward

```
foo |{0}bar{0}
baz
```

# 3

```
|{0}the {0}qu|{1}ic{1}k brown fox
```

## 3 word-start-backward
[up](#3)

- .seek.word.backward

Old Selection 0 overflowed and was removed. Old Selection 1 moved.

```
the |{0}qui{0}ck brown fox
```

## 3 word-start-backward-9
[up](#3)

- .seek.word.backward { count: 9 }

Both overflowed and both falled back to the selection below.
VS Code will then automatically merge the two selections since they overlap.

```
|{0}|{1}the {0}{1}quick brown fox
```

## 3 word-end-4
[up](#3)

- .seek.wordEnd { count: 4 }

Old Selection 1 overflowed and was removed. Old Selection 0 moved.

```
the quick brown{0} fox|{0}
```

## 3 word-end-5
[up](#3)

- .seek.wordEnd { count: 5 }

Both overflowed and both falled back to the selection below.
VS Code will then automatically merge the two selections since they overlap.

```
the quick brown{0}{1} fox|{0}|{1}
```

# 4

```

|{0}there{0} is a blank line before me
```

## 4 word-start-backward
[up](#4)

- .seek.word.backward

Special case in Kakoune: anchor is moved to beginning of document and active is
moved to the first character of the second line.

```
{0}
t|{0}here is a blank line before me
```

### 4 word-start-backward x
[up](#4-word-start-backward)

- .seek.word.backward

Going to previous again will just keep the selection the same.

```
{0}
t|{0}here is a blank line before me
```

## 4 word-start-backward-4
[up](#4)

- .seek.word.backward { count: 9 }

Similarly, more repetitions won't do anything either.

```
{0}
t|{0}here is a blank line before me
```

# 5

```


|{0}there{0} are two blank lines before me
```

## 5 word-start-backward
[up](#5)

- .seek.word.backward

Special case in Kak: anchor is moved to beginning of document and active is
moved to the first character (line break in this case) of the second line.

```
{0}

|{0}there are two blank lines before me
```

### 5 word-start-backward x
[up](#5-word-start-backward)

- .seek.word.backward

Going to previous again will just keep the selection the same.

```
{0}

|{0}there are two blank lines before me
```

## 5 word-start-backward-9
[up](#5)

- .seek.word.backward { count: 9 }

```
{0}

|{0}there are two blank lines before me
```

TODO: Write tests for document with trailing empty lines.
