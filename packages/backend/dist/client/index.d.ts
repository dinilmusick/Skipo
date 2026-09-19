import { B as BackendClient, D as DomainProxy, b as BackendResolver, F as FrontendSession } from '../WebSocketTransport-CxUzUfwl.js';
export { a as BackendClientOptions, c as BackendResolverOptions, C as CallbackFn, d as CallbackRegistry, e as EventBus, f as EventHandler, g as FrontendSessionOptions, G as GapHandler, H as HTTPTransport, h as HTTPTransportOptions, S as SequenceCheckResult, i as SequenceTracker, W as WebSocketTransport, j as WebSocketTransportOptions, k as createBackendClient } from '../WebSocketTransport-CxUzUfwl.js';
import React from 'react';
export { B as BackendExecutor, C as CallbackHandle, D as Delegation, J as Job, d as JobPriority, e as JobState, M as Message, f as MessageType, R as ResolutionStrategy } from '../types-BERZJ93O.js';

/**
 * @file useBackend.ts
 * @description React Context Provider and hooks for accessing BackendClient declaratively.
 */

type BackendClientInstance = BackendClient & Record<string, DomainProxy>;
interface BackendProviderProps {
    client?: BackendClientInstance;
    resolver?: BackendResolver;
    session?: FrontendSession;
    children: React.ReactNode;
}
declare function BackendProvider({ client, resolver, session, children }: BackendProviderProps): React.FunctionComponentElement<React.ProviderProps<BackendClientInstance | null>>;
declare function useBackend(): BackendClientInstance;
declare const useBackendClient: typeof useBackend;

export { BackendClient, type BackendClientInstance, BackendProvider, type BackendProviderProps, BackendResolver, DomainProxy, FrontendSession, useBackend, useBackendClient };
