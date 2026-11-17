'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  WorkspaceTilesMenu,
  createKloksWorkspaceStorageService,
  type WorkspaceCreateInput,
  type WorkspaceRecord,
  type WorkspaceStorageOption,
} from '@ultrst-armada/floks/ui';
import { luthFetch } from '../../../libraries/client/luthAuthClient.js';

export interface WorkspaceGateProps {
  workspaces?: WorkspaceRecord[];
  userId?: string;
  currentUser?: { id: string; email?: string; name?: string; username?: string } | null;
  storageOptions?: WorkspaceStorageOption[];
  activeWorkspaceId?: string | null;
  onSelectWorkspace: (workspace: WorkspaceRecord) => void;
  onCreateWorkspace?: (input: WorkspaceCreateInput) => Promise<void> | void;
  onDeleteWorkspace?: (id: string) => Promise<void> | void;
  onLogout?: () => void;
  appName?: string;
}

async function requestJson(path: string, init?: RequestInit): Promise<any> {
  const response = await luthFetch(path, init);
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(String(result?.error || `Request failed (HTTP ${response.status}).`));
  }
  if (result == null) throw new Error('Canonical service returned an invalid response.');
  return result;
}

function workspaceRecord(value: unknown): WorkspaceRecord {
  if (!value || typeof value !== 'object' || typeof (value as any).id !== 'string') {
    throw new Error('Kloks returned an invalid workspace record.');
  }
  const record = value as WorkspaceRecord;
  return { ...record, title: record.title || record.name || record.id };
}

/** Stateful application gate. Data always comes from verified Luth + Kloks routes. */
export function WorkspaceGate({
  workspaces, userId, currentUser, storageOptions, activeWorkspaceId,
  onSelectWorkspace, onCreateWorkspace, onDeleteWorkspace, onLogout, appName = 'SKIPO APP',
}: WorkspaceGateProps) {
  const [records, setRecords] = useState<WorkspaceRecord[]>([]);
  const [connections, setConnections] = useState<WorkspaceStorageOption[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(workspaces === undefined);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestJson('/api/auth/workspaces');
      if (!Array.isArray(result.workspaces)) throw new Error('Kloks did not return a workspace list.');
      setRecords(result.workspaces.map(workspaceRecord));
      setActiveId(typeof result.activeWorkspaceId === 'string' ? result.activeWorkspaceId : null);
      setConnections(Array.isArray(result.storage_connections)
        ? result.storage_connections.filter((v: any) => v && typeof v.id === 'string' && typeof v.provider === 'string')
        : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Workspace retrieval failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (workspaces === undefined) void refresh();
  }, [workspaces, refresh, currentUser?.id]);

  const storageService = useMemo(() => createKloksWorkspaceStorageService({
    invoke: async (serviceId, operation, input) => {
      if (serviceId !== 'kloks.backend.storage') throw new Error('Unsupported storage provider.');
      return requestJson('/api/auth/storage/invoke', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ operation, input }),
      });
    },
  }), []);

  return (
    <WorkspaceTilesMenu
      workspaces={workspaces ?? records}
      userId={userId || currentUser?.id}
      currentUser={currentUser ? { ...currentUser, email: currentUser.email || '' } : null}
      storageOptions={storageOptions ?? connections}
      storageService={storageService}
      activeWorkspaceId={activeWorkspaceId === undefined ? activeId : activeWorkspaceId}
      onSelectWorkspace={onSelectWorkspace}
      onCreateWorkspace={async (input) => {
        if (onCreateWorkspace) await onCreateWorkspace(input);
        else {
          await requestJson('/api/auth/workspaces', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify(input),
          });
          await refresh();
        }
      }}
      onDeleteWorkspace={onDeleteWorkspace}
      onLogout={onLogout}
      appName={appName}
      loading={loading}
      error={error}
    />
  );
}

export default WorkspaceGate;
