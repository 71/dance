# Dance tests

There are currently two types of tests for Dance: [API tests](#api-tests) and
[command tests](#command-tests). Both of these tests use code to represent
what documents should look like before and after performing changes, as well as
what selections should be on the given document. This syntax is specified [at
the end of this document](#syntax-of-expected-documents).

## API tests

API tests are processed by [`api.test.ts`](./suite/api.test.ts), which reads
all files under the [`api`](../src/api) directory and (roughly) parses their
documentation comments. When these comments specify examples, these examples
are tested.

These examples are specified in Markdown, and must have a format matching the
following example.

<details>
  <summary><b>Example</b> with "before" / "after" sections</summary>

### Example

```js
const anchor = new vscode.Position(0, 0),
      active = new vscode.Position(0, 3),
      selection = new vscode.Selection(anchor, active);

await updateSelections([selection]);
```

Before:
```
foo bar
    ^^^ 0
```

After:
```
foo bar
^^^ 0
```
</details>

<details>
  <summary><b>Example</b> with "before" section</summary>

### Example

```js
expect(
  Context.current.document.getText(Selections.current[0]),
  "to be",
  "bar",
);
```

With:
```
foo bar
    ^^^ 0
```
</details>

<details>
  <summary><b>Example</b> with no section</summary>

### Example

```js
expect(
  map(
    new vscode.Range(Positions.at(0, 0), Positions.at(0, 5)),
    (p) => p.translate(1),
  ),
  "to satisfy",
  {
    start: expect.it("to be at coords", 0, 0),
    end: expect.it("to be at coords", 0, 5),
  },
)
```
</details>

### Debugging

While viewing a file in the [`api`](../src/api) directory, select "Run tests in
this file" to debug all doc tests in the file being viewed. Select "Run test on
this line" to debug the test of the function under the cursor.

## Command tests

Command tests are processed by [`commands.test.ts`](./suite/commands.test.ts),
which reads all files under the [`commands`](./suite/commands) directory and
parses them into several sections.

Each section must start with a Markdown `# heading`, which represents the title
of the section. Except for initial sections, all sections must also link to
the section from which they transition with a Markdown `[link](#heading)`.

Sections can then specify a set of [flags](#available-flags) that may alter the
behavior of their test using Markdown `> quotes`.

Then, the commands to execute are specified as Markdown `- lists`. These
commands may specify arguments in JSON.

Finally, the expected document after changes can be specified in a Markdown
code block.

<details>
  <summary><b>Example</b></summary>

# 1

```
foo bar
  ^ 0
```

## 1 search-b
[up](#1)

- .search { input: "b" }

```
foo bar
    ^ 0
```

</details>

### Available flags

- `debug`: Inserts a `debugger` statement at the beginning of the test.
- `behavior <- character`: Sets selection behavior of normal mode to `character`
  for the duration of the test. The mode will be reset to `caret` at the end of
  the test. Tests that depend on a test with character behavior `character` will
  default to having that same behavior. Use `behavior <- caret` to undo this.
- `/<pattern>/<replacement>/<flags>`: Replaces the given pattern by the given
  replacement string in all sections that inherit from the current section.

### Naming and organization

To make it easier to navigate and understand tests, tests must have be named
this way:
- Initial sections should be top-level headers (have a single `#` character),
  and be a single non-whitespace word (e.g. `1`, `empty-document`).
- Non-initial sections have names split in several parts separated by spaces.
  If a test essentially moves to the left, it should be named `<up> left`, with
  `<up>` the name of the section from which it transitions. It should also have
  as many `#` characters as parts (with a upper bound of 6).
  * Names cannot contain whitespace. Names should be in snake-case. If a count
    is associated with the test, it should be the last part of the test. If a
    test repeats exactly what its previous test does, it should be named `x`.
  * If a test performs multiple logically different actions, they should be
    separated by `-then-` in the title of the test.

Finally, sections should always be nested under the section from which they
transition.

### Debugging

While viewing a Markdown file in the [`commands`](./suite/commands) directory,
select "Run tests in this file" to debug all tests defined by the Markdown file.
Select "Run test on this line" to debug the test defined in the section under
the cursor.

## Syntax of expected documents

Expected documents are regular strings where some lines specify where
selections should be set. These selections are represented using carets,
numbers and pipes.

These specifiers are replaced by spaces in the output document; if a line is
empty after removing specifiers, it is completely erased.

By default, specifiers face forward (the anchor position comes before the
active position).

<details>
  <summary><b>Examples</b></summary>

> The following examples are also tested in [`utils.test.ts`](
  ./suite/utils.test.ts).

1. Equivalent to [0:0 → 0:3]:
   ```
   foo bar
   ^^^ 0
   ```
2. Equivalent to [0:0 → 0:3]:
   ```
   foo bar
   ^^| 0
   ```
3. Equivalent to [0:3 → 0:0]:
   ```
   foo bar
   |^^ 0
   ```
4. Equivalent to [0:0 → 0:3, 0:4 → 0:7]:
   ```
   foo bar
   ^^^ 0
       ^^^ 1
   ```
5. Equivalent to [0:4 → 0:7, 0:0 → 0:3]:
   ```
   foo bar
   ^^^ 1
       ^^^ 0
   ```
6. Equivalent to [0:0 → 0:1, 0:5 → 0:5]:
   ```
   foo bar
   ^ 0  | 1
   ```
7. Equivalent to [0:0 → 2:4]:
   ```
   foo
   ^ 0
    bar
     baz
      ^ 0
   ```
8. Equivalent to [0:0 → 2:4]:
   ```
   foo
   ^ 0
    bar
     baz
      | 0
   ```
9. Equivalent to [2:4 → 0:0]:
   ```
   foo
   | 0
    bar
     baz
      ^ 0
   ```
10. Equivalent to [2:4 → 0:0]:
    ```
    foo
    |^^ 0
     bar
      baz
    ^^^^ 0
    ```
11. Equivalent to [0:0 → 1:4]:
    ```

    ^ 0
    abcd
       ^ 0
    ```
12. Equivalent to [0:3 → 0:3]:
    ```
    foo
       | 0
    bar
    ```
13. Equivalent to [0:0 → 1:0, 1:0 → 1:3]:
    ```
    abc
    ^^^^ 0
    def
    ^^^ 1
    ```

</details>
