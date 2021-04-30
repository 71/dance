# 1

```
if {0}(|{0}ok) {
  f|{1}oo ={1} a+(b{2}+(|{2}c+(d)+e)+f)+g;
} else {
  {3}for (var i = (foo + bar)|{3}; i < 1000; i++) {
    getAction(i{4})|{4}();
  }
}
```

## 1 to-end
[up](#1)

- .seek.object { "object": "parens", "action": "selectToEnd" }

Old selection #1 is removed because it is not in a parens block.  
Old selection #4 is removed because it is not in a parens block (the `)` it is
on does not count, and the next `(` starts a NEW parens block).

```
if {0}(ok)|{0} {
  foo = a+(b+{1}(c+(d)+e)|{1}+f)+g;
} else {
  for (var i = (foo + bar{2}); i < 1000; i++)|{2} {
    getAction(i)();
  }
}
```

## 1 to-end-extend
[up](#1)

- .seek.object { "object": "parens", "action": "selectToEnd", "extend": true }

Old selection #1 is removed because it is not in a parens block.  
Old selection #4 is removed because it is not in a parens block (the `)` it is
on does not count, and the next `(` starts a NEW parens block).

```
if {0}(ok)|{0} {
  foo = a+(b{1}+(c+(d)+e)|{1}+f)+g;
} else {
  {2}for (var i = (foo + bar); i < 1000; i++)|{2} {
    getAction(i)();
  }
}
```

## 1 to-end-inner
[up](#1)

- .seek.object { "object": "parens", "action": "selectToEnd", "inner": true }

Old selection #1 is removed because it is not in a parens block.  
Old selection #4 is removed because it is not in a parens block (the `)` it is
on does not count, and the next `(` starts a NEW parens block).

```
if {0}(ok|{0}) {
  foo = a+(b+{1}(c+(d)+e|{1})+f)+g;
} else {
  for (var i = (foo + bar{2}); i < 1000; i++|{2}) {
    getAction(i)();
  }
}
```

## 1 to-end-inner-extend
[up](#1)

- .seek.object { "object": "parens", "action": "selectToEnd", "inner": true, "extend": true }

Old selection #1 is removed because it is not in a parens block.  
Old selection #4 is removed because it is not in a parens block (the `)` it is
on does not count, and the next `(` starts a NEW parens block).

```
if {0}(ok|{0}) {
  foo = a+(b{1}+(c+(d)+e|{1})+f)+g;
} else {
  {2}for (var i = (foo + bar); i < 1000; i++|{2}) {
    getAction(i)();
  }
}
```

## 1 to-start
[up](#1)

- .seek.object { "object": "parens", "action": "selectToStart" }

Old selection #0 is removed because it is not in a parens block (the `(` it is
is on does not count).  
Old selection #1 is removed because it is not in a parens block.

```
if (ok) {
  foo = a+|{0}(b+({0}c+(d)+e)+f)+g;
} else {
  for (var i = |{1}(foo + bar){1}; i < 1000; i++) {
    getAction|{2}(i){2}();
  }
}
```

## 1 to-start-extend
[up](#1)

- .seek.object { "object": "parens", "action": "selectToStart", "extend": true }

Old selection #0 is removed because it is not in a parens block (the `(` it is
is on does not count).  
Old selection #1 is removed because it is not in a parens block.

```
if (ok) {
  foo = a+|{0}(b+{0}(c+(d)+e)+f)+g;
} else {
  {1}for (var i = (|{1}foo + bar); i < 1000; i++) {
    getAction|{2}(i){2}();
  }
}
```

## 1 to-start-inner
[up](#1)

- .seek.object { "object": "parens", "action": "selectToStart", "inner": true }

Old selection #0 is removed because it is not in a parens block (the `(` it is
on does not count).  
Old selection #1 is removed because it is not in a parens block.

```
if (ok) {
  foo = a+(|{0}b+({0}c+(d)+e)+f)+g;
} else {
  for (var i = (|{1}foo + bar){1}; i < 1000; i++) {
    getAction(|{2}i){2}();
  }
}
```

## 1 to-start-inner-extend
[up](#1)

- .seek.object { "object": "parens", "action": "selectToStart", "inner": true, "extend": true }

Old selection #0 is removed because it is not in a parens block (the `(` it is
on does not count).  
Old selection #1 is removed because it is not in a parens block.

```
if (ok) {
  foo = a+(|{0}b+{0}(c+(d)+e)+f)+g;
} else {
  {1}for (var i = (f|{1}oo + bar); i < 1000; i++) {
    getAction(|{2}i){2}();
  }
}
```

## 1 select
[up](#1)

- .seek.object { "object": "parens", "action": "select" }

Old selection #1 is removed because it is not in a parens block.

```
if {0}(ok)|{0} {
  foo = a+(b+{1}(c+(d)+e)|{1}+f)+g;
} else {
  for (var i = {2}(foo + bar)|{2}; i < 1000; i++) {
    getAction{3}(i)|{3}();
  }
}
```

## 1 select-inner
[up](#1)

- .seek.object { "object": "parens", "action": "select", "inner": true }

```
if ({0}ok|{0}) {
  foo = a+(b+({1}c+(d)+e|{1})+f)+g;
} else {
  for (var i = ({2}foo + bar|{2}); i < 1000; i++) {
    getAction({3}i|{3})();
  }
}
```
