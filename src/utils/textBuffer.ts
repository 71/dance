import * as vscode from 'vscode'


/**
 * A text buffer, used to process text buffered in lines by VS Code.
 */
export class TextBuffer {
  private lineOffset: number
  private lineEnd: number

  private line: vscode.TextLine

  /**
   * Creates a new `TextBuffer` that operates on the given document and with
   * the given origin.
   */
  constructor(readonly doc: vscode.TextDocument, origin: vscode.Position) {
    this.line = doc.lineAt(origin.line)
    this.lineOffset = -origin.character
    this.lineEnd = this.line.text.length + 1 - origin.character
  }

  /**
   * Returns the character at the given offset with respect to the originally
   * provided origin.
   *
   * If outside of the document, `undefined` will be returned.
   *
   * This method is optimized to work well for recurring calls on incrementing indices.
   *
   * Note that line endings (`\n`, no matter the platform) are automatically inserted.
   */
  char(offset: number) {
    if (offset < this.lineOffset) {
      // Character is before current line
      let line = this.line.lineNumber

      while (offset < this.lineOffset) {
        if (line === 0)
          return undefined

        this.line = this.doc.lineAt(--line)
        this.lineOffset -= this.line.text.length + 1
        this.lineEnd = this.lineOffset + this.line.text.length + 1
      }
    } else if (offset > this.lineEnd) {
      // Character is after current line
      let line = this.line.lineNumber
      let lastLine = this.doc.lineCount

      while (offset > this.lineOffset) {
        if (line === lastLine - 1)
          return undefined

        this.lineOffset += this.line.text.length + 1
        this.line = this.doc.lineAt(++line)
        this.lineEnd = this.lineOffset + this.line.text.length + 1
      }
    }

    // Character is in the right range
    return this.line.text[offset - this.lineOffset] || '\n'
  }

  /**
   * Returns the position of the character at the given offset with respect to the originally
   * provided origin.
   */
  position(offset: number) {
    if (this.char(offset) === undefined) // Update current line to make sure lineOffset corresponds to given offset
      // Return if invalid offset
      return undefined

    return new vscode.Position(this.line.lineNumber, offset - this.lineOffset)
  }
}
