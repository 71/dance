"use strict";

const commands = {
  isFolded: {
    dependencies: [
      "vs/editor/browser/services/codeEditorService",
      "vs/editor/contrib/folding/browser/folding",
    ],
    async run({ ICodeEditorService }, { FoldingController }, accessor, line) {
      // Convert position from 0-indexing to 1-indexing.
      line++;

      // Find active editor.
      const codeEditorService = accessor.get(ICodeEditorService),
            codeEditor = codeEditorService.getActiveCodeEditor();

      if (codeEditor == null) {
        return;
      }

      // Find folding information for the editor.
      const foldingController = FoldingController.get(codeEditor);

      if (foldingController == null) {
        return;
      }

      return foldingController.hiddenRangeModel?.isHidden(line);
    },
  },
  tokenizeLines: {
    dependencies: [
      "vs/editor/common/services/modelService",
      "vs/workbench/services/textMate/browser/textMate",
    ],
    async run({ IModelService }, { ITextMateService }, accessor, resource, startLine, endLine = startLine) {
      // Convert line numbers from 0-indexing to 1-indexing.
      startLine++;
      endLine++;

      // Find model for specified document.
      const modelService = accessor.get(IModelService),
            model = modelService.getModel(resource);

      if (model == null) {
        return;
      }

      // Find grammar for specified document.
      const textMateService = accessor.get(ITextMateService),
            language = model.getLanguageIdentifier().language,
            grammar = await textMateService.createGrammar(language);

      if (grammar == null) {
        return;
      }

      // Set-up state for the first line of the range.
      let state = null;

      for (let i = 1; i < startLine; i++) {
        state = grammar.tokenizeLine(model.getLineContent(i), state).ruleStack;
      }

      // Tokenize lines in given range and add them to the result.
      const tokenizedLines = [];

      for (let i = startLine; i <= endLine; i++) {
        const tokenizationResult = grammar.tokenizeLine(model.getLineContent(i), state);

        tokenizedLines.push(tokenizationResult.tokens);
        state = tokenizationResult.ruleStack;
      }

      return tokenizedLines;
    },
  },
};

try {
  const { CommandsRegistry } = require("vs/platform/commands/common/commands");

  for (const shortId in commands) {
    const id = `dance.evil.${shortId}`,
          { dependencies, run } = commands[shortId];

    try {
      define(dependencies, (...dependencies) => {
        CommandsRegistry.registerCommand(id, async (...args) => await run(...dependencies, ...args));
      });
    } catch (e) {
      console.error(`cannot register ${id}:`, e);
    }
  }

  console.log("evil Dance loaded");
} catch (e) {
  console.error("cannot load evil Dance:", e);
}
