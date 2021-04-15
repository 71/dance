// Experiment: run
//   (await import("/path/to/dance/assets/evil.js")).defineCommand(require)
// in the devtools to register the "dance.tokenize" command.
// It can then be used from extensions to query TextMate tokens for a line range
// from the editor. I wish I could use this to improve object selection, but
// this probably won't happen. Oh well.
export const defineCommand = (require) => {
  const { CommandsRegistry } = require("vs/platform/commands/common/commands");
  const { IModelService }    = require("vs/editor/common/services/modelService");
  const { ITextMateService } = require("vs/workbench/services/textMate/common/textMateService");

  CommandsRegistry.registerCommand(
    "dance.tokenize",
    async (accessor, resource, startLine, endLine = startLine) => {
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
  );
};
