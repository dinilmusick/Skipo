import {
  BackendClient
} from "./chunk-NIP22V2G.js";

// src/client/useBackend.ts
import React, { createContext, useContext, useMemo } from "react";
var BackendContext = createContext(null);
function BackendProvider({ client, resolver, session, children }) {
  const activeClient = useMemo(() => {
    if (client) return client;
    if (resolver) {
      return new BackendClient({ resolver, session });
    }
    throw new Error('[BackendProvider] Either a "client" or a "resolver" must be provided.');
  }, [client, resolver, session]);
  return React.createElement(BackendContext.Provider, { value: activeClient }, children);
}
function useBackend() {
  const client = useContext(BackendContext);
  if (!client) {
    throw new Error("[useBackend] useBackend must be used within a <BackendProvider>.");
  }
  return client;
}
var useBackendClient = useBackend;

export {
  BackendProvider,
  useBackend,
  useBackendClient
};
