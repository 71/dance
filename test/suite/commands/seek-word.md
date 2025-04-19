# 1

> behavior <- character

```
console.log()
^ 0
```

## 1 word-end
[up](#1)

- .seek.wordEnd

```
console.log()
^^^^^^^ 0
```

### 1 word-end x
[up](#1-word-end)

- .seek.wordEnd

```
console.log()
       ^ 0
```

#### 1 word-end x x
[up](#1-word-end-x)

- .seek.wordEnd

```
console.log()
        ^^^ 0
```

##### 1 word-end x x word-start-backward
[up](#1-word-end-x-x)

- .seek.word.backward

```
console.log()
        |^^ 0
```

###### 1 word-end x x word-start-backward x
[up](#1-word-end-x-x-word-start-backward)

- .seek.word.backward

```
console.log()
       ^ 0
```

###### 1 word-end x x word-start-backward x x
[up](#1-word-end-x-x-word-start-backward-x)

- .seek.word.backward

```
console.log()
|^^^^^^ 0
```

## 1 word-end-extend
[up](#1)

- .seek.wordEnd.extend

```
console.log()
^^^^^^^ 0
```

### 1 word-end-extend x
[up](#1-word-end-extend)

- .seek.wordEnd.extend

```
console.log()
^^^^^^^^ 0
```

#### 1 word-end-extend x x
[up](#1-word-end-extend-x)

- .seek.wordEnd.extend

```
console.log()
^^^^^^^^^^^ 0
```

#### 1 word-end-extend x word-end
[up](#1-word-end-extend-x)

- .seek.wordEnd

```
console.log()
        ^^^ 0
```

# 2

> behavior <- character

```
foo

bar
^ 0
```

## 2 word-start-backward
[up](#2)

- .seek.word.backward

```
foo
|^^ 0

bar
```

# 3

Now with spaces.

> behavior <- character

```
aaa bbb ccc ddd
      ^ 0
```

## 3 word-end
[up](#3)

- .seek.wordEnd

```
aaa bbb ccc ddd
       ^^^^ 0
```

### 3 word-end x
[up](#3-word-end)

- .seek.wordEnd

```
aaa bbb ccc ddd
           ^^^^ 0
```

#### 3 word-end x word-start-backward
[up](#3-word-end-x)

- .seek.word.backward

```
aaa bbb ccc ddd
            |^^ 0
```

#### 3 word-end x word-start-backward-2
[up](#3-word-end-x)

- .seek.word.backward { count: 2 }

```
aaa bbb ccc ddd
        |^^^ 0
```

# 4

```
aaa bbb
   ^ 0
  ccc
dd
```

## 4 word-start
[up](#4)

- .seek.word

```
aaa bbb
    ^^^ 0
  ccc
dd
```

### 4 word-start word-end
[up](#4-word-start)

- .seek.wordEnd

```
aaa bbb
  ccc
^^^^^ 0
dd
```

# 5

> behavior <- character

```
foo x bar.baz ex
^ 0
la
```

## 5 word-end
[up](#5)

- .seek.wordEnd

```
foo x bar.baz ex
^^^ 0
la
```

### 5 word-end x
[up](#5-word-end)

- .seek.wordEnd

```
foo x bar.baz ex
   ^^ 0
la
```

#### 5 word-end x x
[up](#5-word-end-x)

- .seek.wordEnd

```
foo x bar.baz ex
     ^^^^ 0
la
```

##### 5 word-end x x x
[up](#5-word-end-x-x)

- .seek.wordEnd

```
foo x bar.baz ex
         ^ 0
la
```

# 6

> behavior <- character

```
a b c d
  ^ 0
```

## 6 word-end
[up](#6)

- .seek.wordEnd

```
a b c d
   ^^ 0
```

## 6 word-start
[up](#6)

- .seek.word

```
a b c d
   ^ 0
```

## 6 word-start-backward
[up](#6)

- .seek.word.backward

```
a b c d
|^ 0
```

## 6 word-end-extend
[up](#6)

- .seek.wordEnd.extend

```
a b c d
  ^^^ 0
```

## 6 word-start-extend
[up](#6)

- .seek.word.extend

```
a b c d
  ^^ 0
```

## 6 word-start-extend-backward
[up](#6)

- .seek.word.extend.backward

```
a b c d
|^^ 0
```

# 7

> behavior <- character

```
aaa bbb ccc ddd
        ^^^^^^^ 0
```

## 7 two-words-extend-backward
[up](#7)

- .seek.word.extend.backward

```
aaa bbb ccc ddd
        ^^^^  0
```
