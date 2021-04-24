# initial

```
apple pineapple pear
^ 0
pear pineapple apple
kiwi orange kiwi
```

# search-a
[up](#initial)

- .search { input: "apple" }

```
apple pineapple pear
          ^^^^^ 0
pear pineapple apple
kiwi orange kiwi
```

# search-a-next
[up](#search-a)

- .search.next

```
apple pineapple pear
pear pineapple apple
         ^^^^^ 0
kiwi orange kiwi
```

# search-a-next-add
[up](#search-a)

- .search.next.add

```
apple pineapple pear
          ^^^^^ 1
pear pineapple apple
         ^^^^^ 0
kiwi orange kiwi
```

# search-a-next-with-3
[up](#search-a)

- .search.next { count: 3 }

Main selection search will wrap around:

```
apple pineapple pear
^^^^^ 0
pear pineapple apple
kiwi orange kiwi
```

# search-a-next-with-3-add
[up](#search-a)

- .search.next.add { count: 3 }

Main selection search will wrap around:

```
apple pineapple pear
^^^^^ 0   ^^^^^ 3
pear pineapple apple
         ^^^^^ 2
               ^^^^^ 1
kiwi orange kiwi
```

# search-a-next-with-4
[up](#search-a)

- .search.next { count: 4 }

Main selection search will wrap around and hit the second "apple" again:

```
apple pineapple pear
          ^^^^^ 0
pear pineapple apple
kiwi orange kiwi
```

# search-a-next-with-4-add
[up](#search-a)

- .search.next.add { count: 4 }

Main selection search will wrap around and hit the second "apple" again, and VS
Code will merge the selections 0 and 4 automatically:

```
apple pineapple pear
^^^^^ 1   ^^^^^ 0
pear pineapple apple
         ^^^^^ 3
               ^^^^^ 2
kiwi orange kiwi
```

# search-a-previous
[up](#search-a)

- .search.previous

```
apple pineapple pear
^^^^^ 0
pear pineapple apple
kiwi orange kiwi
```

# search-a-previous-add
[up](#search-a)

- .search.previous.add

```
apple pineapple pear
^^^^^ 0   ^^^^^ 1
pear pineapple apple
kiwi orange kiwi
```

# search-a-previous-with-2
[up](#search-a)

- .search.previous { count: 2 }

Main selection search will wrap around:

```
apple pineapple pear
pear pineapple apple
               ^^^^^ 0
kiwi orange kiwi
```

# search-a-previous-with-2-add
[up](#search-a)

- .search.previous.add { count: 2 }

Main selection search will wrap around:

```
apple pineapple pear
^^^^^ 1   ^^^^^ 2
pear pineapple apple
               ^^^^^ 0
kiwi orange kiwi
```
