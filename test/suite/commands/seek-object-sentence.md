# 1

> /\$object/"(?#predefined=sentence)"/g

```
A sentence starts with a non-blank character or a line break. <== It ends with a
^ 0
punctuation mark like the previous one, or two consecutive line breaks like this
                                   ^ 1

An outer sentence also contains the trailing blank characters (but never line
|^^^^^^^^^^^^^^^^ 2
breaks) like this.       <== The white spaces before this sentence belongs to
                     ^ 3
the outer previous sentence.
                 ^ 4
   <- White spaces here and the line break before them belongs to this sentence,
      |^^^^^^^^^^^^^^^^^^^^^ 5
not the previous one, since the previous trailing cannot contain line breaks.
```

## 1 to-end
[up](#1)

- .seek.object { input: $object, where: "end" }

```
A sentence starts with a non-blank character or a line break. <== It ends with a
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
punctuation mark like the previous one, or two consecutive line breaks like this
                                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 1

An outer sentence also contains the trailing blank characters (but never line
^ 2
breaks) like this.       <== The white spaces before this sentence belongs to
the outer previous sentence.
                           ^ 2
   <- White spaces here and the line break before them belongs to this sentence,
      ^ 5
not the previous one, since the previous trailing cannot contain line breaks.
                                                                            ^ 5
```

## 1 to-start
[up](#1)

- .seek.object { input: $object, where: "start" }

```
A sentence starts with a non-blank character or a line break. <== It ends with a
^ 0                                                           |^^^^^^^^^^^^^^^^^^ 1
punctuation mark like the previous one, or two consecutive line breaks like this
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 1

An outer sentence also contains the trailing blank characters (but never line
|^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 3
breaks) like this.       <== The white spaces before this sentence belongs to
^^^^^^^^^^^^^^^^^^ 3     |^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 4
the outer previous sentence.
^^^^^^^^^^^^^^^^^^ 4        | 5
   <- White spaces here and the line break before them belongs to this sentence,
^^^^^^^ 5
not the previous one, since the previous trailing cannot contain line breaks.
```

## 1 select-inner
[up](#1)

- .seek.object { input: $object, inner: true }

```
A sentence starts with a non-blank character or a line break. <== It ends with a
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
                                                              ^^^^^^^^^^^^^^^^^^^ 1
punctuation mark like the previous one, or two consecutive line breaks like this
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 1

An outer sentence also contains the trailing blank characters (but never line
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 2
breaks) like this.       <== The white spaces before this sentence belongs to
^^^^^^^^^^^^^^^^^^ 2     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 4
the outer previous sentence.
^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 4
                            ^ 5
   <- White spaces here and the line break before them belongs to this sentence,
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 5
not the previous one, since the previous trailing cannot contain line breaks.
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 5
```

And now, some edge cases...

# 2

> /\$object/"(?#predefined=sentence)"/g

```
        I'm a sentence   .        I'm another sentence.
    ^ 0 ^ 1      |^^^ 2
```

````
        <--- main part --><-------- trailing --------->
````

In this case since the leading blank chars are at document start, they do not
belong to any sentence. First sentence starts at "I".

## 2 to-start
[up](#2)

- .seek.object { input: $object, where: "start" }

```
        I'm a sentence   .        I'm another sentence.
    ^^^^^^^^^^^^^^ 0
```

## 2 to-end
[up](#2)

- .seek.object { input: $object, where: "end" }

```
        I'm a sentence   .        I'm another sentence.
    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
```

## 2 select
[up](#2)

- .seek.object { input: $object }

```
        I'm a sentence   .        I'm another sentence.
        ^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
```

# 3

> /\$object/"(?#predefined=sentence)"/g

```
I'm a previous sentence.    
                   |^^^ 3 ^ 4
                            ^ 5
        I'm a sentence   .        I'm another sentence.
    ^ 0 ^ 1      |^^^ 2
```

````
<----- leading ---><------ main part -------------><---- trailing ------------->
````

In this case, the leading blank chars and the line break before it belongs to
current sentence (outer and inner) because the previous sentence's inner end is
the previous period and it's outer end can only cover trailing blank chars
but not the line break (or anything after the line break).

## 3 select
[up](#3)

- .seek.object { input: $object, inner: true }

This one is actually pretty easy -- it only depends on which sentence each
selection was active on. Just remember that the previous sentence ends
**before** the line break and the current sentence starts **at** the line break.

```
I'm a previous sentence.    
^^^^^^^^^^^^^^^^^^^^^^^^ 1  ^ 0
        I'm a sentence   .        I'm another sentence.
^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
```

## 3 to-start
[up](#3)

- .seek.object { input: $object, where: "start" }

```
I'm a previous sentence.    
|^^^^^^^^^^^^^^^^^^^^^^^ 0  | 1
        I'm a sentence   .        I'm another sentence.
^^^^^^^^^^^^^^^^^^ 1
```

Note that selections #0, #1, #5 are sent to the **previous** sentence since they
are active at the leading blank chars or first nonblank char. As a special case,
their anchors were set to the **inner** end of the previous sentence (instead of
old active). Similarly, selection #4 is also re-anchored because old active
was on trailing blank chars.

## 3 to-start-inner
[up](#3)

- .seek.object { input: $object, where: "start", inner: true }

This is exactly the same as above, because leading blank chars are also part of
the inner sentence.

```
I'm a previous sentence.    
|^^^^^^^^^^^^^^^^^^^^^^^ 0  | 1
        I'm a sentence   .        I'm another sentence.
^^^^^^^^^^^^^^^^^^ 1
```

## 3 to-end
[up](#3)

- .seek.object { input: $object, where: "end" }

```
I'm a previous sentence.    
                   ^^^^^^^^^^ 0
        I'm a sentence   .        I'm another sentence.
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
```

Selection #5 was active on the line break, which is also part of the following
sentence. Selection #4 was on trailing of previous sentence so it seeks to the
current sentence. Worth noting that `to-end` does not have special treatment for
anchors so selection #4 does not get re-anchored to the current sentence start.
Similarly, selection #0 still anchors to the leading blank.

# 4

> /\$object/"(?#predefined=sentence)"/g

```
I'm a sentence.I'm another sentence
       ^^^^ 0 ^ 1       ^ 3        ^ 4
               ^ 2

```

````
<----- sentence A ------><------------ sentence B --------------->
````

## 4 select
[up](#4)

- .seek.object { input: $object, inner: true }

```
I'm a sentence.I'm another sentence
^^^^^^^^^^^^^^^ 0
               ^^^^^^^^^^^^^^^^^^^^^ 1

```

The last line break is the terminating character of sentence B and is also
considered to be inner sentence. There is no trailing for either sentence.

## 4 to-start
[up](#4)

- .seek.object { input: $object, where: "start" }

```
I'm a sentence.I'm another sentence
|^^^^^^^^^^^^^^ 0
               |^^^^^^^^^^^^^^^^^^^^ 1

```

Selection #2 seeks to the previous sentence because it was active at the first
character of sentence B and it's anchor was set to the end of last sentence
instead of old active. That's right: `to-start` has tons of special cases.

## 4 to-end
[up](#4)

- .seek.object { input: $object, where: "end" }

```
I'm a sentence.I'm another sentence
          ^^^^^ 0
               ^^^^^^^^^^^^^^^^^^^^^ 1

```

`to-end` has fewer edge cases and it will **not** seek to the next sentence on
from the current sentence inner end, so selection #1 did not move.
(Trailing whitespace is a different story though, covered by cases above.)

# 5

> /\$object/"(?#predefined=sentence)"/g

```
I'm a sentence terminated by two line breaks
                  |^^^^^ 0                  ^ 1

^ 2
    I'm another sentence
 ^ 3         |^^^^^ 4
```

The first sentence includes the first line break as both inner and outer.
There is no "trailing" whitespace here (i.e. inner end === outer end).
The empty line and the blank characters on the next line does not belong to
either sentence.

## 5 select
[up](#5)

- .seek.object { input: $object }

```
I'm a sentence terminated by two line breaks
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

    I'm another sentence
    ^^^^^^^^^^^^^^^^^^^^ 1
```

## 5 to-start
[up](#5)

- .seek.object { input: $object, where: "start" }

```
I'm a sentence terminated by two line breaks
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

^ 1
    I'm another sentence
^^^^^^^^^^^^^^ 1
```

More special cases: selection #2 was on an empty line so it does not belong to
any sentence, and it actually scanned to the **next** sentence start.

## 5 to-end
[up](#5)

- .seek.object { input: $object, where: "end" }

```
I'm a sentence terminated by two line breaks
                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

^ 1
    I'm another sentence
^^^^^^^^^^^^^^^^^^^^^^^^ 1
```

Selection #1 was exactly at the end of the first sentence and did not move.
Selection #2 was on the empty line and scanned to the next sentence end.
Again, no special treatment for the anchors of selections #2 and #3.

# 6

> /\$object/"(?#predefined=sentence)"/g

These test cases before document the Kakoune behavior in some minor corner
cases regarding trailing blank lines. Note that these may or may not make
sense in VSCode where the last line does NOT have a line break attached.

```
I'm a sentence terminated by two line breaks plus one more
                  |^^^^^ 0                                ^ 1

^ 2

^ 3
```

## 6 to-start
[up](#6)

- .seek.object { input: $object, where: "start" }

```
I'm a sentence terminated by two line breaks plus one more
|^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

^ 1

^ 1
```

## 6 to-end
[up](#6)

- .seek.object { input: $object, where: "end" }

```
I'm a sentence terminated by two line breaks plus one more
                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

^ 1

^ 1
```

## 6 select
[up](#6)

- .seek.object { input: $object }

```
I'm a sentence terminated by two line breaks plus one more
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

^ 1

^ 1
```

# 7

> /\$object/"(?#predefined=sentence)"/g

```
I'm a sentence at end of document

| 0
```

## 7 to-start
[up](#7)

- .seek.object { input: $object, where: "start" }

```
I'm a sentence at end of document
|^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

```

## 7 to-end
[up](#7)

- .seek.object { input: $object, where: "end" }

```
I'm a sentence at end of document
                                 ^ 0

```

## 7 select
[up](#7)

- .seek.object { input: $object }

```
I'm a sentence at end of document
|^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0

```

<!--
  TODO: Write tests to compare character and caret behaviors. Ideas below:

  If caret is between two sentences, we should arbitrarily lean to:
  1. Direction of current selection (if not empty).
  2. Direction of movement (if to inner/out start/end)
  3. The NEXT one by default
-->
