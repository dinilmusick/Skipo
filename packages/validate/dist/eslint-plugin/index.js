// src/eslint-plugin/rules/file-line-limit.ts
var fileLineLimit = {
  meta: {
    type: "layout",
    docs: {
      description: "Enforces maximum lines per file"
    },
    schema: [
      {
        type: "object",
        properties: {
          max: { type: "number" }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const max = context.options[0]?.max || 200;
    return {
      Program(node) {
        const lines = context.sourceCode.lines;
        if (lines.length > max) {
          context.report({
            node,
            message: `File exceeds line limit of ${max} (has ${lines.length} lines).`
          });
        }
      }
    };
  }
};

// src/eslint-plugin/rules/one-component-per-file.ts
var oneComponentPerFile = {
  meta: {
    type: "problem",
    docs: {
      description: "One React component per file"
    },
    schema: []
  },
  create(context) {
    if (!context.filename.endsWith(".tsx")) return {};
    let componentCount = 0;
    return {
      FunctionDeclaration(node) {
        if (node.id && /^[A-Z]/.test(node.id.name)) {
          componentCount++;
        }
      },
      "Program:exit"(node) {
        if (componentCount > 1) {
          context.report({
            node,
            message: `Found ${componentCount} components. Only one component per .tsx file is allowed.`
          });
        }
      }
    };
  }
};

// src/eslint-plugin/rules/top-level-purity.ts
var topLevelPurity = {
  meta: {
    type: "problem",
    docs: {
      description: "Entry files must only compose and export"
    },
    schema: []
  },
  create(context) {
    const isEntry = context.filename.endsWith("index.ts") || context.filename.endsWith("App.tsx") || context.filename.endsWith("server.ts") || context.filename.endsWith("layout.tsx") || context.filename.endsWith("page.tsx");
    if (!isEntry) return {};
    return {
      // Simplified check for now
    };
  }
};

// src/eslint-plugin/rules/no-polling.ts
var noPolling = {
  meta: {
    type: "problem",
    docs: {
      description: "Bans setInterval and polling mechanisms"
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "setInterval" || node.callee.type === "MemberExpression" && node.callee.property.type === "Identifier" && node.callee.property.name === "setInterval") {
          context.report({
            node,
            message: "Polling mechanisms like setInterval are banned. Use event-driven patterns instead."
          });
        }
      }
    };
  }
};

// src/eslint-plugin/rules/import-suffix.ts
var importSuffix = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforces .js extensions on relative imports"
    },
    fixable: "code",
    schema: []
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (source.startsWith(".") && !source.endsWith(".js") && !source.endsWith(".json") && !source.endsWith(".css")) {
          context.report({
            node,
            message: `Relative import "${source}" must end with .js`,
            fix(fixer) {
              return fixer.replaceText(node.source, `'${source}.js'`);
            }
          });
        }
      }
    };
  }
};

// src/eslint-plugin/rules/helper-purity.ts
var helperPurity = {
  meta: {
    type: "layout",
    docs: {
      description: "Enforces maximum lines per function body"
    },
    schema: [
      {
        type: "object",
        properties: {
          max: { type: "number" }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const max = context.options[0]?.max || 30;
    function checkFunction(node) {
      if (!node.body || node.body.type !== "BlockStatement") return;
      const lines = node.body.loc.end.line - node.body.loc.start.line + 1;
      if (lines > max) {
        context.report({
          node,
          message: `Function body exceeds ${max} lines (has ${lines} lines).`
        });
      }
    }
    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction
    };
  }
};

// src/eslint-plugin/index.ts
var rules = {
  "file-line-limit": fileLineLimit,
  "one-component-per-file": oneComponentPerFile,
  "top-level-purity": topLevelPurity,
  "no-polling": noPolling,
  "import-suffix": importSuffix,
  "helper-purity": helperPurity
};
var configs = {
  recommended: {
    plugins: {
      "@skipo": { rules }
    },
    rules: {
      "@skipo/file-line-limit": ["error", { max: 200 }],
      "@skipo/one-component-per-file": "error",
      "@skipo/top-level-purity": "warn",
      "@skipo/no-polling": "error",
      "@skipo/import-suffix": "warn",
      "@skipo/helper-purity": ["warn", { max: 30 }]
    }
  }
};
var eslint_plugin_default = { rules, configs };
export {
  configs,
  eslint_plugin_default as default,
  rules
};
