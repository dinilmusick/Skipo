import { describe, expect, it } from 'vitest';
import { normalizeStaticCapabilityDescriptors } from
  '../backend/ecosystem/deploymentStore_Impure.js';

const valid = {
  id: 'composeRun', name: 'Compose', serviceName: 'Composer',
  description: 'Execute a registered operation',
  invocation: { serviceId: 'compose', operationId: 'run' },
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: { type: 'object' },
};

describe('strict public registry capability descriptor validation', () => {
  it('accepts bounded registered metadata and positive role declarations', () => {
    const descriptor = { ...valid, access: 'roles' as const,
      requiredRoles: ['workspace:editor'] };
    expect(normalizeStaticCapabilityDescriptors([descriptor])).toEqual([descriptor]);
  });

  it('rejects malformed identity display metadata and role scopes', () => {
    for (const broken of [
      { name: { displayName: 'forged' } },
      { serviceName: 12 },
      { name: '   ' },
      { description: 'x'.repeat(1200) },
      { access: 'roles' },
      { access: 'roles', requiredRoles: [] },
      { access: 'public', requiredRoles: ['admin'] },
      { requiredRoles: ['admin', 'admin'] },
      { access: 'roles', requiredRoles: [''] },
      { access: 'roles', requiredRoles: ['admin/owner'] },
    ]) {
      expect(() => normalizeStaticCapabilityDescriptors([
        { ...valid, ...broken } as never,
      ])).toThrow();
    }
  });

  it('refuses nested credential names and schema literal default values', () => {
    const sensitive = { ...valid, inputSchema: {
      type: 'object', properties: { accessToken: { type: 'string' } },
    } };
    expect(() => normalizeStaticCapabilityDescriptors([sensitive]))
      .toThrow(/cannot contain session, endpoint, credential or secret/i);
    for (const field of ['default', 'examples', 'const', 'constructor']) {
      const schema = { ...valid, inputSchema: { type: 'object',
        properties: { safe: { [field]: 'sensitive literal' } } } };
      expect(() => normalizeStaticCapabilityDescriptors([schema]), field).toThrow();
    }
  });

  it('rejects cyclic, excessive depth and non-JSON objects', () => {
    const cycle: Record<string, unknown> = { type: 'object' };
    cycle.properties = { self: cycle };
    expect(() => normalizeStaticCapabilityDescriptors([
      { ...valid, inputSchema: cycle },
    ])).toThrow(/circular/);
    const dateSchema = { ...valid, inputSchema: { type: 'object',
      validUntil: new Date() } };
    expect(() => normalizeStaticCapabilityDescriptors([dateSchema]))
      .toThrow(/plain JSON/);
    const functionSchema = { ...valid, inputSchema: {
      type: 'object', transform: () => 'unsafe',
    } };
    expect(() => normalizeStaticCapabilityDescriptors([functionSchema]))
      .toThrow(/non-JSON/);
    let nested: Record<string, unknown> = { type: 'object' };
    for (let index = 0; index < 20; index++) nested = { items: nested };
    expect(() => normalizeStaticCapabilityDescriptors([
      { ...valid, inputSchema: nested },
    ])).toThrow(/nesting/);
  });

  it('bounds each descriptor and the complete immutable snapshot payload', () => {
    const many = (count: number) => ({
      type: 'object',
      properties: Object.fromEntries(Array.from({ length: count }, (_, i) =>
        ['field' + i, { type: 'string', description: 'x'.repeat(1400) }])),
    });
    expect(() => normalizeStaticCapabilityDescriptors([
      { ...valid, inputSchema: many(25) },
    ])).toThrow(/maximum size/);
    const chunk = many(16);
    const snapshot = Array.from({ length: 7 }, (_, index) =>
      ({ ...valid, id: 'composeRun' + index, inputSchema: chunk }));
    expect(() => normalizeStaticCapabilityDescriptors(snapshot))
      .toThrow(/maximum size/);
  });
});
