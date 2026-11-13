import {
  createGuestWorkspaceProvider,
  type GuestLeaseBinding,
  type GuestWorkspaceProvider,
  type GuestWorkspaceProviderOptions,
} from './GuestWorkspace.js';

export interface GuestWorkspaceFactoryOptions extends GuestWorkspaceProviderOptions {
  deployment: 'node' | 'cloudflare' | 'vercel';
}

/**
 * Request-safe factory. It deliberately retains no lease/workspace state in the
 * process: every request may construct a fresh provider around the same
 * deployment-shared volatile store and resolve the same lease namespace.
 */
export class GuestWorkspaceFactory {
  constructor(private readonly options: GuestWorkspaceFactoryOptions) {
    if (!['node', 'cloudflare', 'vercel'].includes(options.deployment)) {
      throw new Error('Guest workspace deployment adapter is unsupported');
    }
    // Validate capabilities and quota configuration during deployment bootstrap.
    createGuestWorkspaceProvider(options);
  }

  async createForLease(lease: GuestLeaseBinding): Promise<GuestWorkspaceProvider> {
    const provider = createGuestWorkspaceProvider(this.options);
    // Store.createNamespace is an atomic create-if-absent operation. Repeated
    // calls across requests/restarts must preserve the existing lease workspace.
    await provider.createWorkspace(lease);
    return provider;
  }

  getProvider(): GuestWorkspaceProvider {
    return createGuestWorkspaceProvider(this.options);
  }
}

export function createGuestWorkspaceFactory(
  options: GuestWorkspaceFactoryOptions,
): GuestWorkspaceFactory {
  return new GuestWorkspaceFactory(options);
}
