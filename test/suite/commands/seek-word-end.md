# initial-1

```
private String foo;
   | 0
```

# word-end-1a
[up](#initial-1)

- .seek.wordEnd

```
private String foo;
   ^^^^ 0
```

# word-end-1b
[up](#word-end-1a)

- .seek.wordEnd

```
private String foo;
       ^^^^^^^ 0
```

# word-end-with-count-1
[up](#initial-1)

- .seek.wordEnd { count: 2 }

```
private String foo;
       ^^^^^^^ 0
```
