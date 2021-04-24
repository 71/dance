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
assert.strictEqual(
  Context.current.document.getText(Context.current.editor.selection),
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
const pos = (line, col) => new vscode.Position(line, col);

assert.deepStrictEqual(
  map(new vscode.Range(pos(0, 0), pos(0, 5)), (p) => p.translate(1)),
  new vscode.Range(pos(1, 0), pos(1, 5)),
);
```
</details>

## Command tests

Command tests are processed by [`commands.test.ts`](./suite/commands.test.ts),
which reads all files under the [`commands`](./suite/commands) directory and
parses them into several sections.

Each section must start with a Markdown `# heading`, which represents the title
of the section. Except for the first section, all sections must also link to
the section from which they transition with a Markdown `[link](#heading)`.

Sections can then specify a set of flags that may alter the behavior of their
test using Markdown `> quotes`.

Then, the commands to execute are specified as Markdown `- lists`. These
commands may specify arguments in JSON.

Finally, the expected document after changes can be specified in a Markdown
code block.

<details>
  <summary><b>Example</b></summary>

# initial

```
foo bar
  ^ 0
```

# search
[up](#initial)

- .search { "input": "b" }

```
foo bar
    ^ 0
```

</details>

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

</details>
