import { describe, it, expect } from 'vitest';
import { themeTokenSemanticsRule } from '../validator/rules/theme-token-semantics.js';
import { uiInvariantsRule } from '../validator/rules/ui-invariants.js';
import { gitIgnoreAnchoringRule } from '../validator/rules/git-ignore-anchoring.js';
import { serverlessCompatibilityRule } from '../validator/rules/serverless-compatibility.js';
import { Project } from 'ts-morph';


describe('themeTokenSemanticsRule', () => {
  it('flags hardcoded hex colors in tsx files', () => {
    const code = `
      export const MyComponent = () => {
        return <div style={{ color: '#ff0000' }}>Hello</div>;
      };
    `;
    const violations = themeTokenSemanticsRule.validate('MyComponent.tsx', code);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('Hardcoded color detected');
  });

  it('allows semantic var(--skipo-*) tokens', () => {
    const code = `
      export const MyComponent = () => {
        return <div style={{ color: 'var(--skipo-text)' }}>Hello</div>;
      };
    `;
    const violations = themeTokenSemanticsRule.validate('MyComponent.tsx', code);
    expect(violations).toHaveLength(0);
  });
});

describe('uiInvariantsRule', () => {
  it('flags floating tooltip bubble classes', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('BadTooltip.tsx', `
      export const Bad = () => <div className="skipo-tooltip">Popup</div>;
    `);
    const violations = uiInvariantsRule.validate('BadTooltip.tsx', '', project);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('Floating tooltip bubble class used');
  });

  it('flags nested TabContainer instances', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile('NestedTabs.tsx', `
      import { TabContainer } from '@skipo/ui';
      export const Nested = () => (
        <TabContainer tabs={[]}>
          <TabContainer tabs={[]} />
        </TabContainer>
      );
    `);
    const violations = uiInvariantsRule.validate('NestedTabs.tsx', '', project);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].message).toContain('Nested TabContainer detected');
  });
});

describe('gitIgnoreAnchoringRule', () => {
  it('flags unanchored dist/ in .gitignore', () => {
    const gitignoreContent = `
node_modules/
dist/
.env
`;
    const violations = gitIgnoreAnchoringRule.validate('.gitignore', gitignoreContent);
    expect(violations.length).toBe(1);
    expect(violations[0].message).toContain('Unanchored gitignore pattern "dist/"');
  });

  it('allows anchored /dist/ in .gitignore', () => {
    const gitignoreContent = `
node_modules/
/dist/
.env
`;
    const violations = gitIgnoreAnchoringRule.validate('.gitignore', gitignoreContent);
    expect(violations).toHaveLength(0);
  });
});

describe('serverlessCompatibilityRule', () => {
  it('flags static import of vite in server files', () => {
    const code = `
import express from 'express';
import { createServer } from 'vite';

export function createApp() {
  const app = express();
  return app;
}
`;
    const violations = serverlessCompatibilityRule.validate('/src/server/AppFactory.ts', code);
    expect(violations.length).toBe(1);
    expect(violations[0].message).toContain('Static import of Vite in server factory');
  });

  it('allows dynamic import of vite behind environment guards', () => {
    const code = `
import express from 'express';

export async function createApp() {
  const app = express();
  if (!process.env.VERCEL) {
    const { createServer } = await import('vite');
  }
  return app;
}
`;
    const violations = serverlessCompatibilityRule.validate('/src/server/AppFactory.ts', code);
    expect(violations).toHaveLength(0);
  });
});


