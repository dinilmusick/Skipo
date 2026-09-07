import {
  SkipoValidator,
  baseClassUsageRule,
  fileLineLimitRule,
  gitIgnoreAnchoringRule,
  helperLineLimitRule,
  importSuffixRule,
  mainDelegationRule,
  noPollingRule,
  oneComponentRule,
  serverlessCompatibilityRule,
  themeTokenSemanticsRule,
  topLevelPurityRule,
  uiInvariantsRule
} from "./chunk-EK3RR5XH.js";

// src/index.ts
function validate(rootDir) {
  const validator = new SkipoValidator({ rootDir });
  return validator.validate();
}
export {
  SkipoValidator,
  baseClassUsageRule,
  fileLineLimitRule,
  gitIgnoreAnchoringRule,
  helperLineLimitRule,
  importSuffixRule,
  mainDelegationRule,
  noPollingRule,
  oneComponentRule,
  serverlessCompatibilityRule,
  themeTokenSemanticsRule,
  topLevelPurityRule,
  uiInvariantsRule,
  validate
};
