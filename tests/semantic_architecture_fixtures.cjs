'use strict';
// Named, writable positive, negative and adversarial TypeScript/React projects.
module.exports = {
  positive: {
    'package.json': '{"name":"sample-app"}',
    'tsconfig.json': '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]},"module":"NodeNext","moduleResolution":"NodeNext"}}',
    'src/frontend/page.tsx': `import { createLuthAuthClient } from '@ultrst-armada/kloks/auth';
import { BackendFacade } from '../backend/index.js';
import { formatThing } from '@/libraries/format';
// import { Fake } from '../backend/private';
export const Page = () => formatThing(BackendFacade) + String(createLuthAuthClient);`,
    'src/backend/index.ts': `export const BackendFacade = Object.freeze({});`,
    'src/libraries/format.ts': `export const formatThing = (x: unknown) => String(x);`,
    'src/frontend/WorkspaceDetails.tsx': `import { WorkspaceTileMenu } from '@ultrst-armada/floks';
export const WorkspaceDetails = () => String(WorkspaceTileMenu);`
  },
  negative: {
    'package.json': '{"name":"sample-app"}',
    'src/frontend/view.tsx': `import { secret } from '../backend/private';
import { S3Client } from '@aws-sdk/client-s3';
import { value } from '@ultrst-armada/kloks/src/private';
export const View = () => String(secret) + String(S3Client) + String(value);`,
    'src/backend/private.ts': `export const secret = 1;`,
    'src/backend/auth/Gate.ts': `import { betterAuth } from 'better-auth';
export const Gate = () => betterAuth({});`,
    'packages/a/package.json': '{"name":"package-a"}',
    'packages/a/src/index.ts': `import { b } from '../../b/src/index'; export const a = b;`,
    'packages/b/package.json': '{"name":"package-b"}',
    'packages/b/src/index.ts': `export const b = 1;`
  },
  adversarial: {
    'package.json': '{"name":"sample-app"}',
    'tsconfig.json': '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]},"module":"NodeNext","moduleResolution":"NodeNext"}}',
    'src/frontend/page.tsx': `import { secret } from '@/libraries/barrel';
export const Page = () => String(secret);`,
    'src/libraries/barrel.ts': `export { secret } from './mid';`,
    'src/libraries/mid.ts': `export { secret } from '../backend/private';`,
    'src/backend/private.ts': `export const secret = 123;`,
    'src/frontend/renamed.tsx': `export class EntryGate {
  login() { return true; }
  logout() { return false; }
}`, // renamed potential auth replacement -> ambiguous
    'src/frontend/runtime.ts': `export async function load(name: string) { return import('./widgets/' + name); }`,
    'src/frontend/extension.tsx': `import { WorkspaceTileMenu } from '@ultrst-armada/floks';
export function WorkspaceService() { const createWorkspace = () => WorkspaceTileMenu; const selectWorkspace = () => 1; return [createWorkspace,selectWorkspace]; }`
  }
};
