'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { getNamespacedModuleUIId } from './contract.js';
import { skipoModuleUIRegistry } from './registry.js';

const dockStyle: CSSProperties = {
  position: 'fixed', right: 12, bottom: 8, zIndex: 1200,
  display: 'flex', alignItems: 'center', gap: 6, padding: 6,
  border: '1px solid var(--skipo-border, #454545)',
  borderRadius: 12, background: 'var(--skipo-surface, #171717)',
  boxShadow: '0 4px 18px #0005',
};

function surfaceStyle(type: string, stackIndex: number): CSSProperties {
  const base: CSSProperties = {
    position: 'fixed', zIndex: 1300 + stackIndex,
    background: 'var(--skipo-surface, #171717)', color: 'var(--skipo-text, inherit)',
    border: '1px solid var(--skipo-border, #454545)', boxShadow: '0 12px 40px #0006',
    overflow: 'auto',
  };
  if (type === 'overlay') return { ...base, inset: 0, borderRadius: 0 };
  if (type === 'drawer') return { ...base, top: 0, right: 0, bottom: 0, width: 'min(440px, 92vw)' };
  if (type === 'full-screen') return { ...base, inset: 0, borderRadius: 0 };
  return { ...base, right: 12, bottom: 58, width: 'min(420px, calc(100vw - 24px))', maxHeight: 'min(75vh, 720px)', borderRadius: 12 };
}

function renderIcon(icon: unknown) {
  if (icon && typeof icon === 'object' && (icon as { kind?: string }).kind === 'asset') {
    const asset = icon as { src: string; alt?: string };
    return <img src={asset.src} alt={asset.alt ?? ''} aria-hidden={!asset.alt} style={{ width: 20, height: 20, objectFit: 'contain' }} />;
  }
  return <span aria-hidden="true">{icon as ReactNode}</span>;
}

export function ModuleUIHost() {
  const contributions = useSyncExternalStore(
    skipoModuleUIRegistry.subscribe,
    skipoModuleUIRegistry.getSnapshot,
    skipoModuleUIRegistry.getSnapshot,
  );
  const exports = useMemo(
    () => contributions.flatMap((module) => module.exports.map((item) => ({
      ...item, moduleId: module.moduleId, namespacedId: getNamespacedModuleUIId(module.moduleId, item.id),
    }))),
    [contributions],
  );
  const [openIds, setOpenIds] = useState<string[]>([]);
  const availableIds = useMemo(() => new Set(exports.map((item) => item.namespacedId)), [exports]);

  useEffect(() => {
    setOpenIds((current) => current.filter((id) => availableIds.has(id)));
  }, [availableIds]);

  useEffect(() => {
    if (!openIds.length) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenIds((current) => current.slice(0, -1));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openIds.length]);

  const toggle = (id: string) => setOpenIds((current) =>
    current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
  );
  if (!exports.length) return null;

  return (
    <>
      <nav aria-label="Module controls" data-skipo-module-dock="true" style={dockStyle}>
        {exports.map((item) => (
          <button
            key={item.namespacedId}
            type="button"
            title={item.label}
            aria-label={item.label}
            aria-pressed={openIds.includes(item.namespacedId)}
            onClick={() => toggle(item.namespacedId)}
            data-module-ui-id={item.namespacedId}
            style={{
              display: 'grid', placeItems: 'center', width: 36, height: 36,
              borderRadius: 8, border: '1px solid var(--skipo-border, #555)',
              color: 'inherit', background: openIds.includes(item.namespacedId)
                ? 'var(--skipo-accent-soft, #333)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            {renderIcon(item.icon)}
          </button>
        ))}
      </nav>
      {openIds.map((id, index) => {
        const item = exports.find((entry) => entry.namespacedId === id);
        if (!item) return null;
        const Surface = item.component;
        return (
          <section
            key={id}
            role="dialog"
            aria-label={item.label}
            aria-modal={item.surfaceType === 'overlay' || item.surfaceType === 'full-screen'}
            data-module-surface-id={id}
            data-module-surface-type={item.surfaceType}
            style={surfaceStyle(item.surfaceType, index)}
          >
            <Surface open onRequestClose={() => setOpenIds((current) => current.filter((entry) => entry !== id))} />
          </section>
        );
      })}
    </>
  );
}

export default ModuleUIHost;
