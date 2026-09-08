import { describe, it, expect, beforeEach } from 'vitest';
import {
  CompatibilityMatrix,
  HandleTypeRegistry,
  WireTypeRegistry,
  initializeDefaultGraphRules,
  DataHandle,
  ViewHandle
} from '../node-graph/index.js';

describe('Skipo Magnetic Node Graph — Centralized Rules & Compatibility Matrix', () => {
  beforeEach(() => {
    CompatibilityMatrix.clear();
    HandleTypeRegistry.clear();
    WireTypeRegistry.clear();
    initializeDefaultGraphRules();
  });

  it('correctly resolves compatible DATA handles', () => {
    const source = new DataHandle({ id: 'out-1', nodeId: 'node-a', dataType: 'STRING', direction: 'OUTPUT' });
    const target = new DataHandle({ id: 'in-1', nodeId: 'node-b', dataType: 'STRING', direction: 'INPUT' });

    const result = CompatibilityMatrix.resolve(source, target);
    expect(result.allowed).toBe(true);
    expect(result.wireType).toBe('STRING');
  });

  it('rejects incompatible DATA handle types', () => {
    const source = new DataHandle({ id: 'out-1', nodeId: 'node-a', dataType: 'STRING', direction: 'OUTPUT' });
    const target = new DataHandle({ id: 'in-1', nodeId: 'node-b', dataType: 'NUMBER', direction: 'INPUT' });

    const result = CompatibilityMatrix.resolve(source, target);
    expect(result.allowed).toBe(false);
  });

  it('rejects handles pointing in the same direction', () => {
    const h1 = new DataHandle({ id: 'out-1', nodeId: 'node-a', dataType: 'STRING', direction: 'OUTPUT' });
    const h2 = new DataHandle({ id: 'out-2', nodeId: 'node-b', dataType: 'STRING', direction: 'OUTPUT' });

    const result = CompatibilityMatrix.resolve(h1, h2);
    expect(result.allowed).toBe(false);
  });

  it('enforces that VIEW handles do not connect via data compatibility matrix', () => {
    const viewHandle = new ViewHandle({ id: 'vh-1', nodeId: 'node-a' });
    const dataHandle = new DataHandle({ id: 'dh-1', nodeId: 'node-b', dataType: 'STRING', direction: 'INPUT' });

    const result = CompatibilityMatrix.resolve(viewHandle, dataHandle);
    expect(result.allowed).toBe(false);
  });

  it('supports custom plugin compatibility rule overrides', () => {
    CompatibilityMatrix.registerRule({
      sourceCategory: 'DATA',
      sourceDataType: 'CUSTOM_SIGNAL',
      targetCategory: 'DATA',
      targetDataType: 'NUMBER',
      allowed: true,
      wireType: 'SIGNAL_TO_NUM',
      priority: 50
    });

    const source = new DataHandle({ id: 'out-s', nodeId: 'n1', dataType: 'CUSTOM_SIGNAL', direction: 'OUTPUT' });
    const target = new DataHandle({ id: 'in-n', nodeId: 'n2', dataType: 'NUMBER', direction: 'INPUT' });

    const result = CompatibilityMatrix.resolve(source, target);
    expect(result.allowed).toBe(true);
    expect(result.wireType).toBe('SIGNAL_TO_NUM');
  });
});
