# 1

Note that escaped characters are handled. There are two backslashes at the end,
so the string ends on the second-to-last character.

```
hello world "inside a quote, there can be escaped \" characters! also\"\\\"\\""
                ^ 0
```

## 1 select
[up](#1)

- .seek.object { }

```
hello world "inside a quote, there can be escaped \" characters! also\"\\\"\\""
            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
```

## 1 select-inner
[up](#1)

- .seek.object { inner: true }

```
hello world "inside a quote, there can be escaped \" characters! also\"\\\"\\""
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 0
```
