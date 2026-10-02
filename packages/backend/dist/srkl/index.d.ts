/**
 * @file types.ts
 * @description Type definitions for SRKL Ecosystem Service Broker integration.
 * Enables client applications to declare service requirements, query SRKL vaults,
 * and adapt credentials for storage/compute/AI usage.
 * Strictly adheres to Skipo governance (< 200 lines).
 */
interface SrklServiceAccount {
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
interface SrklClientOptions {
    srklUrl?: string;
    userId?: string;
    token?: string;
    workspaceId?: string;
    getAuthHeaders?: () => Record<string, string>;
}
interface SrklEcosystemQueryOptions {
    workspaceId?: string;
    types?: string[];
    includeCredentials?: boolean;
}
interface SrklEcosystemResponse {
    success: boolean;
    userId: string;
    workspaceId: string;
    requestedTypes: string[];
    count: number;
    services: SrklServiceAccount[];
    error?: string;
}
interface AppServiceDeclaration {
    appName: string;
    declaredTypes: string[];
}
interface AdaptedStorageConnection {
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

/**
 * @file SrklClient.ts
 * @description Universal HTTP Client for querying SRKL Service Account Vaults.
 * Used across the ecosystem by client apps and gateway routers (e.g. Depm, DocuStack).
 * Strictly adheres to Skipo governance (< 200 lines).
 */

declare class SrklClient {
    private baseUrl;
    private userId;
    private token?;
    private workspaceId?;
    private getAuthHeadersCustom?;
    constructor(options?: SrklClientOptions);
    setBaseUrl(url: string): void;
    getBaseUrl(): string;
    private buildHeaders;
    checkHealth(): Promise<{
        ok: boolean;
        latencyMs: number;
        status?: string;
    }>;
    getServices(types?: string[], options?: SrklEcosystemQueryOptions): Promise<SrklServiceAccount[]>;
    getStorageConnections(userIdOverride?: string): Promise<any[]>;
    getBackblazeBuckets(keyId: string, applicationKey: string): Promise<any[]>;
    static filterRelevantServices(services: SrklServiceAccount[], allowedTypes: string[]): SrklServiceAccount[];
    static adaptToStorageConnection(account: SrklServiceAccount): AdaptedStorageConnection;
}
declare function createSrklClient(options?: SrklClientOptions): SrklClient;

/**
 * @file useSrklServices.ts
 * @description React Hook for discovering and consuming services from SRKL Vaults.
 * Strictly adheres to Skipo governance (< 200 lines).
 */

interface UseSrklServicesOptions {
    srklUrl?: string;
    declaredTypes: string[];
    userId?: string;
    token?: string;
    workspaceId?: string;
    autoFetch?: boolean;
}
interface UseSrklServicesResult {
    services: SrklServiceAccount[];
    loading: boolean;
    error: string | null;
    isConnected: boolean;
    latencyMs: number | null;
    refetch: (force?: boolean) => Promise<void>;
    srklUrl: string;
    setSrklUrl: (url: string) => void;
    client: SrklClient;
}
declare function useSrklServices(options: UseSrklServicesOptions): UseSrklServicesResult;

export { type AdaptedStorageConnection, type AppServiceDeclaration, SrklClient, type SrklClientOptions, type SrklEcosystemQueryOptions, type SrklEcosystemResponse, type SrklServiceAccount, type UseSrklServicesOptions, type UseSrklServicesResult, createSrklClient, useSrklServices };
