# Changelog

## 0.5.15

- Replace `!textInputFocus` by `dance.inPrompt` to limit `prompt` keybindings to
  Dance prompts in VS Code >=1.90.

## 0.5.14

- **BREAKING**: Fix rotation behavior to match Kakoune and Helix, i.e. now
  rotation follows the order of selections in the document, _not_ the order in
  which they were added (fixes #322).

- **BREAKING**: Fix rotation keybindings: `(` (respectively `a-(`) now rotates
  selections **backward**, and `)` (respectively `a-)`) now rotates selections
  **forward**.
