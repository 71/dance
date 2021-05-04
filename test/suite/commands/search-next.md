# 1

```
apple pineapple pear
^ 0
pear pineapple apple
kiwi orange kiwi
```

## 1 search-apple
[up](#1)

- .search { input: "apple" }

```
apple pineapple pear
          ^^^^^ 0
pear pineapple apple
kiwi orange kiwi
```

### 1 search-apple next
[up](#1-search-apple)

- .search.next

```
apple pineapple pear
pear pineapple apple
         ^^^^^ 0
kiwi orange kiwi
```

### 1 search-apple next-add
[up](#1-search-apple)

- .search.next.add

```
apple pineapple pear
          ^^^^^ 1
pear pineapple apple
         ^^^^^ 0
kiwi orange kiwi
```

### 1 search-apple next-3
[up](#1-search-apple)

- .search.next { count: 3 }

Main selection search will wrap around:

```
apple pineapple pear
^^^^^ 0
pear pineapple apple
kiwi orange kiwi
```

### 1 search-apple next-add-3
[up](#1-search-apple)

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

### 1 search-apple next-4
[up](#1-search-apple)

- .search.next { count: 4 }

Main selection search will wrap around and hit the second "apple" again:

```
apple pineapple pear
          ^^^^^ 0
pear pineapple apple
kiwi orange kiwi
```

### 1 search-apple next-add-4
[up](#1-search-apple)

- .search.next.add { count: 4 }

Main selection search will wrap around and hit the second "apple" again, and VS
Code will then merge the selections 0 and 4 automatically:

```
apple pineapple pear
^^^^^ 1   ^^^^^ 0
pear pineapple apple
         ^^^^^ 3
               ^^^^^ 2
kiwi orange kiwi
```

### 1 search-apple previous
[up](#1-search-apple)

- .search.previous

```
apple pineapple pear
^^^^^ 0
pear pineapple apple
kiwi orange kiwi
```

### 1 search-apple previous-add
[up](#1-search-apple)

- .search.previous.add

```
apple pineapple pear
^^^^^ 0   ^^^^^ 1
pear pineapple apple
kiwi orange kiwi
```

### 1 search-apple previous-2
[up](#1-search-apple)

- .search.previous { count: 2 }

Main selection search will wrap around:

```
apple pineapple pear
pear pineapple apple
               ^^^^^ 0
kiwi orange kiwi
```

### 1 search-apple previous-add-2
[up](#1-search-apple)

- .search.previous.add { count: 2 }

Main selection search will wrap around:

```
apple pineapple pear
^^^^^ 1   ^^^^^ 2
pear pineapple apple
               ^^^^^ 0
kiwi orange kiwi
```
