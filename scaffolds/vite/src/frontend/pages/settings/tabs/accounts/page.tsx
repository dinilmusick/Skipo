'use client';

import { useCallback, useEffect, useState } from 'react';
import { BaseButton, BaseCard } from '@ultrst-armada/floks/ui';
import { luthFetch } from '../../../../../libraries/client/luthAuthClient.js';

interface Connection {
  id: string;
  provider: string;
  label?: string;
  name?: string;
  enabled?: boolean;
}

export default function AccountsTab() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await luthFetch('/api/auth/storage/connections');
      const payload = await response.json();
      if (!response.ok || payload?.success === false) throw new Error(payload?.error || 'Could not read storage connections.');
      const records = Array.isArray(payload) ? payload : payload?.connections;
      if (!Array.isArray(records)) throw new Error('Kloks returned an invalid storage connection list.');
      setConnections(records.filter((v: any) => v && typeof v.id === 'string' && typeof v.provider === 'string'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Storage connection retrieval failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return (
    <BaseCard>
      <h2>Storage accounts</h2>
      <p>Connections are provided by Kloks. New connections can be authorized from the workspace creation dialog.</p>
      <BaseButton type="button" onClick={() => { void reload(); }} disabled={loading}>Refresh connections</BaseButton>
      {loading && <p role="status">Loading connections…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && connections.length === 0 && <p>No storage connections configured.</p>}
      <ul>{connections.map((connection) => (
        <li key={connection.id}>{connection.label || connection.name || connection.id} — {connection.provider}{connection.enabled === false ? ' (disabled)' : ''}</li>
      ))}</ul>
    </BaseCard>
  );
}
