/**
 * @file service-integration.test.ts
 * @description Verifies Skipo integration with KrnlTS services and recursive composition.
 */

import { describe, it, expect } from 'vitest';
import {
  createService,
  createServiceDefinition,
  type IService,
} from '@dinilmusick/krnl';
import {
  createLocalService,
  createBackend,
  createCompositeService,
} from '../services/index.js';

describe('Skipo x KrnlTS Service Integration Suite', () => {
  it('KrnlTS.Service -> Skipo.LocalService equivalence', async () => {
    const krnlDef = createServiceDefinition({
      id: 'local-ops',
      name: 'Calculator',
      version: '1.0.0',
      operations: {
        add: {
          id: 'calc.add',
          name: 'add',
          handler: async (input: any) => input.a + input.b,
        },
      },
    });

    const localSvc: IService = createLocalService(krnlDef);
    await localSvc.start();
    const result = await localSvc.call('add', { a: 20, b: 30 });
    expect(result).toBe(50);
    await localSvc.stop();
  });

  it('Skipo.LocalService -> Skipo.Backend aggregation', async () => {
    const backend = createBackend('AppBackend');
    const calc = createLocalService(createServiceDefinition({
      id: 'calc',
      name: 'Calculator',
      version: '1.0.0',
      operations: {
        square: {
          id: 'calc.square',
          name: 'square',
          handler: async (input: any) => input.n * input.n,
        },
      },
    }));

    backend.registerService(calc);
    await backend.start();

    const square = await backend.call('Calculator.square', { n: 9 });
    expect(square).toBe(81);
    await backend.stop();
  });

  it('Recursive Composition: App A.Backend -> CompositeService -> App B -> App C', async () => {
    // App A Backend
    const backendA = createBackend('AppA');
    const svcA = createLocalService(createServiceDefinition({
      id: 'svc-a',
      name: 'Alpha',
      version: '1.0.0',
      operations: {
        hello: {
          id: 'alpha.hello',
          name: 'hello',
          handler: async (input: any) => `Hello ${input.name} from Alpha`,
        },
      },
    }));
    backendA.registerService(svcA);

    // App B Backend encapsulates App A as a service
    const backendB = createCompositeService('AppB');
    backendB.registerService(backendA);

    // App C Backend encapsulates App B as a service
    const backendC = createCompositeService('AppC');
    backendC.registerService(backendB);

    await backendC.start();

    // Call nested through AppC -> AppB -> AppA -> Alpha.hello
    const result = await backendC.call('AppB.AppA.Alpha.hello', { name: 'World' });
    expect(result).toBe('Hello World from Alpha');

    await backendC.stop();
  });
});
