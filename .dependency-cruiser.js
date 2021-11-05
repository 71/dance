/** @type import("dependency-cruiser").IConfiguration */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "api-only-depends-on-api-and-utils",
      severity: "error",
      from: {
        path: "^src/api/(?!index)",
      },
      to: {
        pathNot: "^src/(api/(?!index)|utils)",
      },
    },
    {
      name: "api/index-only-depends-on-api",
      severity: "error",
      from: {
        path: "^src/api/index",
      },
      to: {
        pathNot: "^src/api",
      },
    },
    {
      name: "only-api-depends-on-api",
      severity: "error",
      from: {
        pathNot: "^src/api",
      },
      to: {
        path: "^src/api/(?!index)",
      },
    },
    {
      name: "commands-do-not-depend-on-each-other",
      severity: "error",
      from: {
        path: "^src/commands(?!/load-all)",
      },
      to: {
        path: "^src/commands",
      },
    },
    {
      name: "utils-only-depends-on-utils",
      severity: "error",
      from: {
        path: "^src/utils",
      },
      to: {
        pathNot: "^src/(utils|state/recorder)",  // exception for state/recorder.ts
      },
    },
    {
      name: "only-tests-depend-on-tests",
      severity: "error",
      from: {
        pathNot: "^test",
      },
      to: {
        path: "^test",
      },
    },
    {
      name: "no-orphans",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$", // dot files
          "\\.d\\.ts$",                            // TypeScript declaration files
          "(^|/)tsconfig\\.json$",                 // TypeScript config
          "meta\\.ts$|\\.build\\.ts$",  // build files
        ],
      },
      to: {},
    },
  ],

  options: {
    exclude : {
      path: "\\.build\\.ts$",
    },
    includeOnly : "^src",

    tsConfig: {
      fileName: "tsconfig.json",
    },
    tsPreCompilationDeps: false,
  },
};
