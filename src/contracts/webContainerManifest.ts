import { z } from 'zod';

const commandSchema = z.array(z.string().min(1)).min(1);

export const SkipoWebContainerManifestSchema = z.object({
  version: z.literal(1).default(1),
  workspaceRoot: z.string().min(1).default('/workspace'),
  packageManager: z.enum(['pnpm', 'npm', 'yarn']).default('pnpm'),
  commands: z.object({
    install: commandSchema.optional(),
    dev: commandSchema.optional(),
    lint: commandSchema.optional(),
    test: commandSchema.optional(),
    build: commandSchema.optional(),
    validate: commandSchema.optional(),
  }).default({}),
});

export type SkipoWebContainerManifest = z.infer<typeof SkipoWebContainerManifestSchema>;
export type SkipoPackageMetadata = {
  packageManager?: string;
  scripts?: Record<string, string>;
};

function packageManagerOf(value?: string): 'pnpm' | 'npm' | 'yarn' {
  const name = value?.split('@')[0];
  return name === 'npm' || name === 'yarn' ? name : 'pnpm';
}

function scriptCommand(manager: 'pnpm' | 'npm' | 'yarn', script: string) {
  return manager === 'npm' ? ['npm', 'run', script] : [manager, script];
}

export function resolveSkipoWebContainerManifest(
  metadata: SkipoPackageMetadata,
  input: Partial<SkipoWebContainerManifest> = {},
): SkipoWebContainerManifest {
  const manager = input.packageManager ?? packageManagerOf(metadata.packageManager);
  const scripts = metadata.scripts ?? {};
  const commands = {
    install: input.commands?.install ?? (manager === 'npm' ? ['npm', 'install'] : [manager, 'install', '--no-frozen-lockfile']),
    dev: input.commands?.dev ?? [...scriptCommand(manager, 'dev'), ...(manager === 'npm' ? ['--'] : []), '--host', '0.0.0.0'],
    lint: input.commands?.lint ?? (scripts.lint ? scriptCommand(manager, 'lint') : undefined),
    test: input.commands?.test ?? (scripts.test ? scriptCommand(manager, 'test') : undefined),
    build: input.commands?.build ?? (scripts.build ? scriptCommand(manager, 'build') : undefined),
    validate: input.commands?.validate ?? (scripts.validate ? scriptCommand(manager, 'validate') : scripts.lint ? scriptCommand(manager, 'lint') : undefined),
  };
  return SkipoWebContainerManifestSchema.parse({
    ...input,
    packageManager: manager,
    commands,
  });
}
