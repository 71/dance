# 1

```
a b c d
^^^^^ 0
```

## 1 pipe-replace-with-regexp
[up](#1)

- .selections.pipe.replace { input: String.raw`/\s/-/g` }

```
a-b-c d
^^^^^ 0
```

## 1 pipe-replace-with-regexp-newline
[up](#1)

- .selections.pipe.replace { input: String.raw`/\s/\n/g` }

```
a
^^ 0
b
^^ 0
c d
^ 0
```

## 1 pipe-replace-with-regexp-backslash-n
[up](#1)

- .selections.pipe.replace { input: String.raw`/\s/\\n/g` }

```
a\nb\nc d
^^^^^^^ 0
```

## 1 pipe-replace-with-regexp-backslash-newline
[up](#1)

- .selections.pipe.replace { input: String.raw`/\s/\\\n/g` }

```
a\
^^^ 0
b\
^^^ 0
c d
^ 0
```

## 1 pipe-replace-with-js
[up](#1)

- .selections.pipe.replace { input: String.raw`$.replace(/\s/g, "-")` }

```
a-b-c d
^^^^^ 0
```

## 1 pipe-replace-with-js-newline
[up](#1)

- .selections.pipe.replace { input: String.raw`$.replace(/\s/g, "\n")` }

```
a
^^ 0
b
^^ 0
c d
^ 0
```
