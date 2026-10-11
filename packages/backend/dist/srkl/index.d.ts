/**
 * @file types.ts
 * @description Standardized Skipo Ecosystem Account Manifest & Broker Integration.
 * Defines the canonical contract for ecosystem apps to declare account requirements
 * and for SRKL to fulfill them across deployment, storage, and AI service categories.
 * Strictly adheres to Skipo governance (< 200 lines).
 */
type EcosystemServiceCategory = 'deployment' | 'storage' | 'database' | 'ai' | 'vcs' | 'general';
interface AppAccountManifest {
    appId: string;
    appName: string;
    categories?: EcosystemServiceCategory[];
    requiredServices?: string[];
}
interface EcosystemAccount {
    id: string;
    serviceId: string;
    provider: string;
    category: EcosystemServiceCategory;
    name: string;
    emailOrSlug?: string;
    status: string;
    credentials: Record<string, any>;
    groupIds?: string[];
    metadata?: Record<string, any>;
    createdAt?: string;
    updatedAt?: string;
}
interface EcosystemAccountsRequest {
    manifest: AppAccountManifest;
    userId?: string;
    workspaceId?: string;
}
interface EcosystemAccountsResponse {
    success: boolean;
    appId: string;
    userId: string;
    workspaceId?: string;
    count: number;
    accounts: EcosystemAccount[];
    error?: string;
}
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

declare const CANONICAL_SRKL_URL = "https://srkl-engine.vercel.app";
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
    /**
     * Standardized Skipo Ecosystem Accounts Discovery Protocol.
     * Consumes an AppAccountManifest and returns uniform EcosystemAccount[] matching the app's requirements.
     */
    fetchEcosystemAccounts(manifest: AppAccountManifest, options?: {
        workspaceId?: string;
        timeoutMs?: number;
    }): Promise<EcosystemAccount[]>;
    getServices(types?: string[], options?: SrklEcosystemQueryOptions): Promise<SrklServiceAccount[]>;
    getStorageConnections(userIdOverride?: string): Promise<any[]>;
    getBackblazeBuckets(keyId: string, applicationKey: string): Promise<any[]>;
    static filterRelevantServices(services: SrklServiceAccount[], allowedTypes: string[]): SrklServiceAccount[];
    static adaptToStorageConnection(account: SrklServiceAccount): AdaptedStorageConnection;
}
declare function createSrklClient(options?: SrklClientOptions): SrklClient;

/**
 * @file SrklDiscoveryService.ts
 * @description Universal SRKL Service Discovery and Backblaze B2 account federation.
 * Runs identically in Node.js, Vercel Serverless, and Cloudflare Workers (< 200 lines).
 */
declare function getPrimarySrklDeploymentUrl(queryDb?: (sql: string, params?: unknown[]) => Promise<{
    rows: any[];
}>): Promise<string>;
declare function getSrklAccounts(userId: string, service?: string, queryDb?: (sql: string, params?: unknown[]) => Promise<{
    rows: any[];
}>): Promise<{
    success: boolean;
    deploymentUrl: string;
    accounts: any[];
    count: number;
    error?: string;
}>;
declare function srklListBackblazeBuckets(keyId?: string, applicationKey?: string, _bucketId?: string, _bucketName?: string, userId?: string, queryDb?: (sql: string, params?: unknown[]) => Promise<{
    rows: any[];
}>): Promise<{
    success: boolean;
    buckets: any[];
    error?: string;
}>;

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

export { type AdaptedStorageConnection, type AppAccountManifest, type AppServiceDeclaration, CANONICAL_SRKL_URL, type EcosystemAccount, type EcosystemAccountsRequest, type EcosystemAccountsResponse, type EcosystemServiceCategory, SrklClient, type SrklClientOptions, type SrklEcosystemQueryOptions, type SrklEcosystemResponse, type SrklServiceAccount, type UseSrklServicesOptions, type UseSrklServicesResult, createSrklClient, getPrimarySrklDeploymentUrl, getSrklAccounts, srklListBackblazeBuckets, useSrklServices };
