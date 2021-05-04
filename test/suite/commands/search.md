# easy

```
foo bar
  ^ 0
```

## easy search-b
[up](#easy)

- .search { input: "b" }

```
foo bar
    ^ 0
```

# 1

```
The quick brown fox
  ^^^ 0
jumps over the
lazy dog quickly.
```

## 1 search
[up](#1)

- .search { input: "brown" }

```
The quick brown fox
          ^^^^^ 0
jumps over the
lazy dog quickly.
```

## 1 search-repeat
[up](#1)

- .search { input: "o", count: 2 }

```
The quick brown fox
                 ^ 0
jumps over the
lazy dog quickly.
```

## 1 search-start
[up](#1)

- .search { input: "quick" }

Search starts **after** the selection so the first "quick" is not matched.

```
The quick brown fox
jumps over the
lazy dog quickly.
         ^^^^^ 0
```

## 1 search-start-wrap
[up](#1)

- .search { input: "quick " }

Search starts **after** the selection, but wraps over to find "quick ".

```
The quick brown fox
    ^^^^^^ 0
jumps over the
lazy dog quickly.
```

## 1 search-wrap
[up](#1)

- .search { input: "Th" }

```
The quick brown fox
^^ 0
jumps over the
lazy dog quickly.
```

## 1 search-not-found
[up](#1)

- .search { input: "pig", $expect: /^no selections remain$/ }

No matches found. Selection is left untouched because otherwise there would be
no selection left.

```
The quick brown fox
  ^^^ 0
jumps over the
lazy dog quickly.
```

## 1 search-backward
[up](#1)

- .search { input: "Th", direction: -1 }

Note: Selection always faces forward (except when extending).

```
The quick brown fox
^^ 0
jumps over the
lazy dog quickly.
```

## 1 search-backward-wrap
[up](#1)

- .search { input: "he", direction: -1 }

Search starts **before** the selection and wraps around to find the last "he".

```
The quick brown fox
jumps over the
            ^^ 0
lazy dog quickly.
```

## 1 search-backward-wrap-other
[up](#1)

- .search { input: "he q", direction: -1 }

Search starts **before** the selection "q" but wraps around to find "he q".

```
The quick brown fox
 ^^^^ 0
jumps over the
lazy dog quickly.
```

## 1 search-backward-not-found
[up](#1)

- .search { input: "pig", direction: -1, $expect: /^no selections remain$/ }

No matches found. Selection is left untouched because otherwise there would be
no selection left.

```
The quick brown fox
  ^^^ 0
jumps over the
lazy dog quickly.
```

## 1 search-extend
[up](#1)

- .search { input: "quick", shift: "extend" }

```
The quick brown fox
  ^ 0
jumps over the
lazy dog quickly.
             ^ 0
```

## 1 search-extend-wrap
[up](#1)

- .search { input: "T", shift: "extend", $expect: /^no selections remain$/ }

When extending, a selection is deleted if it would require wrapping to find the
next match. In this case, the (only) main selection is left untouched because
otherwise there would be no selection left.

```
The quick brown fox
  ^^^ 0
jumps over the
lazy dog quickly.
```

## 1 search-backward-extend
[up](#1)

- .search { input: "T", direction: -1, shift: "extend" }

When extending, the resulting selection may face backward.

```
The quick brown fox
|^ 0
jumps over the
lazy dog quickly.
```

## 1 search-backward-extend-character
[up](#1)

> behavior <- character

- .search { input: "T", direction: -1, shift: "extend" }

Note: "e" is included in character-selections because it is the anchor.

```
The quick brown fox
|^^ 0
jumps over the
lazy dog quickly.
```

## 1 search-backward-extend-other
[up](#1)

- .search { input: "Th", direction: -1, shift: "extend" }

When extending, the resulting selection may face backward.

```
The quick brown fox
|^ 0
jumps over the
lazy dog quickly.
```

## 1 search-backward-extend-character-other
[up](#1)

> behavior <- character

- .search { input: "Th", direction: -1, shift: "extend" }

Note: "e" is included in character-selections because it is the anchor.

```
The quick brown fox
|^^ 0
jumps over the
lazy dog quickly.
```

## 1 search-backward-extend-wrap
[up](#1)

- .search { input: "lazy", direction: -1, shift: "extend", $expect: /^no selections remain$/ }

When extending, a selection is deleted if it would require wrapping to find the
next match. In this case, the (only) main selection is left untouched because
otherwise there would be no selection left.

```
The quick brown fox
  ^^^ 0
jumps over the
lazy dog quickly.
```

# 2
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

## 2 search
[up](#2)

- .search { input: "o" }

Forward search starts at "y" and finds "d**o**g" instead of "br**o**wn".

```
The quick brown fox
jumps over the
lazy dog quickly.
      ^ 0
```

## 2 search-extend
[up](#2)

- .search { input: "o", shift: "extend" }

Same, but extends instead of jumping.

```
The quick brown fox
jumps over the
lazy dog quickly.
   ^^^^ 0
```

## 2 search-extend-character
[up](#2)

> behavior <- character

- .search { input: "o", shift: "extend" }

Same, but extends instead of jumping.

```
The quick brown fox
jumps over the
lazy dog quickly.
  ^^^^^ 0
```

## 2 search-wrap
[up](#2)

- .search { input: "he" }

Forward search starts at "y" and wraps to "T**he**" instead of "t**he**".

```
The quick brown fox
 |^ 0
jumps over the
lazy dog quickly.
```

## 2 search-extend-wrap
[up](#2)

- .search { input: "he", shift: "extend", $expect: /^no selections remain$/ }

When extending, Dance should not wrap around document edges to find "T**he**".
"t**he**" is not considered at all. No-op due to no selections remaining.

```
The quick brown fox
           | 0
jumps over the
lazy dog quickly.
  ^ 0
```

## 2 search-backward
[up](#2)

- .search { input: "u", direction: -1 }

Backward search starts at "b" and finds "q**u**ick" instead of "j**u**mps".

```
The quick brown fox
     ^ 0
jumps over the
lazy dog quickly.
```

## 2 search-backward-extend
[up](#2)

- .search { input: "u", direction: -1, shift: "extend" }

Same, but extends instead of jumping.

```
The quick brown fox
     | 0
jumps over the
lazy dog quickly.
  ^ 0
```

## 2 search-backward-wrap
[up](#2)

- .search { input: "o", direction: -1 }

Backward search starts at "b" and wraps to "d**o**g" instead of "br**o**wn".

```
The quick brown fox
jumps over the
lazy dog quickly.
      ^ 0
```

## 2 search-backward-extend-wrap
[up](#2)

- .search { input: "o", direction: -1, shift: "extend", $expect: /^no selections remain$/ }

When extending, Dance should not wrap around document edges to find "d**o**g".
"br**o**wn" is not considered at all. No-op due to no selections remaining.

```
The quick brown fox
           | 0
jumps over the
lazy dog quickly.
  ^ 0
```
