# 1

> behavior <- character
> /\$object/"\\((?#inner)\\)"/g

```
if (ok) {
   ^ 0
  foo = a+(b+(c+(d)+e)+f)+g;
   |^^^ 1   ^^ 2
} else {
  for (var i = (foo + bar); i < 1000; i++) {
  ^^^^^^^^^^^^^^^^^^^^^^^^ 3
    getAction(i)();
               ^ 4
  }
}
```

## 1 to-end
[up](#1)

- .seek.object { input: $object, where: "end" }

Old selection #1 is removed because it is not in a parens block.  
Old selection #4 is removed because it is not in a parens block (the `)` it is
on does not count, and the next `(` starts a NEW parens block).

```
if (ok) {
   ^^^^ 0
  foo = a+(b+(c+(d)+e)+f)+g;
             ^^^^^^^^^ 1
} else {
  for (var i = (foo + bar); i < 1000; i++) {
                         ^^^^^^^^^^^^^^^^^ 2
    getAction(i)();
  }
}
```

## 1 to-end-extend
[up](#1)

- .seek.object { input: $object, where: "end", shift: "extend" }

Old selection #1 is removed because it is not in a parens block.  
Old selection #4 is removed because it is not in a parens block (the `)` it is
on does not count, and the next `(` starts a NEW parens block).

```
if (ok) {
   ^^^^ 0
  foo = a+(b+(c+(d)+e)+f)+g;
            ^^^^^^^^^^ 1
} else {
  for (var i = (foo + bar); i < 1000; i++) {
  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 2
    getAction(i)();
  }
}
```

## 1 to-end-inner
[up](#1)

- .seek.object { input: $object, where: "end", inner: true }

Old selection #1 is removed because it is not in a parens block.  
Old selection #4 is removed because it is not in a parens block (the `)` it is
on does not count, and the next `(` starts a NEW parens block).

```
if (ok) {
   ^^^ 0
  foo = a+(b+(c+(d)+e)+f)+g;
             ^^^^^^^^ 1
} else {
  for (var i = (foo + bar); i < 1000; i++) {
                         ^^^^^^^^^^^^^^^^ 2
    getAction(i)();
  }
}
```

## 1 to-end-inner-extend
[up](#1)

- .seek.object { input: $object, where: "end", inner: true, shift: "extend" }

Old selection #1 is removed because it is not in a parens block.  
Old selection #4 is removed because it is not in a parens block (the `)` it is
on does not count, and the next `(` starts a NEW parens block).

```
if (ok) {
   ^^^ 0
  foo = a+(b+(c+(d)+e)+f)+g;
            ^^^^^^^^^ 1
} else {
  for (var i = (foo + bar); i < 1000; i++) {
  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 2
    getAction(i)();
  }
}
```

## 1 to-start
[up](#1)

- .seek.object { input: $object, where: "start" }

Old selection #0 is removed because it is not in a parens block (the `(` it is
is on does not count).  
Old selection #1 is removed because it is not in a parens block.

```
if (ok) {
  foo = a+(b+(c+(d)+e)+f)+g;
          |^^^ 0
} else {
  for (var i = (foo + bar); i < 1000; i++) {
               |^^^^^^^^^^ 1
    getAction(i)();
             |^^ 2
  }
}
```

## 1 to-start-extend
[up](#1)

- .seek.object { input: $object, where: "start", shift: "extend" }

Old selection #0 is removed because it is not in a parens block (the `(` it is
is on does not count).  
Old selection #1 is removed because it is not in a parens block.

```
if (ok) {
  foo = a+(b+(c+(d)+e)+f)+g;
          |^^ 0
} else {
  for (var i = (foo + bar); i < 1000; i++) {
  ^^^^^^^^^^^^^ 1
    getAction(i)();
             |^^ 2
  }
}
```

## 1 to-start-inner
[up](#1)

- .seek.object { input: $object, where: "start", inner: true }

Old selection #0 is removed because it is not in a parens block (the `(` it is
on does not count).  
Old selection #1 is removed because it is not in a parens block.

```
if (ok) {
  foo = a+(b+(c+(d)+e)+f)+g;
           |^^ 0
} else {
  for (var i = (foo + bar); i < 1000; i++) {
                |^^^^^^^^^ 1
    getAction(i)();
              |^ 2
  }
}
```

## 1 to-start-inner-extend
[up](#1)

- .seek.object { input: $object, where: "start", inner: true, shift: "extend" }

Old selection #0 is removed because it is not in a parens block (the `(` it is
on does not count).  
Old selection #1 is removed because it is not in a parens block.

```
if (ok) {
  foo = a+(b+(c+(d)+e)+f)+g;
           |^ 0
} else {
  for (var i = (foo + bar); i < 1000; i++) {
  ^^^^^^^^^^^^^^ 1
    getAction(i)();
              |^ 2
  }
}
```

## 1 select
[up](#1)

- .seek.object { input: $object }

Old selection #1 is removed because it is not in a parens block.

```
if (ok) {
   ^^^^ 0
  foo = a+(b+(c+(d)+e)+f)+g;
             ^^^^^^^^^ 1
} else {
  for (var i = (foo + bar); i < 1000; i++) {
               ^^^^^^^^^^^ 2
    getAction(i)();
             ^^^ 3
  }
}
```

## 1 select-inner
[up](#1)

- .seek.object { input: $object, inner: true }

```
if (ok) {
    ^^ 0
  foo = a+(b+(c+(d)+e)+f)+g;
              ^^^^^^^ 1
} else {
  for (var i = (foo + bar); i < 1000; i++) {
                ^^^^^^^^^ 2
    getAction(i)();
              ^ 3
  }
}
```
