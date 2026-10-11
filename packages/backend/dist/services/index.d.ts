import { IService, ServiceDefinition, ProtocolAdapter, EndpointDescriptor, OperationContext } from '@dinilmusick/krnl';
export { EndpointDescriptor, IService, ProtocolAdapter, ServiceDefinition } from '@dinilmusick/krnl';

/**
 * @file ServiceBoundary.ts
 * @description Bridges KrnlTS canonical services with Skipo runtime.
 * Invariant: KrnlTS.Service = Skipo.Service = RemoteService.Contract
 */

type LocalService = IService;
type RemoteServiceProxy = IService;
declare function createLocalService<TState extends Record<string, unknown> = Record<string, unknown>, TEvents extends Record<string, unknown> = Record<string, unknown>>(definition: ServiceDefinition<TState, TEvents>): LocalService;
declare function createRemoteService<TState extends Record<string, unknown> = Record<string, unknown>, TEvents extends Record<string, unknown> = Record<string, unknown>>(definition: ServiceDefinition<TState, TEvents>, adapter: ProtocolAdapter, endpoint: EndpointDescriptor): RemoteServiceProxy;

/**
 * @file CompositeBackend.ts
 * @description Composite service aggregating local services and remote proxies.
 * Invariant: Skipo.Backend = CompositeService (protocol-compatible with KrnlTS.Service).
 */

declare class CompositeBackend implements IService {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    private services;
    private capabilitiesList;
    constructor(name: string, version?: string);
    registerService(service: IService): this;
    getService(name: string): IService | undefined;
    getServices(): IService[];
    registerCapability(capability: string): this;
    start(): Promise<void>;
    stop(): Promise<void>;
    call<TIn = unknown, TOut = unknown>(op: string, input?: TIn, ctx?: OperationContext): Promise<TOut>;
    getState(): Readonly<Record<string, unknown>>;
    setState(_mutation: Partial<Record<string, unknown>>): void;
    on(event: string, handler: (payload: any) => void): () => void;
    emit(event: string, payload: any): void;
    getDefinition(): ServiceDefinition;
}

/**
 * @file EndpointGenerator.ts
 * @description Inspects CompositeBackend / services and generates protocol routes/channels.
 */

interface GeneratedEndpointSummary {
    httpRoutes: string[];
    wsChannels: string[];
    udpEndpoints: string[];
    p2pBindings: string[];
}
declare class EndpointGenerator {
    static generateEndpoints(backend: CompositeBackend, basePort?: number): GeneratedEndpointSummary;
    static generateDescriptors(backend: CompositeBackend, host?: string, port?: number): EndpointDescriptor[];
}

/**
 * @file ServiceGenerators.ts
 * @description Factory generators for Skipo backends and composite services.
 */

declare function createBackend(name: string): CompositeBackend;
declare function createCompositeService(name: string): CompositeBackend;

export { CompositeBackend, EndpointGenerator, type GeneratedEndpointSummary, type LocalService, type RemoteServiceProxy, createBackend, createCompositeService, createLocalService, createRemoteService };
