# 1

> /\$object/"(?#predefined=paragraph)"/g

```
foo
| 0
   ^ 1
bar
   ^ 2

^ 3
baz
^ 4


^ 5


qux
```

## 1 to-start
[up](#1)

- .seek.object { input: $object, where: "start" }

Selection #4 skipped to first sentence start because it was active at the very
beginning of next sentence. Notice how anchor is moved.
Similarly, selection #5 re-anchored to one line above and then selected last.

```
foo
^^^^ 0
bar
^^^^ 0

^ 0
baz
|^^^ 1

^ 1

^ 1


qux
```

## 1 to-end
[up](#1)

- .seek.object { input: $object, where: "end" }

Paragraph outer end includes all trailing line breaks.
If a selection is on an empty line, it is always re-anchored to the next line.

```
foo
^^^^ 0
bar
^^^^ 0

^ 0
baz
^^^^ 1

^ 1

^ 1

^ 1

^ 1
qux
```

## 1 to-end-inner
[up](#1)

> behavior <- character

- .seek.object { input: $object, where: "end", inner: true }

Paragraph inner end does not include blank lines (but includes the last line
break before blank lines). Special cases are same as above.

```
foo
^^^^ 0
bar
^^^^ 0

^ 1
baz
^^^^ 1


^ 2


qux
```

## 1 select
[up](#1)

- .seek.object { input: $object }

Do not skip over the current character when finding paragraph start.

```
foo
^^^^ 0
bar
^^^^ 0

^ 0
baz
^^^^ 1

^ 1

^ 1

^ 1

^ 1
qux
```

# 2

Special cases regarding blank lines and next paragraph.

> /\$object/"(?#predefined=paragraph)"/g

```
paragraph 1
^^^^^^^^^^^^ 0

^ 1

^ 2

^ 3

^ 4
paragraph 2
```

## 2 select
[up](#2)

- .seek.object { input: $object, inner: true }

The only special case for select: when active line is blank and the next line
is not, select the **next** paragraph instead. This applied to selection #4.
Note that it only looks one line ahead, so selections #0-3 were not affected.

```
paragraph 1
^^^^^^^^^^^^ 0




paragraph 2
^^^^^^^^^^^ 1
```

## 2 to-end-inner
[up](#2)

> behavior <- character

- .seek.object { input: $object, where: "end", inner: true }

In Kakoune, if a selection is on an empty line (L), it always re-anchors to the
start of the next line (L+1). Then if L+1 is non-empty or L+2 is non-empty,
it selects to the end of the paragraph (applied to selections #3 and #4 here).
Selections #1-3 were only reanchored. Selection #0 was at the end of 1st line.

```
paragraph 1
           ^ 0

^ 1

^ 2

^ 3

^ 4
paragraph 2
^^^^^^^^^^^ 4
```

# 3

> /\$object/"(?#predefined=paragraph)"/g

Seeking to paragraph start multiple times should select previous paragraph.

```
this is the first
paragraph.

this is the second paragraph.
             | 0
```

## 3 to-start
[up](#3)

- .seek.object { input: $object, where: "start" }

```
this is the first
paragraph.

this is the second paragraph.
|^^^^^^^^^^^^ 0
```

### 3 to-start x
[up](#3-to-start)

- .seek.object { input: $object, where: "start" }

```
this is the first
|^^^^^^^^^^^^^^^^^ 0
paragraph.
^^^^^^^^^^^ 0

^ 0
this is the second paragraph.
```

#### 3 to-start x x
[up](#3-to-start-x)

- .seek.object { input: $object, where: "start" }

```
this is the first
| 0
paragraph.

this is the second paragraph.
```
