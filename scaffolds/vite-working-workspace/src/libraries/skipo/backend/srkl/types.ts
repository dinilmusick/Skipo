/**
 * @file types.ts
 * @description Type definitions for SRKL Ecosystem Service Broker integration.
 * Enables client applications to declare service requirements, query SRKL vaults,
 * and adapt credentials for storage/compute/AI usage.
 * Strictly adheres to Skipo governance (< 200 lines).
 */

export interface SrklServiceAccount {
  id: string;
  serviceId: string;
  name: string;
  credentials: Record<string, any>;
  status: string;
  lastSync?: string;
  metadata?: Record<string, any>;
  workspaceId?: string;
  workspaceName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SrklClientOptions {
  srklUrl?: string;
  userId?: string;
  token?: string;
  workspaceId?: string;
  getAuthHeaders?: () => Record<string, string>;
}

export interface SrklEcosystemQueryOptions {
  workspaceId?: string;
  types?: string[];
  includeCredentials?: boolean;
}

export interface SrklEcosystemResponse {
  success: boolean;
  userId: string;
  workspaceId: string;
  requestedTypes: string[];
  count: number;
  services: SrklServiceAccount[];
  error?: string;
}

export interface AppServiceDeclaration {
  appName: string;
  declaredTypes: string[];
}

export interface AdaptedStorageConnection {
  id: string;
  provider: 'backblaze_b2' | 'aws_s3' | 'local_fs';
  label: string;
  role?: 'primary' | 'redundant_clone';
  enabled?: boolean;
  createdAt: string;
  b2KeyId?: string;
  b2ApplicationKey?: string;
  b2BucketName?: string;
  b2Region?: string;
  b2Endpoint?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3BucketName?: string;
  s3Region?: string;
  s3Endpoint?: string;
}
