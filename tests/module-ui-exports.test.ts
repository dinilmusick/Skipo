import { readFileSync } from 'node:fs';
import { createElement, memo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ModuleUIHost } from '../src/frontend/components/module-ui/ModuleUIHost.js';
import { ModuleUIRegistry, registerSkipoModuleUI } from '../src/frontend/components/module-ui/registry.js';
import type { ModuleUIExport, SkipoModuleUIContribution } from '../src/frontend/components/module-ui/contract.js';

function surface() { return null; }
const MemoSurface = memo(function MemoSurface() { return null; });
function contribution(moduleId: string, exports: Partial<ModuleUIExport>[] = [{}]): SkipoModuleUIContribution {
  return {
    moduleId,
    exports: exports.map((item, index) => ({
      id: item.id ?? `surface-${index}`,
      label: item.label ?? `Surface ${index}`,
      icon: item.icon ?? '◇',
      component: item.component ?? surface,
      surfaceType: item.surfaceType ?? 'floating-panel',
      metadata: item.metadata,
    })),
  };
}

describe('ModuleUIRegistry', () => {
  it('discovers multiple exports from one module', () => {
    const registry = new ModuleUIRegistry();
    registry.register(contribution('calendar', [{ id: 'agenda' }, { id: 'settings' }]));
    expect(registry.getSnapshot()[0].exports).toHaveLength(2);
  });

  it('discovers contributions from multiple modules independently', () => {
    const registry = new ModuleUIRegistry();
    registry.register(contribution('calendar'));
    registry.register(contribution('messaging'));
    expect(registry.getSnapshot().map((entry) => entry.moduleId)).toEqual(['calendar', 'messaging']);
  });

  it('rejects duplicate module registrations and duplicate export IDs', () => {
    const registry = new ModuleUIRegistry();
    registry.register(contribution('calendar'));
    expect(() => registry.register(contribution('calendar'))).toThrow(/already registered/);
    expect(() => registry.register(contribution('other', [{ id: 'same' }, { id: 'same' }]))).toThrow(/Duplicate/);
  });

  it('rejects incomplete exports and unsupported surface types', () => {
    const registry = new ModuleUIRegistry();
    expect(() => registry.register({ moduleId: 'broken', exports: [{ ...contribution('x').exports[0], label: '' }] })).toThrow(/label/);
    expect(() => registry.register(contribution('broken-type', [{ surfaceType: 'popover' as never }]))).toThrow(/unsupported/);
    expect(() => registry.register(contribution('broken-icon', [{ icon: { kind: 'asset', src: '' } }]))).toThrow(/icon asset/);
  });

  it('publishes immutable snapshots and notifies subscribers', () => {
    const registry = new ModuleUIRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);
    registry.register(contribution('calendar'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(registry.getSnapshot())).toBe(true);
    expect(Object.isFrozen(registry.getSnapshot()[0].exports)).toBe(true);
    expect(Object.isFrozen(registry.getSnapshot()[0].exports[0])).toBe(true);
  });

  it('accepts memoized React surfaces and asset-backed icons', () => {
    const registry = new ModuleUIRegistry();
    registry.register(contribution('memoized', [{ component: MemoSurface, icon: { kind: 'asset', src: '/module.svg', alt: 'Module' } }]));
    expect(registry.getSnapshot()[0].exports[0].component).toBe(MemoSurface);
  });

  it('unregisters a module and makes its exports unavailable', () => {
    const registry = new ModuleUIRegistry();
    const dispose = registry.register(contribution('calendar'));
    dispose();
    expect(registry.getSnapshot()).toEqual([]);
  });

  it('supports all canonical surface types, including a full-frontend export', () => {
    const registry = new ModuleUIRegistry();
    const types = ['floating-panel', 'overlay', 'drawer', 'full-screen'] as const;
    types.forEach((surfaceType, index) => registry.register(contribution(`module-${index}`, [{ surfaceType }])));
    expect(registry.getSnapshot().flatMap((entry) => entry.exports.map((item) => item.surfaceType))).toEqual(types);
  });

  it('preserves optional module metadata', () => {
    const registry = new ModuleUIRegistry();
    registry.register(contribution('reports', [{ metadata: { category: 'analytics' } }]));
    expect(registry.getSnapshot()[0].exports[0].metadata).toEqual({ category: 'analytics' });
  });
});

describe('ModuleUIHost integration', () => {
  it('automatically renders a bottom-right button for every registered module export', () => {
    const dispose = registerSkipoModuleUI(contribution('sample-module', [{ id: 'frontend', label: 'Sample UI' }]));
    try {
      const markup = renderToStaticMarkup(createElement(ModuleUIHost));
      expect(markup).toContain('data-skipo-module-dock="true"');
      expect(markup).toContain('data-module-ui-id="sample-module:frontend"');
      expect(markup).toContain('aria-label="Sample UI"');
    } finally {
      dispose();
    }
  });

  it('integrates the host into both app templates and the canonical app shell', () => {
    const paths = [
      '../scaffolds/nextjs/src/frontend/pages/main/page.tsx',
      '../scaffolds/vite/src/frontend/pages/main/page.tsx',
      '../src/frontend/pages/home/page.tsx',
    ];
    for (const path of paths) {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(source).toContain('ModuleUIHost');
      if (path.includes('/scaffolds/')) expect(source.startsWith("'use client';")).toBe(true);
    }
  });

  it('copies the host contract into minimal generated applications', () => {
    const source = readFileSync(new URL('../scripts/scaffold_app_structure.py', import.meta.url), 'utf8');
    expect(source).toContain('module_ui_source');
    expect(source).toContain('ModuleUIHost');
  });

  it('keeps generic module UI implementation free of application-specific integrations', () => {
    const source = readFileSync(new URL('../src/frontend/components/module-ui/ModuleUIHost.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/Aiko|FOD/i);
    expect(source).toContain('Escape');
    expect(source).toContain('event.key === \'Tab\'');
  });
});
