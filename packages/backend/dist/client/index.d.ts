import { B as BackendClient, j as DomainProxy, d as BackendResolver, F as FrontendSession } from '../WebSocketTransport-CHmkJ0tj.js';
export { a as BackendClientOptions, b as BackendExecutor, e as BackendResolverOptions, C as CallbackFn, f as CallbackHandle, g as CallbackRegistry, D as Delegation, k as EventBus, l as EventHandler, m as FrontendSessionOptions, G as GapHandler, H as HTTPTransport, n as HTTPTransportOptions, J as Job, p as JobPriority, q as JobState, M as Message, s as MessageType, R as ResolutionStrategy, S as SequenceCheckResult, v as SequenceTracker, W as WebSocketTransport, w as WebSocketTransportOptions, x as createBackendClient } from '../WebSocketTransport-CHmkJ0tj.js';
import React from 'react';

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
