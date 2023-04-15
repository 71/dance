# 1

```
foo:bar
   ^ 0
longfoo:bar
       ^ 1
foo2:longbar
    ^ 2
```

## 1 align
[up](#1)

- .edit.align

```
foo    :bar
       ^ 0
longfoo:bar
       ^ 1
foo2   :longbar
       ^ 2
```


# 2

```
selections are aligned by their selection active point
 --> 97) lorem
     ^^^ 0
 --> 98) ipsum
     ^^^ 1
 --> 99) dolor
     ^^^ 2
 --> 100) sit
     ^^^^ 3
 --> 101) amet
     ^^^^ 4
```

## 2 align
[up](#2)

- .edit.align

```
selections are aligned by their selection active point
 -->  97) lorem
      ^^^ 0
 -->  98) ipsum
      ^^^ 1
 -->  99) dolor
      ^^^ 2
 --> 100) sit
     ^^^^ 3
 --> 101) amet
     ^^^^ 4
```


# 3

```
Lorem ipsum dolor
^^^^^ 0     ^^^^^ 2
      ^^^^^ 1
consectetur adipiscing elit Morbi eget
^^^^^^^^^^^ 3          ^^^^ 5     ^^^^ 7
            ^^^^^^^^^^ 4    ^^^^^ 6
Aliquam erat
^^^^^^^ 8
        ^^^^ 9
```

## 3 align
[up](#3)

- .edit.align

```
      Lorem      ipsum dolor
      ^^^^^ 0          ^^^^^ 2
                 ^^^^^ 1
consectetur adipiscing  elit Morbi eget
^^^^^^^^^^^ 3           ^^^^ 5     ^^^^ 7
            ^^^^^^^^^^ 4     ^^^^^ 6
    Aliquam       erat
    ^^^^^^^ 8     ^^^^ 9
```

## 3 align-inverted
[up](#3)

- .selections.changeDirection
- .edit.align

```
Lorem       ipsum      dolor
^^^^^ 0     ^^^^^ 1    ^^^^^ 2
consectetur adipiscing elit Morbi eget
^^^^^^^^^^^ 3          ^^^^ 5     ^^^^ 7
            ^^^^^^^^^^ 4    ^^^^^ 6
Aliquam     erat
^^^^^^^ 8   ^^^^ 9
```
