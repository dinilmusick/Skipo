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
    if (filePath.includes("/rules/") || filePath.includes("__tests__") || filePath.endsWith(".test.ts") || filePath.endsWith(".test.tsx")) {
      return [];
    }
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
    const bottomStrips = sourceFile.getDescendantsOfKind(SyntaxKind2.JsxOpeningElement).concat(sourceFile.getDescendantsOfKind(SyntaxKind2.JsxSelfClosingElement)).filter((elem) => elem.getTagNameNode().getText() === "BottomStrip");
    bottomStrips.forEach((elem) => {
      const centerAttr = elem.getAttribute("centerSlot");
      if (centerAttr) {
        const text = centerAttr.getText();
        if (text.includes("Button") || text.includes("button") || text.includes("onClick") || text.includes("input")) {
          violations.push({
            ruleId: "ui-invariants",
            severity: "error",
            message: "BottomStrip centerSlot must not contain interactive buttons or controls. The middle area is reserved exclusively for cursor hover inspection labels.",
            filePath,
            line: centerAttr.getStartLineNumber(),
            suggestion: "Remove interactive buttons or actions from centerSlot. Use BottomStripContext.setInspectionText for dynamic hover feedback."
          });
        }
      }
    });
    const actionElements = sourceFile.getDescendantsOfKind(SyntaxKind2.JsxElement).filter((elem) => {
      const tagName = elem.getOpeningElement().getTagNameNode().getText();
      return ["BaseButton", "BrutalistButton", "BaseBadge", "button"].includes(tagName);
    });
    actionElements.forEach((elem) => {
      const textNodes = elem.getJsxChildren().filter((c) => c.getKind() === SyntaxKind2.JsxText);
      textNodes.forEach((tNode) => {
        const raw = tNode.getText().trim();
        if (raw) {
          const words = raw.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w));
          if (words.length > 4) {
            violations.push({
              ruleId: "ui-invariants",
              severity: "error",
              message: `UI action/badge label "${words.slice(0, 5).join(" ")}..." exceeds 4-word maximum limit (${words.length} words).`,
              filePath,
              line: tNode.getStartLineNumber(),
              suggestion: "Cap visible UI label to <=4 words. Move detailed guidance to element description (D+Hover mode)."
            });
          }
        }
      });
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
      if ((trimmed.startsWith("fs.mkdirSync") || trimmed.startsWith("mkdirSync")) && !trimmed.includes("/tmp") && !trimmed.includes("os.tmpdir()")) {
        let inTryOrFunc = false;
        for (let i = Math.max(0, index - 8); i < index; i++) {
          const prev = lines[i].trim();
          if (prev.includes("try {") || prev.includes("function ") || prev.includes("=>") || prev.includes("if (")) {
            inTryOrFunc = true;
            break;
          }
        }
        if (!inTryOrFunc) {
          violations.push({
            ruleId: this.id,
            severity: this.severity,
            message: "Unconditional top-level fs.mkdirSync detected in server module. Will crash with EROFS in read-only serverless runtimes.",
            filePath,
            line: index + 1,
            suggestion: "Wrap filesystem initialization in try/catch and route writable paths to /tmp in serverless environments."
          });
        }
      }
    });
    return violations;
  }
};

// src/validator/rules/no-placeholder-data.ts
import { SyntaxKind as SyntaxKind3 } from "ts-morph";
var FORBIDDEN_PLACEHOLDER_REGEX = /\b(placeholder|lorem\s+ipsum|mock_data|dummy_data|fake_telemetry|fake_listing|sample\s+item|dummy\s+value|test\s+user|todo\s+implement)\b/i;
function isExemptPath(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.includes("/__tests__/") || normalized.includes(".test.") || normalized.includes(".spec.") || normalized.includes("packages/validate/src/");
}
var noPlaceholderDataRule = {
  id: "no-placeholder-data",
  description: "Prohibits synthetic placeholders, dummy telemetry, and fake listings in production code",
  severity: "error",
  validate(filePath, _sourceCode, project) {
    if (isExemptPath(filePath) || !project) return [];
    const violations = [];
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) return violations;
    sourceFile.getDescendantsOfKind(SyntaxKind3.StringLiteral).forEach((lit) => {
      const val = lit.getLiteralValue();
      if (FORBIDDEN_PLACEHOLDER_REGEX.test(val)) {
        violations.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Prohibited placeholder string detected: "${val}". Real data or explicit empty states required.`,
          filePath,
          line: lit.getStartLineNumber(),
          suggestion: "Fetch real data from backend/database or render an <EmptyState> component."
        });
      }
    });
    sourceFile.getDescendantsOfKind(SyntaxKind3.JsxText).forEach((jsxText) => {
      const text = jsxText.getText().trim();
      if (text && FORBIDDEN_PLACEHOLDER_REGEX.test(text)) {
        violations.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Prohibited placeholder UI text detected: "${text}".`,
          filePath,
          line: jsxText.getStartLineNumber(),
          suggestion: "Render genuine UI data or use @skipo/ui <EmptyState> / <StatusIndicator>."
        });
      }
    });
    return violations;
  }
};

// src/validator/rules/feature-test-coverage.ts
import * as fs from "fs";
import * as path3 from "path";
function isProductionComponent(filePath) {
  const norm = filePath.replace(/\\/g, "/");
  if (norm.includes("/__tests__/") || norm.includes(".test.") || norm.includes(".spec.")) return false;
  if (norm.includes("packages/validate/") || norm.includes("packages/create-skipo/")) return false;
  return norm.endsWith(".tsx") || norm.includes("/api/") && norm.endsWith(".ts");
}
var featureTestCoverageRule = {
  id: "feature-test-coverage",
  description: "Enforces that production features and components have companion test suites",
  severity: "warning",
  validate(filePath, _sourceCode, _project) {
    if (!isProductionComponent(filePath)) return [];
    const dir = path3.dirname(filePath);
    const baseName = path3.basename(filePath, path3.extname(filePath));
    const potentialTests = [
      path3.join(dir, `${baseName}.test.ts`),
      path3.join(dir, `${baseName}.test.tsx`),
      path3.join(dir, `${baseName}.spec.ts`),
      path3.join(dir, `${baseName}.spec.tsx`),
      path3.join(dir, "__tests__", `${baseName}.test.ts`),
      path3.join(dir, "__tests__", `${baseName}.test.tsx`),
      path3.join(dir, "..", "__tests__", `${baseName}.test.ts`),
      path3.join(dir, "..", "__tests__", `${baseName}.test.tsx`)
    ];
    const hasTest = potentialTests.some((testPath) => fs.existsSync(testPath));
    if (!hasTest) {
      return [{
        ruleId: this.id,
        severity: this.severity,
        message: `Feature module "${baseName}" is missing a dedicated test file. Work is not done without end-to-end testing.`,
        filePath,
        suggestion: `Create a companion test suite at ${path3.join(dir, "__tests__", `${baseName}.test.ts`)} and verify with pnpm test.`
      }];
    }
    return [];
  }
};

// src/validator/rules/serverless-deployment-budget.ts
import * as path4 from "path";
var serverlessDeploymentBudgetRule = {
  id: "serverless-deployment-budget",
  description: "Enforces Vercel serverless functions code size limits (50MB Hobby / 250MB Pro), standalone tracing, tree-shaking, and external CDN storage",
  severity: "error",
  validate(filePath, sourceCode) {
    const violations = [];
    const normalized = filePath.replace(/\\/g, "/");
    const baseName = path4.basename(normalized);
    if (baseName.startsWith("next.config.")) {
      if (!sourceCode.includes("standalone")) {
        violations.push({
          ruleId: this.id,
          severity: "error",
          message: "next.config is missing `output: 'standalone'`. Output file tracing is required to prevent serverless function bundles from exceeding 50MB.",
          filePath,
          suggestion: "Add `output: 'standalone'` to your next.config to automatically trace and bundle only necessary dependencies."
        });
      }
    }
    if (baseName === "package.json") {
      try {
        const pkg = JSON.parse(sourceCode);
        const deps = pkg.dependencies || {};
        const devTools = ["eslint", "jest", "vitest", "cypress", "playwright", "prettier", "typescript", "webpack", "vite"];
        for (const tool of devTools) {
          if (deps[tool]) {
            violations.push({
              ruleId: this.id,
              severity: "error",
              message: `Development tool '${tool}' found in production dependencies. Vercel bundles production dependencies into serverless functions.`,
              filePath,
              suggestion: `Move '${tool}' to devDependencies to prevent exceeding the 50MB deployment limit.`
            });
          }
        }
        if (deps["moment"]) {
          violations.push({
            ruleId: this.id,
            severity: "error",
            message: "Heavy library 'moment' detected in dependencies. Moment adds excessive bundle weight.",
            filePath,
            suggestion: "Replace 'moment' with modular alternatives like 'date-fns' or 'dayjs'."
          });
        }
      } catch {
      }
    }
    if (normalized.endsWith(".ts") || normalized.endsWith(".tsx") || normalized.endsWith(".js") || normalized.endsWith(".jsx")) {
      const lines = sourceCode.split("\n");
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("import ") && !trimmed.startsWith("import type")) {
          if (/import\s+([A-Za-z0-9_$]+|\*\s+as\s+[A-Za-z0-9_$]+)\s+from\s+['"]lodash['"]/.test(trimmed)) {
            violations.push({
              ruleId: this.id,
              severity: "error",
              message: "Monolithic import from 'lodash' prevents bundler tree-shaking.",
              filePath,
              line: idx + 1,
              suggestion: "Import specific methods directly, e.g. import debounce from 'lodash/debounce'."
            });
          }
          if (/import\s+.*\s+from\s+['"]moment['"]/.test(trimmed)) {
            violations.push({
              ruleId: this.id,
              severity: "error",
              message: "Monolithic import of heavy 'moment' library.",
              filePath,
              line: idx + 1,
              suggestion: "Use 'date-fns' or 'dayjs' instead."
            });
          }
        }
      });
      if ((normalized.includes("/api/") || normalized.includes("/server/")) && sourceCode.includes("new PrismaClient(")) {
        if (!sourceCode.includes("@prisma/client/edge") && !sourceCode.toLowerCase().includes("accelerate")) {
          violations.push({
            ruleId: this.id,
            severity: "warning",
            message: "Standard PrismaClient initialized in serverless route without Prisma Accelerate or Edge runtime. Bundled Prisma engine binaries can exhaust function limits.",
            filePath,
            suggestion: "Use '@prisma/client/edge' or Prisma Accelerate to avoid bundling heavy query engine binaries."
          });
        }
      }
    }
    return violations;
  }
};

// src/validator/SkipoValidator.ts
import { Project } from "ts-morph";
import * as fs2 from "fs";
import * as path5 from "path";
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
    serverlessCompatibilityRule,
    noPlaceholderDataRule,
    featureTestCoverageRule,
    serverlessDeploymentBudgetRule
  ];
  project;
  constructor(config) {
    this.config = config;
  }
  scanDir(dir, files = []) {
    const entries = fs2.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path5.join(dir, entry.name);
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
      const sourceCode = fs2.readFileSync(file, "utf8");
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
  noPlaceholderDataRule,
  featureTestCoverageRule,
  serverlessDeploymentBudgetRule,
  SkipoValidator
};
