# initial-easy

```
foo bar
  ^ 0
```

# search-easy
[up](#initial-easy)

- .search { input: "b" }

```
foo bar
    ^ 0
```

# initial-1

```
The quick brown fox
  ^^^ 0
jumps over the
lazy dog quickly.
```

# search-1
[up](#initial-1)

- .search { input: "brown" }

```
The quick brown fox
          ^^^^^ 0
jumps over the
lazy dog quickly.
```

# search-repeat-1
[up](#initial-1)

- .search { input: "o", count: 2 }

```
The quick brown fox
                 ^ 0
jumps over the
lazy dog quickly.
```

# search-start-1
[up](#initial-1)

- .search { input: "quick" }

Search starts **after** the selection so the first "quick" is not matched.

```
The quick brown fox
jumps over the
lazy dog quickly.
         ^^^^^ 0
```

# search-start-wrap-1
[up](#initial-1)

- .search { input: "quick " }

Search starts **after** the selection, but wraps over to find "quick ".

```
The quick brown fox
    ^^^^^^ 0
jumps over the
lazy dog quickly.
```

# search-wrap-1
[up](#initial-1)

- .search { input: "Th" }

```
The quick brown fox
^^ 0
jumps over the
lazy dog quickly.
```

# search-not-found-1
[up](#initial-1)

- .search { input: "pig" }

No matches found. Selection is left untouched because otherwise there would be
no selection left.

```
The quick brown fox
  ^^^ 0
jumps over the
lazy dog quickly.
```

# search-backward-1
[up](#initial-1)

- .search { input: "Th", direction: -1 }

Note: Selection always faces forward (except when extending).

```
The quick brown fox
^^ 0
jumps over the
lazy dog quickly.
```

# search-backward-start-wrap-1a
[up](#initial-1)

- .search { input: "he", direction: -1 }

Search starts **before** the selection and wraps around to find the last "he".

```
The quick brown fox
jumps over the
            ^^ 0
lazy dog quickly.
```

# search-backward-start-wrap-1b
[up](#initial-1)

- .search { input: "he q", direction: -1 }

Search starts **before** the selection "q" but wraps around to find "he q".

```
The quick brown fox
 ^^^^ 0
jumps over the
lazy dog quickly.
```

# search-backward-not-found-1
[up](#initial-1)

- .search { input: "pig", direction: -1 }

No matches found. Selection is left untouched because otherwise there would be
no selection left.

```
The quick brown fox
  ^^^ 0
jumps over the
lazy dog quickly.
```

# search-extend-1
[up](#initial-1)

- .search { input: "quick", shift: "extend" }

```
The quick brown fox
  ^ 0
jumps over the
lazy dog quickly.
             ^ 0
```

# search-extend-wrap-1
[up](#initial-1)

- .search { input: "T", shift: "extend" }

When extending, a selection is deleted if it would require wrapping to find the
next match. In this case, the (only) main selection is left untouched because
otherwise there would be no selection left.

```
The quick brown fox
  ^^^ 0
jumps over the
lazy dog quickly.
```

# search-backward-extend-1a
[up](#initial-1)

- .search { input: "T", direction: -1, shift: "extend" }

When extending, the resulting selection may face backward.

```
The quick brown fox
|^ 0
jumps over the
lazy dog quickly.
```

# search-backward-extend-character-1a
[up](#initial-1)

> behavior <- character

- .search { input: "T", direction: -1, shift: "extend" }

Note: "e" is included in character-selections because it is the anchor.

```
The quick brown fox
|^^ 0
jumps over the
lazy dog quickly.
```

# search-backward-extend-1b
[up](#initial-1)

- .search { input: "Th", direction: -1, shift: "extend" }

When extending, the resulting selection may face backward.

```
The quick brown fox
|^ 0
jumps over the
lazy dog quickly.
```

# search-backward-extend-character-1b
[up](#initial-1)

> behavior <- character

- .search { input: "Th", direction: -1, shift: "extend" }

Note: "e" is included in character-selections because it is the anchor.

```
The quick brown fox
|^^ 0
jumps over the
lazy dog quickly.
```

# search-backward-extend-wrap-1
[up](#initial-1)

- .search { input: "lazy", direction: -1, shift: "extend" }

When extending, a selection is deleted if it would require wrapping to find the
next match. In this case, the (only) main selection is left untouched because
otherwise there would be no selection left.

```
The quick brown fox
  ^^^ 0
jumps over the
lazy dog quickly.
```

# initial-2
Remember that the search will start at the start or end of the selection, so
anything that is (partially) covered by the current selection cannot be
found without wrapping first. The following cases show some consequences.

```
The quick brown fox
           | 0
jumps over the
lazy dog quickly.
  ^ 0
```

# search-2
[up](#initial-2)

- .search { input: "o" }

Forward search starts at "y" and finds "d**o**g" instead of "br**o**wn".

```
The quick brown fox
jumps over the
lazy dog quickly.
      ^ 0
```

# search-extend-2
[up](#initial-2)

- .search { input: "o", shift: "extend" }

Same, but extends instead of jumping.

```
The quick brown fox
jumps over the
lazy dog quickly.
   ^^^^ 0
```

# search-extend-character-2
[up](#initial-2)

> behavior <- character

- .search { input: "o", shift: "extend" }

Same, but extends instead of jumping.

```
The quick brown fox
jumps over the
lazy dog quickly.
  ^^^^^ 0
```

# search-wrap-2
[up](#initial-2)

- .search { input: "he" }

Forward search starts at "y" and wraps to "T**he**" instead of "t**he**".

```
The quick brown fox
 |^ 0
jumps over the
lazy dog quickly.
```

# search-extend-wrap-2
[up](#initial-2)

- .search { input: "he", shift: "extend" }

When extending, Dance should not wrap around document edges to find "T**he**".
"t**he**" is not considered at all. No-op due to no selections remaining.

```
The quick brown fox
           | 0
jumps over the
lazy dog quickly.
  ^ 0
```

# search-backward-2
[up](#initial-2)

- .search { input: "u", direction: -1 }

Backward search starts at "b" and finds "q**u**ick" instead of "j**u**mps".

```
The quick brown fox
     ^ 0
jumps over the
lazy dog quickly.
```

# search-backward-extend-2
[up](#initial-2)

- .search { input: "u", direction: -1, shift: "extend" }

Same, but extends instead of jumping.

```
The quick brown fox
     | 0
jumps over the
lazy dog quickly.
  ^ 0
```

# search-backward-wrap-2
[up](#initial-2)

- .search { input: "o", direction: -1 }

Backward search starts at "b" and wraps to "d**o**g" instead of "br**o**wn".

```
The quick brown fox
jumps over the
lazy dog quickly.
      ^ 0
```

# search-backward-extend-wrap-2
[up](#initial-2)

- .search { input: "o", direction: -1, shift: "extend" }

When extending, Dance should not wrap around document edges to find "d**o**g".
"br**o**wn" is not considered at all. No-op due to no selections remaining.

```
The quick brown fox
           | 0
jumps over the
lazy dog quickly.
  ^ 0
```
