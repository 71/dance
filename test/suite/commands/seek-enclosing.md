# initial-1

```
{ hello: 1,
  world: {
    foo: [
      [ 1, 2, 3, ],
        ^ 0
    ],
    bar: (42),
          ^^ 1
  },
}
```

# enclosing-1a
[up](#initial-1)

- .seek.enclosing

Since the active of selection #0 is not on a brace / bracket character, Dance
will find the next bracket (`]`) and then match from there, moving the active to
the previous matching `[`, selecting the text during the move (i.e. backwards
from `]` to `[`). Same for selection #1.

```
{ hello: 1,
  world: {
    foo: [
      [ 1, 2, 3, ],
      |^^^^^^^^^^^ 0
    ],
    bar: (42),
         |^^^ 1
  },
}
```

# enclosing-1b
[up](#enclosing-1a)

Since the active position was at the opening square bracket (`[`), `m` again
should keep the same selection but forwards, so the active position is at the
closing bracket (`]`).

- .seek.enclosing

```
{ hello: 1,
  world: {
    foo: [
      [ 1, 2, 3, ],
      ^^^^^^^^^^^^ 0
    ],
    bar: (42),
         ^^^^ 1
  },
}
```

# initial-2

```
{ hello: 1,
^ 0
  world: {
    foo: [
      [ 1, 2, 3, ],
    ],
    bar: (42),
  },
}
```

# enclosing-2
[up](#initial-2)

- .seek.enclosing

Current active was already on {, so no need to seek. Directly move to } and
select the text along the way.

```
{ hello: 1,
^ 0
  world: {
    foo: [
      [ 1, 2, 3, ],
    ],
    bar: (42),
  },
}
^ 0
```
