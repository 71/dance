/** @type import("eslint").Linter.Config */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/eslint-recommended"],
  parserOptions: {
    ecmaVersion: 2019,
    sourceType: "module",
  },
  ignorePatterns: [
    "out/",
    "*.js",
    "tree-sitter-api.d.ts",
  ],
  overrides: [
    {
      files: ["commands/index.ts"],
      rules: {
        "max-len": "off",
      },
    },
    {
      files: ["test/suite/commands/*.ts"],
      rules: {
        "no-useless-escape": "off",
      },
    },
    {
      files: ["test/suite/commands/*-tabs.test.ts"],
      rules: {
        "no-tabs": "off",
      },
    },
  ],
  rules: {
    "indent": ["error", 2, {
      "CallExpression": { arguments: "first" },
      "FunctionDeclaration": { parameters: "first" },
      "FunctionExpression": { parameters: "first" },
      "VariableDeclarator": "first",
      "flatTernaryExpressions": true,
      "offsetTernaryExpressions": true,
      "ignoredNodes": [
        "TemplateLiteral *",
        "VariableDeclaration VariableDeclarator:first-child ObjectExpression",
      ],
    }],
    "curly": ["error", "all"],
    "dot-location": ["error", "property"],
    "eqeqeq": ["error", "always", { null: "ignore" }],
    "require-await": "error",
    "array-bracket-spacing": ["error", "never"],
    "block-scoped-var": "error",
    "block-spacing": ["error", "always"],
    "brace-style": ["error", "1tbs", { allowSingleLine: false }],
    "comma-dangle": ["error", "always-multiline"],
    "linebreak-style": ["error", "unix"],
    "max-len": [
      "warn",
      {
        code: 100,
        comments: 80,
        ignorePattern: "^ *(\\*|//) ([sS]ee )?http\\S+\\)?.?$|^ *// =+(  [^=]+  =+)?$|\|$",
      },
    ],
    "multiline-ternary": ["error", "always-multiline"],
    "no-tabs": "error",
    "no-trailing-spaces": "error",
    "no-unexpected-multiline": "error",
    "no-unneeded-ternary": "error",
    "object-curly-spacing": ["error", "always"],
    "operator-linebreak": ["error", "before", { overrides: { "=": "after" } }],
    "object-shorthand": "error",
    "quotes": ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],
    "semi": ["error", "always"],
    "sort-imports": [
      "error",
      {
        ignoreCase: true,
        ignoreDeclarationSort: true,
        memberSyntaxSortOrder: ["none", "all", "single", "multiple"],
      },
    ],
    "space-before-function-paren": "off",
    "space-before-blocks": "error",
    "space-infix-ops": "error",
    "unicode-bom": "error",
    "keyword-spacing": ["error", { before: true, after: true }],
    "no-unused-vars": "off",
    "no-case-declarations": "off",
    "no-cond-assign": "off",
    "@typescript-eslint/explicit-member-accessibility": ["error"],
    "@typescript-eslint/space-before-function-paren": [
      "error",
      { anonymous: "always", named: "never", asyncArrow: "always" },
    ],
  },
};
