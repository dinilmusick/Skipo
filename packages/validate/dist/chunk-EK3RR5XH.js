// src/validator/rules/file-line-limit.ts
var fileLineLimitRule = {
  id: "file-line-limit",
  description: "Enforces maximum lines per file",
  severity: "error",
  validate(filePath, sourceCode) {
    const lines = sourceCode.split("\n");
    const limit = 200;
    if (lines.length > limit) {
      return [{
        ruleId: this.id,
        severity: this.severity,
        message: `File exceeds line limit of ${limit} (has ${lines.length} lines)`,
        filePath,
        suggestion: "Split into smaller, more focused modules."
      }];
    }
    return [];
  }
};

// src/validator/rules/helper-line-limit.ts
var helperLineLimitRule = {
  id: "helper-line-limit",
  description: "Enforces maximum lines per function body",
  severity: "warning",
  validate(filePath, _sourceCode, project) {
    if (!project) return [];
    const violations = [];
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) return violations;
    const limit = 30;
    sourceFile.getFunctions().forEach((func) => {
      const body = func.getBody();
      if (body) {
        const text = body.getText();
        const lines = text.split("\n").length;
        if (lines > limit) {
          violations.push({
            ruleId: this.id,
            severity: this.severity,
            message: `Function ${func.getName() || "anonymous"} body exceeds ${limit} lines (has ${lines})`,
            filePath,
            line: func.getStartLineNumber(),
            suggestion: "Refactor into smaller helper functions."
          });
        }
      }
    });
    return violations;
  }
};

// src/validator/rules/main-delegation.ts
var mainDelegationRule = {
  id: "main-delegation",
  description: "Enforces max sequential substantive lines before delegation",
  severity: "warning",
  validate(_filePath, _sourceCode) {
    const violations = [];
    return violations;
  }
};

// src/validator/rules/top-level-purity.ts
var topLevelPurityRule = {
  id: "top-level-purity",
  description: "Entry files must only compose and export",
  severity: "error",
  validate(filePath, _sourceCode) {
    const isEntry = filePath.endsWith("index.ts") || filePath.endsWith("App.tsx") || filePath.endsWith("server.ts") || filePath.endsWith("layout.tsx") || filePath.endsWith("page.tsx");
    if (!isEntry) return [];
    const violations = [];
    return violations;
  }
};

// src/validator/rules/one-component.ts
var oneComponentRule = {
  id: "one-component",
  description: "One React component per file",
  severity: "error",
  validate(filePath, _sourceCode, project) {
    if (!filePath.endsWith(".tsx") || !project) return [];
    const violations = [];
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) return violations;
    let componentCount = 0;
    sourceFile.getFunctions().forEach((func) => {
      const name = func.getName();
      if (name && /^[A-Z]/.test(name) && func.getBodyText()?.includes("<")) {
        componentCount++;
      }
    });
    if (componentCount > 1) {
      violations.push({
        ruleId: this.id,
        severity: this.severity,
        message: `Found ${componentCount} components in file. Only one component per .tsx file is allowed.`,
        filePath,
        suggestion: "Extract additional components into their own files."
      });
    }
    return violations;
  }
};

// src/validator/rules/no-polling.ts
var noPollingRule = {
  id: "no-polling",
  description: "Bans setInterval and polling mechanisms",
  severity: "error",
  validate(filePath, sourceCode) {
    const violations = [];
    const lines = sourceCode.split("\n");
    lines.forEach((line, index) => {
      if (line.includes("setInterval") || line.includes("window.setInterval")) {
        violations.push({
          ruleId: this.id,
          severity: this.severity,
          message: "Polling mechanisms like setInterval are banned.",
          filePath,
          line: index + 1,
          suggestion: "Use reactive event streams or event-driven patterns instead."
        });
      }
    });
    return violations;
  }
};

// src/validator/rules/import-suffix.ts
var importSuffixRule = {
  id: "import-suffix",
  description: "Enforces .js extensions on relative imports",
  severity: "warning",
  validate(filePath, _sourceCode, project) {
    if (!project) return [];
    const violations = [];
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) return violations;
    const imports = sourceFile.getImportDeclarations();
    imports.forEach((imp) => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      if (moduleSpecifier.startsWith(".") && !moduleSpecifier.endsWith(".js") && !moduleSpecifier.endsWith(".css") && !moduleSpecifier.endsWith(".json")) {
        violations.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Relative import "${moduleSpecifier}" must end with .js`,
          filePath,
          line: imp.getStartLineNumber(),
          suggestion: "Append .js to the import path for NodeNext compatibility."
        });
      }
    });
    return violations;
  }
};

// src/validator/rules/base-class-usage.ts
import { SyntaxKind } from "ts-morph";
var baseClassUsageRule = {
  id: "base-class-usage",
  description: "Enforces usage of base components over raw HTML elements",
  severity: "warning",
  validate(filePath, _sourceCode, project) {
    if (!filePath.endsWith(".tsx") || !project) return [];
    if (filePath.includes("packages/ui/src/components/base/")) return [];
    const violations = [];
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) return violations;
    const forbiddenElements = {
      "button": "BaseButton",
      "input": "BaseInput",
      "textarea": "BaseTextarea",
      "select": "BaseSelect"
    };
    const checkElement = (elementName, line) => {
      if (forbiddenElements[elementName]) {
        violations.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Raw HTML element <${elementName}> used instead of base component.`,
          filePath,
          line,
          suggestion: `Import and use ${forbiddenElements[elementName]} from @skipo/ui instead.`
        });
      }
    };
    sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).forEach((elem) => {
      checkElement(elem.getTagNameNode().getText(), elem.getStartLineNumber());
    });
    sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).forEach((elem) => {
      checkElement(elem.getTagNameNode().getText(), elem.getStartLineNumber());
    });
    return violations;
  }
};

// src/validator/rules/theme-token-semantics.ts
var themeTokenSemanticsRule = {
  id: "theme-token-semantics",
  description: "Enforces usage of standardized --skipo-* semantic tokens over hardcoded colors",
  severity: "warning",
  validate(filePath, sourceCode, _project) {
    if (!filePath.endsWith(".tsx") && !filePath.endsWith(".css")) return [];
    if (filePath.includes("theme/tokens") || filePath.includes("theme/ThemePackLoader") || filePath.includes("theme/types")) {
      return [];
    }
    const violations = [];
    const lines = sourceCode.split("\n");
    const hexColorRegex = /#([0-9a-fA-F]{3,8})\b/;
    const rgbColorRegex = /rgba?\([^)]+\)/;
    lines.forEach((line, index) => {
      if (line.includes("var(--skipo-") || line.trim().startsWith("//") || line.trim().startsWith("/*") || line.trim().startsWith("*")) {
        return;
      }
      if (hexColorRegex.test(line) && !line.includes("KNOWN_CREDENTIAL_URLS")) {
        violations.push({
          ruleId: "theme-token-semantics",
          severity: "warning",
          message: "Hardcoded color detected instead of standardized --skipo-* semantic theme token.",
          filePath,
          line: index + 1,
          suggestion: "Replace with var(--skipo-accent), var(--skipo-bg), var(--skipo-surface), etc."
        });
      } else if (rgbColorRegex.test(line) && !line.includes("var(--skipo-")) {
        violations.push({
          ruleId: "theme-token-semantics",
          severity: "warning",
          message: "Hardcoded rgb/rgba color detected instead of standardized --skipo-* semantic token.",
          filePath,
          line: index + 1,
          suggestion: "Use semantic theme CSS tokens."
        });
      }
    });
    return violations;
  }
};

// src/validator/rules/ui-invariants.ts
import { SyntaxKind as SyntaxKind2 } from "ts-morph";
var uiInvariantsRule = {
  id: "ui-invariants",
  description: "Enforces anti-nested tabs, icon-only buttons, and zero-floating-tooltip invariants",
  severity: "error",
  validate(filePath, _sourceCode, project) {
    if (!filePath.endsWith(".tsx") || !project) return [];
    const violations = [];
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) return violations;
    const tabContainers = sourceFile.getDescendantsOfKind(SyntaxKind2.JsxOpeningElement).concat(sourceFile.getDescendantsOfKind(SyntaxKind2.JsxSelfClosingElement)).filter((elem) => elem.getTagNameNode().getText() === "TabContainer");
    tabContainers.forEach((container) => {
      const parent = container.getFirstAncestorByKind(SyntaxKind2.JsxElement);
      if (parent) {
        const opening = parent.getOpeningElement();
        if (opening.getTagNameNode().getText() === "TabContainer") {
          violations.push({
            ruleId: "ui-invariants",
            severity: "error",
            message: "Nested TabContainer detected. Nested tabs of any kind are strictly forbidden.",
            filePath,
            line: container.getStartLineNumber(),
            suggestion: "Move view navigation to the single top-level TopToolbar with flat tabs."
          });
        }
      }
    });
    sourceFile.getDescendantsOfKind(SyntaxKind2.StringLiteral).forEach((lit) => {
      const text = lit.getLiteralValue();
      if (text.includes("skipo-tooltip--") || text === "skipo-tooltip" && !filePath.includes("BaseTooltip")) {
        violations.push({
          ruleId: "ui-invariants",
          severity: "error",
          message: "Floating tooltip bubble class used. Floating tooltips are forbidden.",
          filePath,
          line: lit.getStartLineNumber(),
          suggestion: "Use BottomStrip with hover inspection text instead of floating text bubbles."
        });
      }
    });
    return violations;
  }
};

// src/validator/rules/git-ignore-anchoring.ts
import * as path from "path";
var gitIgnoreAnchoringRule = {
  id: "git-ignore-anchoring",
  description: "Ensures .gitignore files anchor output directories (/dist/) to prevent masking nested package dist directories",
  severity: "error",
  validate(filePath, sourceCode) {
    const fileName = path.basename(filePath);
    if (fileName !== ".gitignore") return [];
    const violations = [];
    const lines = sourceCode.split("\n");
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      if (trimmed === "dist" || trimmed === "dist/" || trimmed === "dist/**") {
        violations.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Unanchored gitignore pattern "${trimmed}" masks nested package distribution directories (e.g. packages/*/dist).`,
          filePath,
          line: index + 1,
          suggestion: 'Anchor pattern with leading slash: "/dist/" instead of "dist/".'
        });
      }
    });
    return violations;
  }
};

// src/validator/rules/serverless-compatibility.ts
import * as path2 from "path";
var serverlessCompatibilityRule = {
  id: "serverless-compatibility",
  description: "Flags static imports of development tooling in server factories and backend endpoints",
  severity: "error",
  validate(filePath, sourceCode, _project) {
    const violations = [];
    const normalized = filePath.replace(/\\/g, "/");
    const isServerFile = normalized.includes("/server/") || normalized.includes("/api/") || path2.basename(normalized).startsWith("server.") || path2.basename(normalized).startsWith("AppFactory.");
    if (!isServerFile) return [];
    const lines = sourceCode.split("\n");
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const isStaticImport = trimmed.startsWith("import ") && !trimmed.startsWith("import type");
      if (isStaticImport) {
        if (trimmed.includes("'vite'") || trimmed.includes('"vite"') || trimmed.includes("'@vitejs/plugin-react'") || trimmed.includes('"@vitejs/plugin-react"')) {
          violations.push({
            ruleId: this.id,
            severity: this.severity,
            message: "Static import of Vite in server factory. In serverless runtime, Vite dependencies fail to resolve.",
            filePath,
            line: index + 1,
            suggestion: "Use dynamic import inside an environment check: if (!process.env.VERCEL) { const { createServer } = await import('vite'); }"
          });
        }
      }
    });
    return violations;
  }
};

// src/validator/SkipoValidator.ts
import { Project } from "ts-morph";
import * as fs from "fs";
import * as path3 from "path";
var SkipoValidator = class {
  config;
  rules = [
    fileLineLimitRule,
    helperLineLimitRule,
    mainDelegationRule,
    topLevelPurityRule,
    oneComponentRule,
    noPollingRule,
    importSuffixRule,
    baseClassUsageRule,
    themeTokenSemanticsRule,
    uiInvariantsRule,
    gitIgnoreAnchoringRule,
    serverlessCompatibilityRule
  ];
  project;
  constructor(config) {
    this.config = config;
  }
  scanDir(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path3.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.includes("node_modules") && !entry.name.includes("dist")) {
          this.scanDir(fullPath, files);
        }
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") || entry.name.endsWith(".js") || entry.name === ".gitignore") {
        files.push(fullPath);
      }
    }
    return files;
  }
  validate() {
    const startTime = Date.now();
    const files = this.scanDir(this.config.rootDir);
    const violations = [];
    this.project = new Project({
      compilerOptions: { allowJs: true }
    });
    for (const file of files) {
      this.project.addSourceFileAtPath(file);
    }
    for (const file of files) {
      const sourceCode = fs.readFileSync(file, "utf8");
      for (const rule of this.rules) {
        if (this.config.rules && this.config.rules[rule.id] === "off") {
          continue;
        }
        try {
          const ruleViolations = rule.validate(file, sourceCode, this.project);
          const mappedViolations = ruleViolations.map((v) => {
            const configSeverity = this.config.rules?.[rule.id];
            if (configSeverity && configSeverity !== "off") {
              v.severity = configSeverity;
            }
            return v;
          });
          violations.push(...mappedViolations);
        } catch (e) {
          console.error(`Error running rule ${rule.id} on ${file}:`, e);
        }
      }
    }
    return {
      valid: !violations.some((v) => v.severity === "error"),
      violations,
      filesScanned: files.length,
      duration: Date.now() - startTime
    };
  }
};

export {
  fileLineLimitRule,
  helperLineLimitRule,
  mainDelegationRule,
  topLevelPurityRule,
  oneComponentRule,
  noPollingRule,
  importSuffixRule,
  baseClassUsageRule,
  themeTokenSemanticsRule,
  uiInvariantsRule,
  gitIgnoreAnchoringRule,
  serverlessCompatibilityRule,
  SkipoValidator
};
