# 1

```
foo {
^ 0

}

bar
 ^ 1
```

## 1 below
[up](#1)

- .edit.newLine.below

```
foo {
^ 0


}

bar
 ^ 1

```

## 1 select-below
[up](#1)

- .edit.newLine.below { select: true }

```
foo {
··
  | 0

}

bar

| 1
```

## 1 below-2
[up](#1)

- .edit.newLine.below { count: 2 }

```
foo {
^ 0



}

bar
 ^ 1


```

## 1 select-below-2
[up](#1)

- .edit.newLine.below { select: true, count: 2 }

```
foo {
··
  | 1
··
  | 0

}

bar

| 3

| 2
```

## 1 above
[up](#1)

- .edit.newLine.above

```

foo {
^ 0

}


bar
 ^ 1
```

## 1 select-above
[up](#1)

- .edit.newLine.above { select: true }

```

| 0
foo {

}


| 1
bar
```

## 1 above-2
[up](#1)

- .edit.newLine.above { count: 2 }

```


foo {
^ 0

}



bar
 ^ 1
```

## 1 select-above-2
[up](#1)

- .edit.newLine.above { select: true, count: 2 }

```

| 1

| 0
foo {

}


| 3

| 2
bar
```
