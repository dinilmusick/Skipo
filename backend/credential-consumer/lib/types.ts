/**
 * @file types.ts
 * @description Types for client-side SRKL vault consumption in ecosystem apps (DEPM, etc.)
 */

export interface KeyMaterial {
  secretHex: string;
  cipher: 'aes-256-gcm';
  envelope: 'salt_iv_tag_ciphertext';
}

export interface SrklVaultAccessResponse {
  success: boolean;
  appId: string;
  workspaceId: string;
  workspaceName: string;
  folderPrefix: string;
  storageProvider: 'backblaze_b2' | 'cloudflare_r2' | 'aws_s3' | string;
  presignedUrl: string;
  keyMaterial: KeyMaterial;
  supportedServices: string[];
  expiresAt: string;
  ttlSeconds: number;
}

export interface ServiceAccountEntry {
  id: string;
  serviceId: string;
  name: string;
  credentials: Record<string, any>;
  status?: string;
  lastSync?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CredentialRegistryMap {
  [serviceId: string]: ServiceAccountEntry[];
}
