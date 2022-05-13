# 1

```
foo
 ^ 0
bar
 ^ 1
quux
 ^ 2
   ^ 3
```

## 1 change-order
[up](#1)

- .selections.changeOrder

```
foo
 ^ 3
bar
 ^ 2
quux
 ^ 1
   ^ 0
```

## 1 order-desc
[up](#1)

- .selections.changeOrder { direction: 1 }

```
foo
 ^ 0
bar
 ^ 1
quux
 ^ 2
   ^ 3
```

## 1 order-asc
[up](#1)

- .selections.changeOrder { direction: -1 }

```
foo
 ^ 3
bar
 ^ 2
quux
 ^ 1
   ^ 0
```

# 2

Same as [#1](#1), but with selections not initially ordered.

```
foo
 ^ 0
bar
 ^ 2
quux
 ^ 1
   ^ 3
```

## 2 change-order
[up](#2)

- .selections.changeOrder

```
foo
 ^ 3
bar
 ^ 1
quux
 ^ 2
   ^ 0
```
