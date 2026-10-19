/**
 * @file validateCompositionIntegrity.ts
 * @description Single-asset pure function validating AppCompositionDescriptor integrity.
 * Conforms to L9 (Lines <= 200).
 */

import type { AppCompositionDescriptor, CompositionValidationResult } from './CompositionTypes.js';

export function validateCompositionIntegrity(
  descriptor: AppCompositionDescriptor
): CompositionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!descriptor) {
    return {
      valid: false,
      score: 0,
      errors: ['Composition descriptor is null or undefined.'],
      warnings: [],
      inspectedAt: Date.now(),
    };
  }

  if (!descriptor.appId) errors.push('Missing descriptor.appId');
  if (!descriptor.appName) errors.push('Missing descriptor.appName');

  const p = descriptor.planes;
  if (!p) {
    errors.push('Missing planes definition');
  } else {
    if (!p.frontend) errors.push('Missing plane: frontend');
    if (!p.backend) errors.push('Missing plane: backend');
    if (!p.libraries) errors.push('Missing plane: libraries');
    if (!p.frontendState) errors.push('Missing plane: frontendState');
  }

  if (!descriptor.conceptLibraries || descriptor.conceptLibraries.length === 0) {
    warnings.push('No concept libraries declared.');
  }

  const valid = errors.length === 0;
  const score = valid ? 100 : Math.max(0, 100 - errors.length * 25);

  return {
    valid,
    score,
    errors,
    warnings,
    inspectedAt: Date.now(),
  };
}
