import {
  SkipoValidator,
  baseClassUsageRule,
  featureTestCoverageRule,
  fileLineLimitRule,
  gitIgnoreAnchoringRule,
  helperLineLimitRule,
  importSuffixRule,
  mainDelegationRule,
  noPlaceholderDataRule,
  noPollingRule,
  oneComponentRule,
  serverlessCompatibilityRule,
  themeTokenSemanticsRule,
  topLevelPurityRule,
  uiInvariantsRule
} from "./chunk-H4HZE2XW.js";

// src/index.ts
function validate(rootDir) {
  const validator = new SkipoValidator({ rootDir });
  return validator.validate();
}
export {
  SkipoValidator,
  baseClassUsageRule,
  featureTestCoverageRule,
  fileLineLimitRule,
  gitIgnoreAnchoringRule,
  helperLineLimitRule,
  importSuffixRule,
  mainDelegationRule,
  noPlaceholderDataRule,
  noPollingRule,
  oneComponentRule,
  serverlessCompatibilityRule,
  themeTokenSemanticsRule,
  topLevelPurityRule,
  uiInvariantsRule,
  validate
};
