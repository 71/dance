# 1

> /\$object/\/[\p{L}]+(?<after>[^\S\n]+)\/u.source/g

```
hello world
  ^ 0
```

## 1 select-inner
[up](#1)

- .seek.object { input: $object, inner: true }
```
hello world
^^^^^ 0
```

### 1 select-inner x
[up](#1-select-inner)

- .seek.object { input: $object, inner: true }

```
hello world
^^^^^ 0
```
