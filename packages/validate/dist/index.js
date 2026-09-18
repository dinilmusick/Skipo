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
  serverlessDeploymentBudgetRule,
  themeTokenSemanticsRule,
  topLevelPurityRule,
  uiInvariantsRule
} from "./chunk-7I23YNF3.js";

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
  serverlessDeploymentBudgetRule,
  themeTokenSemanticsRule,
  topLevelPurityRule,
  uiInvariantsRule,
  validate
};
