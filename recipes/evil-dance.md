# Evil Dance

Evil Dance is a script that provides additional features to Dance by hooking
into the main process of VS Code and communicating with the instance of Dance
in the extension host.

It could bring nice features, but is and will remain unstable. Use at your own
risks.

## The script

Add the following code to `<path to VS Code>/resources/app/out/vs/loader.js`:

```js
// Since modules are loaded asynchronously, try to load the script below every
// second. After 10 failed tries, give up.
let danceRetries = 0;
let danceRetryToken = setInterval(() => {
	try {
		const { CommandsRegistry } = require("vs/platform/commands/common/commands");
		const { IModelService } = require("vs/editor/common/services/modelService");
		const { ITextMateService } = require("vs/workbench/services/textMate/common/textMateService");

		clearInterval(danceRetryToken);

		CommandsRegistry.registerCommand(
			"dance.tokenizeLines",
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
	} catch (e) {
		if (danceRetries++ === 10) {
      console.error("Could not register dance.tokenizeLines.", e);
			clearInterval(danceRetryToken);
		}
	}
}, 1000);
```

This will register a global command `dance.tokenizeLines` that will query the
internal VS Code state and return token information for the given lines in the
specified document. Right now, it's no used anywhere, but I could see myself
making commands that use this information to better find what should or should
not be selected.

The path to `loader.js` can be found by running the following code in the
developer tools of VS Code:

```js
path.join(process.resourcesPath, "app", "out", "vs", "loader.js")
```
