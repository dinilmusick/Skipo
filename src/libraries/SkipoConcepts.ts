/**
 * @file SkipoConcepts.ts
 * @description Root Application Concepts Facade for Skipo.
 * Aggregates all individual <library-name>_concepts facades into a single app-level surface.
 * Available to both frontend and backend code assets.
 * Conforms to L7 and L9 (Lines <= 200).
 */

import {
  composition_concepts,
  createCompositionManifest,
  validateCompositionIntegrity,
  type AppCompositionDescriptor,
  type CompositionValidationResult,
} from './composition_concepts/composition_concepts.js';

export {
  composition_concepts,
  createCompositionManifest,
  validateCompositionIntegrity,
  type AppCompositionDescriptor,
  type CompositionValidationResult,
};

export const SkipoConcepts = {
  composition: composition_concepts,
  composition_concepts,
} as const;

export default SkipoConcepts;
