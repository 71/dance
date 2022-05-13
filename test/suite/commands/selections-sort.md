# 1

```
z
^ 0
 y
 ^ 2
  x
  ^ 1
```

## 1 sort-by-content
[up](#1)

- .selections.sort { expression: "$" }

```
z
^ 2
 y
 ^ 1
  x
  ^ 0
```

## 1 sort-by-content-desc
[up](#1)

- .selections.sort { expression: "$", direction: -1 }

```
z
^ 0
 y
 ^ 1
  x
  ^ 2
```

## 1 sort-by-position-with-priority-for-y
[up](#1)

Note that this example is fairly bad, as `Selections.toString` shouldn't be used
to sort positions with multiple digits; for sorting purposes,
`.selections.changeOrder` should be used.

- .selections.sort { expression: "($ === 'y' ? ' ' : '') + Selections.toString(Selections.nth(i))" }

```
z
^ 1
 y
 ^ 0
  x
  ^ 2
```
