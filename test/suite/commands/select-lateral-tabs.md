# 1

Note: tabs are used for the indentation below. It is recommended to set the
"Tab Size" to 1 to easily edit this file.

```
a
	b
 | 0
		c
	d
		e
	f
g
	h

```

## 1 down
[up](#1)

- .select.down.jump

```
a
	b
		c
 | 0
	d
		e
	f
g
	h

```

## 1 up
[up](#1)

- .select.up.jump

```
a
 | 0
	b
		c
	d
		e
	f
g
	h

```

# 2

Same as [1](#1), but with character selection behavior.

> behavior <- character

```
a
	b
 ^ 0
		c
	d
		e
	f
g
	h

```

## 2 down
[up](#2)

- .select.down.jump

```
a
	b
		c
 ^ 0
	d
		e
	f
g
	h

```

## 2 up
[up](#2)

- .select.up.jump

```
a
 ^ 0
	b
		c
	d
		e
	f
g
	h

```
