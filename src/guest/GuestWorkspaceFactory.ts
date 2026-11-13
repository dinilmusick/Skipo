import {
  createGuestWorkspaceProvider,
  type GuestLeaseBinding,
  type GuestWorkspaceProvider,
  type GuestWorkspaceProviderOptions,
} from './GuestWorkspace.js';

export interface GuestWorkspaceFactoryOptions extends GuestWorkspaceProviderOptions {
  deployment: 'node' | 'cloudflare' | 'vercel';
}

export class GuestWorkspaceFactory {
  private readonly provider: GuestWorkspaceProvider;

  constructor(options: GuestWorkspaceFactoryOptions) {
    if (!['node', 'cloudflare', 'vercel'].includes(options.deployment)) {
      throw new Error('Guest workspace deployment adapter is unsupported');
    }
    this.provider = createGuestWorkspaceProvider(options);
  }

  async createForLease(lease: GuestLeaseBinding): Promise<GuestWorkspaceProvider> {
    await this.provider.createWorkspace(lease);
    return this.provider;
  }

  getProvider(): GuestWorkspaceProvider {
    return this.provider;
  }
}

export function createGuestWorkspaceFactory(
  options: GuestWorkspaceFactoryOptions,
): GuestWorkspaceFactory {
  return new GuestWorkspaceFactory(options);
}
