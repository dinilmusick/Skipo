export * from './validator/index.js';
import { SkipoValidator } from './validator/SkipoValidator.js';

export function validate(rootDir: string) {
  const validator = new SkipoValidator({ rootDir });
  return validator.validate();
}
