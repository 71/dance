# initial

```

^ 0
there are two blank lines before me
         ^ 0                       | 1
   some whitespaces around me    
                                ^ 1
and some more words
^^^^^^^^^^^^^ 2
finally a selection    
                    ^^^ 3
    that contains only whitespace
^^^| 3
```

# trim
[up](#initial)

- .selections.trimWhitespace

```

there are two blank lines before me
^^^^^^^^^ 0
   some whitespaces around me    
   |^^^^^^^^^^^^^^^^^^^^^^^^^ 1
and some more words
^^^^^^^^^^^^^ 2
finally a selection    
    that contains only whitespace
```
