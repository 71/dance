# 1

```
{0}f|{0}oo{1}
|{1}bar{2}
|{2}{3}
|{3}{4}b|{4}az

{5}
|{5}

qux
```

## 1 to-start
[up](#1)

- .seek.object { "object": "paragraph", "action": "selectToStart" }

Selection #4 skipped to first sentence start because it was active at the very
beginning of next sentence. Notice how anchor is moved.
Similarly, selection #5 re-anchored to one line above and then selected last.

```
{0}|{1}|{2}|{3}|{4}f|{0}oo
{1}bar
{2}
{3}{4}|{5}baz

{5}


qux
```

## 1 to-end
[up](#1)

- .seek.object { "object": "paragraph", "action": "selectToEnd" }

Paragraph outer end includes all trailing line breaks.
If a selection is on an empty line, it is always reanchored to the next line.

```
{0}foo{1}
bar{2}

|{0}|{1}|{2}{3}{4}baz


{5}

|{3}|{4}|{5}qux
```

## 1 to-end-inner
[up](#1)

- .seek.object { "object": "paragraph", "action": "selectToEnd", "inner": true }

Paragraph inner end does not include blank lines (but includes the last line
break before blank lines). Special cases are same as above.

```
{0}foo{1}
bar{2}
|{0}|{1}|{2}
{3}{4}baz
|{3}|{4}

{5}
|{5}
qux
```

## 1 select
[up](#1)

- .seek.object { "object": "paragraph", "action": "select" }

Do not skip over the current character when finding paragraph start.

```
{0}{1}{2}foo
bar

|{0}|{1}|{2}{3}{4}{5}baz




|{3}|{4}|{5}qux
```

# 2

Special cases regarding blank lines and next paragraph.

```
paragraph 1{0}
|{0}{1}
|{1}{2}
|{2}{3}
|{3}{4}
|{4}paragraph 2
```

## 2 select
[up](#2)

- .seek.object { "object": "paragraph", "action": "select", "inner": true }

The only special case for select: when active line is blank and the next line
is not, select the **next** paragraph instead. This applied to selection #4.
Note that it only looks one line ahead, so selections #0-3 were not affected.

```
{0}{1}{2}{3}paragraph 1
|{0}|{1}|{2}|{3}|{3}



{4}paragraph 2|{4}
```

## 2 to-end-inner
[up](#2)

- .seek.object { "object": "paragraph", "action": "selectToEnd", "inner": true }

In Kakoune, if a selection is on an empty line (L), it always reanchor to the
start of the next line (L+1). Then if L+1 is non-empty or L+2 is non-empty,
it selects to the end of the paragraph (applied to selections #3 and #4 here).
Selections #1-3 were only reanchored. Selection #0 was at the end of 1st line.

```
paragraph 1{0}
|{0}
{1}
|{1}{2}
|{2}{3}
{4}paragraph 2|{4}|{3}
```
