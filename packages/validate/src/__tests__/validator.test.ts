import { describe, it, expect } from 'vitest';
import { themeTokenSemanticsRule } from '../validator/rules/theme-token-semantics.js';
import { uiInvariantsRule } from '../validator/rules/ui-invariants.js';
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
