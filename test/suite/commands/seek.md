# 1

```
abcabc
| 0
```

## 1 select-to-included
[up](#1)

- .seek { input: "c", include: true }

```
abcabc
^^^ 0
```

### 1 select-to-included select-to
[up](#1-select-to-included)

- .seek { input: "c" }

```
abcabc
   ^^ 0
```

### 1 select-to-included select-to-character
[up](#1-select-to-included)

> behavior <- character

- .seek { input: "c" }

```
abcabc
  ^^^ 0
```

## 1 select-to-c-2
[up](#1)

- .seek { input: "c", count: 2 }

```
abcabc
^^^^^ 0
```

### 1 select-to-c-2 select-to-c
[up](#1-select-to-c-2)

- .seek { input: "c", $expect: /^no selections remain$/ }

```
abcabc
^^^^^ 0
```

#### 1 select-to-c-2 select-to-c select-to-b-backward
[up](#1-select-to-c-2-select-to-c)

- .seek { input: "b", direction: -1 }

```
abcabc
     | 0
```

##### 1 select-to-c-2 select-to-c select-to-b-backward select-to-a-backward
[up](#1-select-to-c-2-select-to-c-select-to-b-backward)

- .seek { input: "a", direction: -1 }

```
abcabc
    ^ 0
```

### 1 select-to-c-2 select-to-c-character
[up](#1-select-to-c-2)

> behavior <- character

- .seek { input: "c", $expect: /^no selections remain$/ }

```
abcabc
^^^^^ 0
```

#### 1 select-to-c-2 select-to-c-character select-to-b-character
[up](#1-select-to-c-2-select-to-c-character)

- .seek { input: "b", direction: -1 }

```
abcabc
  |^^ 0
```

# 2

```
abcdefghijk
   ^^^^ 0
```

## 2 extend-to-e-included-backward
[up](#2)

- .seek { input: "e", direction: -1, shift: "extend", include: true }

```
abcdefghijk
   ^^ 0
```

## 2 extend-to-g-included-backward
[up](#2)

- .seek { input: "g", direction: -1, shift: "extend", include: true }

Selection left unchanged since it can't find another "g" before this.

```
abcdefghijk
   ^^^^ 0
```

## 2 extend-to-d-included-backward
[up](#2)

- .seek { input: "d", direction: -1, shift: "extend", include: true }

```
abcdefghijk
   ^ 0
```

## 2 extend-to-b-included-backward
[up](#2)

- .seek { input: "b", direction: -1, shift: "extend", include: true }

```
abcdefghijk
 |^ 0
```

## 2 extend-to-b-backward-character
[up](#2)

> behavior <- character

- .seek { input: "b", direction: -1, shift: "extend", include: true }

```
abcdefghijk
 |^^ 0
```

## 2 extend-to-g-backward
[up](#2)

- .seek { input: "g", direction: -1, shift: "extend" }

Selection left unchanged since it can't find another "g" before this.

```
abcdefghijk
   ^^^^ 0
```

## 2 extend-to-f-backward
[up](#2)

- .seek { input: "f", direction: -1, shift: "extend" }

```
abcdefghijk
   ^^^ 0
```

## 2 extend-to-e-backward
[up](#2)

- .seek { input: "e", direction: -1, shift: "extend" }

```
abcdefghijk
   ^^ 0
```

## 2 extend-to-c-backward
[up](#2)

- .seek { input: "c", direction: -1, shift: "extend" }

```
abcdefghijk
   | 0
```

## 2 extend-to-b-backward
[up](#2)

- .seek { input: "b", direction: -1, shift: "extend" }

```
abcdefghijk
  ^ 0
```

# 3

```
abc
def
ghi
 | 0
jkl
mno
```

## 3 select-to-line-end
[up](#3)

- .seek { input: "\n" }

```
abc
def
ghi
 ^^ 0
jkl
mno
```

## 3 select-to-line-end-included
[up](#3)

- .seek { input: "\n", include: true }

```
abc
def
ghi
 ^^^ 0
jkl
mno
```

# 4

```
abcabcde abcabcde
| 0
```

## 4 select-to-bc-excluded
[up](#4)

- .seek { input: "cd" }

```
abcabcde abcabcde
^^^^^ 0
```
### 4 select-to-bc-excluded select-to
[up](#4-select-to-bc-excluded)

- .seek { input: "cd" }

```
abcabcde abcabcde
     ^^^^^^^^^ 0
```

### 4 select-to-bc-excluded to-character
[up](#4-select-to-bc-excluded)

> behavior <- character

- .seek { input: "cd" }

```
abcabcde abcabcde
    ^^^^^^^^^^ 0
```

## 4 select-to-bc-excluded-count-2
[up](#4)
- .seek { input: "cd", count: 2 }

```
abcabcde abcabcde
^^^^^^^^^^^^^^ 0
```
