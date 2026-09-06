'use client';
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export type SystemMessageType = 'success' | 'error' | 'warning' | 'info';

export interface SystemMessage {
  id: string;
  type: SystemMessageType;
  message: string;
  timestamp: number;
}

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'dirty';

export interface BottomStripContextValue {
  inspectionText: string | null;
  setInspectionText: (text: string | null) => void;
  autoSave: {
    enabled: boolean;
    status: AutoSaveStatus;
    toggle: () => void;
    setStatus: (status: AutoSaveStatus) => void;
    setEnabled: (enabled: boolean) => void;
  };
  apiActivity: {
    activeCount: number;
    lastEndpoint?: string;
    lastMethod?: string;
    recordRequestStart: (endpoint: string, method?: string) => string;
    recordRequestEnd: (requestId: string) => void;
  };
  systemMessages: SystemMessage[];
  showSystemMessage: (message: string, type?: SystemMessageType, durationMs?: number) => void;
  clearSystemMessage: (id: string) => void;
}

const BottomStripContext = createContext<BottomStripContextValue | null>(null);

export interface BottomStripProviderProps {
  children: React.ReactNode;
  initialAutoSave?: boolean;
}

function useAutoSaveController(initialEnabled: boolean) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const toggle = useCallback(() => setEnabled(prev => !prev), []);
  return { enabled, status, toggle, setStatus, setEnabled };
}

function useApiActivityController() {
  const [activeCount, setActiveCount] = useState(0);
  const [lastEndpoint, setLastEndpoint] = useState<string | undefined>(undefined);
  const [lastMethod, setLastMethod] = useState<string | undefined>(undefined);

  const recordRequestStart = useCallback((endpoint: string, method = 'GET') => {
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setActiveCount(prev => prev + 1);
    setLastEndpoint(endpoint);
    setLastMethod(method);
    return id;
  }, []);

  const recordRequestEnd = useCallback((_requestId: string) => {
    setActiveCount(prev => Math.max(0, prev - 1));
  }, []);

  return { activeCount, lastEndpoint, lastMethod, recordRequestStart, recordRequestEnd };
}

function useSystemMessageController() {
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);

  const clearSystemMessage = useCallback((id: string) => {
    setSystemMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  const showSystemMessage = useCallback((message: string, type: SystemMessageType = 'info', durationMs = 5000) => {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newMsg: SystemMessage = { id, type, message, timestamp: Date.now() };
    setSystemMessages(prev => [...prev.slice(-4), newMsg]);
    if (durationMs > 0) {
      setTimeout(() => clearSystemMessage(id), durationMs);
    }
  }, [clearSystemMessage]);

  return { systemMessages, showSystemMessage, clearSystemMessage };
}

export function BottomStripProvider({
  children,
  initialAutoSave = true
}: BottomStripProviderProps) {
  const [inspectionText, setInspectionText] = useState<string | null>(null);
  const autoSave = useAutoSaveController(initialAutoSave);
  const apiActivity = useApiActivityController();
  const { systemMessages, showSystemMessage, clearSystemMessage } = useSystemMessageController();

  const value = useMemo<BottomStripContextValue>(() => ({
    inspectionText,
    setInspectionText,
    autoSave,
    apiActivity,
    systemMessages,
    showSystemMessage,
    clearSystemMessage,
  }), [inspectionText, autoSave, apiActivity, systemMessages, showSystemMessage, clearSystemMessage]);

  return (
    <BottomStripContext.Provider value={value}>
      {children}
    </BottomStripContext.Provider>
  );
}

export function useBottomStrip(): BottomStripContextValue {
  const ctx = useContext(BottomStripContext);
  if (!ctx) {
    // Return a safe fallback mock if outside provider
    return {
      inspectionText: null,
      setInspectionText: () => {},
      autoSave: {
        enabled: true,
        status: 'idle',
        toggle: () => {},
        setStatus: () => {},
        setEnabled: () => {}
      },
      apiActivity: {
        activeCount: 0,
        recordRequestStart: () => 'noop',
        recordRequestEnd: () => {}
      },
      systemMessages: [],
      showSystemMessage: () => {},
      clearSystemMessage: () => {}
    };
  }
  return ctx;
}
