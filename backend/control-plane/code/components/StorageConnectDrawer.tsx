'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  HardDrive,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Check,
  Zap,
  Activity,
  Trash2,
  Download,
  Upload,
  Plus,
  Star,
  Copy,
  ShieldAlert,
  Info,
  RefreshCw,
} from 'lucide-react';
import {
  UserStorageConnection,
  UserStorageProvider,
  DatabaseEngine,
} from '@/lib/types';
import {
  STORAGE_PROVIDER_CONFIGS,
  exportStorageConnectionToJson,
  parseStorageImportJson,
} from '@/lib/storage-providers';
import {
  isFileSystemAccessSupported,
  promptSelectLocalFolder,
  saveLocalDirectoryHandle,
  getLocalDirectoryHandle,
  syncWorkspaceToDirectoryHandle,
} from '@/lib/local-fs-handle';

interface StorageConnectDrawerProps {
  userToken?: string | null;
  currentConnectionId?: string;
  currentProvider?: UserStorageProvider;
  currentLocalFolderName?: string;
  currentLocalFolderKey?: string;
  onSelectLocalFolder: (folderName: string, folderKey: string) => void;
  onSelectCloudConnection: (connection: UserStorageConnection) => void;
  onSelectEngine: (engine: DatabaseEngine) => void;
  onUserUpdated?: (updatedUser: any) => void;
}

const ACTIVE_STORAGE_PROVIDERS: UserStorageProvider[] = [
  'backblaze_b2',
  'cloudflare_r2',
  'supabase_storage',
  'aws_s3',
  'local_fs',
];

export default function StorageConnectDrawer({
  userToken,
  currentConnectionId,
  currentProvider = 'backblaze_b2',
  currentLocalFolderName,
  currentLocalFolderKey,
  onSelectLocalFolder,
  onSelectCloudConnection,
  onSelectEngine,
  onUserUpdated,
}: StorageConnectDrawerProps) {
  const [selectedProvider, setSelectedProvider] = useState<UserStorageProvider>(currentProvider);
  const [activeConnId, setActiveConnId] = useState<string | undefined>(currentConnectionId);
  const [savedConnections, setSavedConnections] = useState<UserStorageConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);

  // Form Fields State for New Connection
  const [showNewConnectionForm, setShowNewConnectionForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [connectionLabel, setConnectionLabel] = useState('');

  // Local Folder State
  const [localFolderName, setLocalFolderName] = useState<string>(currentLocalFolderName || '');
  const [localFolderKey, setLocalFolderKey] = useState<string>(currentLocalFolderKey || '');
  const [isLocalFsSupported, setIsLocalFsSupported] = useState(true);
  const [isBrave, setIsBrave] = useState(false);
  const [copiedFlagUrl, setCopiedFlagUrl] = useState(false);

  // Testing & Saving State
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    ok: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [importNotification, setImportNotification] = useState<string | null>(null);

  // Synchronization & Clones Replication State
  const [autoSaveClones, setAutoSaveClones] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('docustack_auto_save_clones');
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });
  const [syncProgress, setSyncProgress] = useState<{
    active: boolean;
    title: string;
    percent: number;
    statusMessage: string;
    currentFile?: string;
    completedFiles?: number;
    totalFiles?: number;
  } | null>(null);
  const [syncingClones, setSyncingClones] = useState(false);
  const activeDirectoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);

  // File Input Ref for JSON Import & HTML5 directory fallback
  const fileInputRef = useRef<HTMLInputElement>(null);
  const html5FolderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsLocalFsSupported(isFileSystemAccessSupported());
    if (typeof window !== 'undefined') {
      const nav = window.navigator as any;
      if (nav?.brave) {
        if (typeof nav.brave.isBrave === 'function') {
          nav.brave
            .isBrave()
            .then((res: boolean) => setIsBrave(Boolean(res)))
            .catch(() => setIsBrave(true));
        } else {
          setIsBrave(true);
        }
      }
    }
    fetchSavedConnections();
  }, []);

  useEffect(() => {
    if (currentConnectionId) {
      setActiveConnId(currentConnectionId);
    }
  }, [currentConnectionId]);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = userToken || (typeof window !== 'undefined' ? localStorage.getItem('docustackAuthToken') : null);
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchSavedConnections = async (preferredId?: string) => {
    try {
      setLoadingConnections(true);
      const res = await fetch('/api/auth/storage/connections', { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success && Array.isArray(data.connections)) {
        setSavedConnections(data.connections);
        if (data.connections.length === 0) {
          setShowNewConnectionForm(true);
        } else if (preferredId || currentConnectionId) {
          const targetId = preferredId || currentConnectionId;
          const matched = targetId ? data.connections.find((c: any) => c.id === targetId) : undefined;
          const primary = data.connections.find((c: any) => c.role === 'primary');
          const chosen = matched || primary || data.connections[0];
          if (chosen) {
            setActiveConnId(chosen.id);
            setSelectedProvider(chosen.provider);
            if (chosen.provider === 'local_fs') {
              onSelectLocalFolder(chosen.localFolderName || '', chosen.localFolderKey || '');
              onSelectEngine('local_fs');
            } else {
              onSelectCloudConnection(chosen);
              onSelectEngine('s3_blob');
            }
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load saved storage connections:', err);
    } finally {
      setLoadingConnections(false);
    }
  };

  const handleSetPrimaryConnection = async (conn: UserStorageConnection, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setGeneralError(null);
      const res = await fetch('/api/auth/storage/connections', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'set_primary', id: conn.id }),
      });
      const data = await res.json();
      if (!data.success) {
        setGeneralError(data.error || 'Failed to elevate storage to primary');
        return;
      }
      setImportNotification(`✓ "${conn.label}" elevated to Primary Workspace Storage.`);
      await fetchSavedConnections(conn.id);
      handleSelectSavedConn(conn);
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to set primary storage');
    }
  };

  const handlePickLocalFolder = async () => {
    try {
      setGeneralError(null);

      // If native File System Access API is supported, use it for direct read/write disk access
      if (isFileSystemAccessSupported()) {
        const { handle, folderName: name } = await promptSelectLocalFolder();
        const generatedKey = `ws_handle_${Date.now()}`;

        await saveLocalDirectoryHandle(generatedKey, handle);
        activeDirectoryHandleRef.current = handle;

        setLocalFolderName(name);
        setLocalFolderKey(generatedKey);
        setActiveConnId(undefined);
        setSelectedProvider('local_fs');
        onSelectLocalFolder(name, generatedKey);
        onSelectEngine('local_fs');
        setImportNotification(`✓ Successfully connected local folder "${name}". Click SAVE LOCAL STORAGE OPTION to synchronize files.`);
        return;
      }

      // Fallback: trigger HTML5 folder selector (Finder on Mac, Explorer on Windows)
      if (html5FolderInputRef.current) {
        html5FolderInputRef.current.click();
      } else {
        throw new Error('No folder explorer available in this browser.');
      }
    } catch (err: any) {
      if (err.message?.includes('USER_CANCELLED')) return;
      setGeneralError(err.message || 'Failed to select local folder.');
    }
  };

  const handleHtml5FolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      const relPath = firstFile.webkitRelativePath || '';
      const folderName = relPath.split('/')[0] || firstFile.name || 'Local Workspace';
      const generatedKey = `ws_html5_${Date.now()}`;

      setLocalFolderName(folderName);
      setLocalFolderKey(generatedKey);
      setActiveConnId(undefined);
      setSelectedProvider('local_fs');
      onSelectLocalFolder(folderName, generatedKey);
      onSelectEngine('local_fs');

      if (isBrave) {
        setImportNotification(
          `✓ Folder "${folderName}" selected via File Explorer. Note: Enable brave://flags/#file-system-access-api for persistent read/write disk sync.`
        );
      } else {
        setImportNotification(`✓ Folder "${folderName}" selected via File Explorer.`);
      }
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleCopyBraveFlagUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText('brave://flags/#file-system-access-api');
      setCopiedFlagUrl(true);
      setTimeout(() => setCopiedFlagUrl(false), 2500);
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    // Smart detection if user pasted the entire Backblaze key creation modal snippet:
    if (selectedProvider === 'backblaze_b2' && (value.includes('keyID') || value.includes('applicationKey'))) {
      const idMatch = value.match(/keyID[:\s]+([0-9a-fA-F]{12,32})/i);
      const secretMatch = value.match(/applicationKey[:\s]+([0-9a-zA-Z]{20,40})/i);
      if (idMatch || secretMatch) {
        setFormData((prev) => ({
          ...prev,
          ...(idMatch ? { b2KeyId: idMatch[1].trim() } : {}),
          ...(secretMatch ? { b2ApplicationKey: secretMatch[1].trim() } : {}),
        }));
        setTestResult(null);
        setImportNotification('✓ Automatically parsed Key ID and Application Key from pasted text.');
        return;
      }
    }

    setFormData((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
    setImportNotification(null);
  };

  const buildConnectionPayload = (): UserStorageConnection => {
    return {
      id: `conn_${selectedProvider}_${Date.now()}`,
      provider: selectedProvider,
      label: connectionLabel.trim() || `${STORAGE_PROVIDER_CONFIGS[selectedProvider]?.shortName || selectedProvider} Vault`,
      createdAt: new Date().toISOString(),
      localFolderName: selectedProvider === 'local_fs' ? localFolderName : undefined,
      localFolderKey: selectedProvider === 'local_fs' ? localFolderKey : undefined,
      ...formData,
    };
  };

  const runProbeTest = async (payload: UserStorageConnection, autoSaveOnSuccess: boolean = true) => {
    try {
      setTesting(true);
      setTestResult(null);
      setGeneralError(null);

      const res = await fetch('/api/auth/storage/test', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          tested: true,
          ok: true,
          latencyMs: data.latencyMs,
        });

        // Automatically save and register connection upon successful handshake
        if (autoSaveOnSuccess && payload.provider !== 'local_fs') {
          try {
            const saveRes = await fetch('/api/auth/storage/connections', {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({
                ...payload,
                testStatus: 'ok',
                latencyMs: data.latencyMs,
              }),
            });
            const saveData = await saveRes.json();
            if (saveData.success && saveData.connection) {
              await fetchSavedConnections(saveData.connection.id);
              setActiveConnId(saveData.connection.id);
              onSelectCloudConnection(saveData.connection);
              onSelectEngine(saveData.connection.provider === 'local_fs' ? 'local_fs' : 's3_blob');
              setShowNewConnectionForm(false);
              setImportNotification(`✓ Successfully connected & added "${saveData.connection.label}" as an active storage option.`);
            }
          } catch (saveErr) {
            console.warn('Auto-save error after probe:', saveErr);
          }
        }
      } else {
        setTestResult({
          tested: true,
          ok: false,
          latencyMs: data.latencyMs,
          error: data.error || 'Connection failed',
        });
      }
    } catch (err: any) {
      setTestResult({
        tested: true,
        ok: false,
        error: err.message || 'Failed to run connectivity test',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestConnection = async () => {
    const payload = buildConnectionPayload();
    await runProbeTest(payload, true);
  };

  const fetchWorkspaceDataForSync = async () => {
    const headers = getAuthHeaders();
    const [docsRes, catsRes, graphRes, wsRes, userWsRes] = await Promise.all([
      fetch('/api/documents', { headers }).then((r) => r.json()).catch(() => ({ documents: [] })),
      fetch('/api/categories', { headers }).then((r) => r.json()).catch(() => ({ categories: [] })),
      fetch('/api/graph', { headers }).then((r) => r.json()).catch(() => ({ nodes: [], edges: [], groups: [] })),
      fetch('/api/workspace', { headers }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/auth/workspaces', { headers }).then((r) => r.json()).catch(() => ({})),
    ]);

    // Find the canonical folder prefix from active workspace (e.g. ultrst_docustack_dinil_test-backblaze-workspace)
    let canonicalFolderPrefix: string | null = wsRes.folderPrefix || null;
    if (!canonicalFolderPrefix && userWsRes.workspaces && Array.isArray(userWsRes.workspaces)) {
      const active = userWsRes.workspaces.find((w: any) => w.id === userWsRes.activeWorkspaceId) || userWsRes.workspaces[0];
      if (active?.workspacePath) {
        canonicalFolderPrefix = active.workspacePath.replace(/^\.\//, '');
      }
    }
    if (canonicalFolderPrefix) {
      canonicalFolderPrefix = canonicalFolderPrefix.replace(/^\.\//, '').replace(/^\/+/, '');
      if (canonicalFolderPrefix.includes('/')) {
        const segments = canonicalFolderPrefix.split('/').filter(Boolean);
        const ultrstSegment = segments.find((s: string) => s.startsWith('ultrst_'));
        canonicalFolderPrefix = ultrstSegment || segments[segments.length - 1];
      }
    }

    return {
      documents: docsRes.documents || [],
      categories: catsRes.categories || [],
      nodes: graphRes.nodes || [],
      edges: graphRes.edges || [],
      groups: graphRes.groups || [],
      folderPrefix: canonicalFolderPrefix,
      vaultName: wsRes.vaultName || null,
    };
  };

  const performLocalHandleSync = async (
    handle: FileSystemDirectoryHandle,
    folderName: string,
    title: string = 'SYNCHRONIZING LOCAL STORAGE'
  ): Promise<number> => {
    setSyncProgress({
      active: true,
      title,
      percent: 5,
      statusMessage: 'Loading active workspace documents, graph structure, and folder prefix...',
      completedFiles: 0,
      totalFiles: 1,
    });

    const workspaceData = await fetchWorkspaceDataForSync();

    const result = await syncWorkspaceToDirectoryHandle(
      handle,
      folderName || 'DocuStack Vault',
      workspaceData,
      (progress) => {
        setSyncProgress({
          active: true,
          title,
          percent: progress.percent,
          statusMessage: progress.statusMessage,
          currentFile: progress.currentFile,
          completedFiles: progress.completedFiles,
          totalFiles: progress.totalFiles,
        });
      },
      workspaceData.folderPrefix || undefined
    );

    setSyncProgress({
      active: true,
      title,
      percent: 100,
      statusMessage: `✓ Synchronized ${result.filesWritten} files directly to "${folderName}".`,
      completedFiles: result.filesWritten,
      totalFiles: result.filesWritten,
    });

    setTimeout(() => {
      setSyncProgress(null);
    }, 3500);

    return result.filesWritten;
  };

  const handleSaveAndUse = async () => {
    try {
      setSaving(true);
      setGeneralError(null);

      const payload = buildConnectionPayload();
      const res = await fetch('/api/auth/storage/connections', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save storage connection.');
      }

      await fetchSavedConnections(data.connection.id);
      setActiveConnId(data.connection.id);
      if (data.connection.provider === 'local_fs') {
        onSelectLocalFolder(data.connection.localFolderName || '', data.connection.localFolderKey || '');
        onSelectEngine('local_fs');
      } else {
        onSelectCloudConnection(data.connection);
        onSelectEngine('s3_blob');
      }
      setShowNewConnectionForm(false);

      // If local_fs, immediately sync workspace files to the folder handle
      if (data.connection.provider === 'local_fs') {
        let handleToUse = activeDirectoryHandleRef.current;
        if (!handleToUse && data.connection.localFolderKey) {
          handleToUse = await getLocalDirectoryHandle(data.connection.localFolderKey);
        }
        if (handleToUse) {
          try {
            const filesWritten = await performLocalHandleSync(
              handleToUse,
              data.connection.localFolderName || data.connection.label,
              `INITIALIZING & SYNCHRONIZING LOCAL STORAGE: ${data.connection.label}`
            );
            setImportNotification(
              `✓ Added "${data.connection.label}" and synchronized ${filesWritten} files directly to your Mac folder.`
            );
            return;
          } catch (syncErr: any) {
            console.warn('[LocalFS Initial Sync Warning]', syncErr);
          }
        }
      }

      setImportNotification(`✓ Added "${data.connection.label}" as an active storage option.`);
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to save connection.');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncToClones = async () => {
    const cloneConnections = savedConnections.filter((c) => c.role !== 'primary');
    if (cloneConnections.length === 0) {
      setGeneralError('No clone storage options available to replicate.');
      return;
    }

    try {
      setSyncingClones(true);
      setGeneralError(null);
      setSyncProgress({
        active: true,
        title: `REPLICATING WORKSPACE TO ${cloneConnections.length} CLONES`,
        percent: 10,
        statusMessage: 'Preparing workspace files and clone endpoints...',
      });

      let cloudSynced = 0;
      let localSynced = 0;

      // 1. Cloud Clones Replication
      const cloudClones = cloneConnections.filter((c) => c.provider !== 'local_fs');
      if (cloudClones.length > 0) {
        setSyncProgress((prev) => ({
          active: true,
          title: `REPLICATING WORKSPACE TO ${cloneConnections.length} CLONES`,
          percent: 30,
          statusMessage: `Syncing ${cloudClones.length} cloud clones (${cloudClones.map((c) => c.label).join(', ')})...`,
        }));

        const res = await fetch('/api/auth/storage/sync-clones', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ cloneIds: cloudClones.map((c) => c.id) }),
        });
        const data = await res.json();
        if (data.success) {
          cloudSynced = data.totalFilesSynced || 0;
        }
      }

      // 2. Local FS Clones Replication
      const localClones = cloneConnections.filter((c) => c.provider === 'local_fs');
      if (localClones.length > 0) {
        setSyncProgress((prev) => ({
          active: true,
          title: `REPLICATING WORKSPACE TO ${cloneConnections.length} CLONES`,
          percent: 70,
          statusMessage: `Syncing local folder clone (${localClones.map((c) => c.label).join(', ')})...`,
        }));

        for (const localClone of localClones) {
          let handle: FileSystemDirectoryHandle | null = null;
          if (localClone.localFolderKey) {
            handle = await getLocalDirectoryHandle(localClone.localFolderKey);
          }
          if (!handle && activeDirectoryHandleRef.current) {
            handle = activeDirectoryHandleRef.current;
          }

          if (handle) {
            const written = await performLocalHandleSync(
              handle,
              localClone.localFolderName || localClone.label,
              `SYNCING CLONE: ${localClone.label}`
            );
            localSynced += written;
          }
        }
      }

      setSyncProgress({
        active: true,
        title: 'REPLICATION COMPLETE',
        percent: 100,
        statusMessage: `✓ Synced all workspace files to ${cloneConnections.length} clone storage options.`,
      });

      setImportNotification(
        `✓ Replicated workspace to ${cloneConnections.length} clones (${cloudSynced + localSynced} files written).`
      );

      // Update lastTestedAt in local state without re-fetching (prevents tile state reset)
      const nowIso = new Date().toISOString();
      setSavedConnections((prev) =>
        prev.map((c) =>
          cloneConnections.some((cl) => cl.id === c.id) ? { ...c, lastTestedAt: nowIso } : c
        )
      );
      setTimeout(() => setSyncProgress(null), 5000);
    } catch (err: any) {
      setGeneralError(`Clone synchronization failed: ${err.message}`);
      setSyncProgress(null);
    } finally {
      setSyncingClones(false);
    }
  };

  const handleSyncSingleClone = async (conn: UserStorageConnection) => {
    try {
      setSyncingClones(true);
      setGeneralError(null);

      if (conn.provider === 'local_fs') {
        let handle: FileSystemDirectoryHandle | null = null;
        if (conn.localFolderKey) {
          handle = await getLocalDirectoryHandle(conn.localFolderKey);
        }
        if (!handle && activeDirectoryHandleRef.current) {
          handle = activeDirectoryHandleRef.current;
        }

        if (!handle) {
          throw new Error('Local folder handle not found. Please click CHANGE FOLDER to re-grant permission.');
        }

        const written = await performLocalHandleSync(
          handle,
          conn.localFolderName || conn.label,
          `SYNCING CLONE TO DISK: ${conn.label}`
        );
        setImportNotification(`✓ Synced ${written} files to local clone "${conn.label}".`);
      } else {
        setSyncProgress({
          active: true,
          title: `SYNCING CLONE: ${conn.label}`,
          percent: 40,
          statusMessage: `Replicating workspace to ${conn.label}...`,
        });

        const res = await fetch('/api/auth/storage/sync-clones', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ cloneIds: [conn.id] }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to sync clone.');

        setSyncProgress({
          active: true,
          title: `SYNCING CLONE: ${conn.label}`,
          percent: 100,
          statusMessage: `✓ Synced ${data.totalFilesSynced || 0} files to ${conn.label}.`,
        });
        setImportNotification(`✓ Replicated workspace to ${conn.label} (${data.totalFilesSynced || 0} files).`);
        setTimeout(() => setSyncProgress(null), 4000);
      }
      // Update lastTestedAt in local tile state without re-fetching (prevents tile state reset)
      const nowIso = new Date().toISOString();
      setSavedConnections((prev) =>
        prev.map((c) => (c.id === conn.id ? { ...c, lastTestedAt: nowIso } : c))
      );
    } catch (err: any) {
      setGeneralError(`Failed to sync clone: ${err.message}`);
      setSyncProgress(null);
    } finally {
      setSyncingClones(false);
    }
  };

  const handleSyncCurrentLocalFolder = async (conn: UserStorageConnection) => {
    try {
      setSyncingClones(true);
      setGeneralError(null);

      let handle: FileSystemDirectoryHandle | null = null;
      if (conn.localFolderKey) {
        handle = await getLocalDirectoryHandle(conn.localFolderKey);
      }
      if (!handle && activeDirectoryHandleRef.current) {
        handle = activeDirectoryHandleRef.current;
      }

      if (!handle) {
        throw new Error('Local folder handle not found. Please click CHANGE FOLDER to re-select.');
      }

      const written = await performLocalHandleSync(
        handle,
        conn.localFolderName || conn.label,
        `SYNCING WORKSPACE TO LOCAL DISK: ${conn.label}`
      );
      setImportNotification(`✓ Synchronized ${written} files directly to disk folder "${conn.label}".`);
    } catch (err: any) {
      setGeneralError(`Failed to sync to local disk: ${err.message}`);
    } finally {
      setSyncingClones(false);
    }
  };

  const handleDeleteSavedConnection = async (connId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remove this saved storage connection from your profile?')) return;

    try {
      const res = await fetch(`/api/auth/storage/connections?id=${connId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        if (data.user && onUserUpdated) {
          onUserUpdated(data.user);
        }
        setSavedConnections((prev) => {
          const remaining = prev.filter((c) => c.id !== connId);
          if (activeConnId === connId) {
            if (remaining.length > 0) {
              handleSelectSavedConn(remaining[0]);
            } else {
              setActiveConnId(undefined);
              setShowNewConnectionForm(true);
            }
          }
          return remaining;
        });
      }
    } catch (err: any) {
      alert(`Failed to delete connection: ${err.message}`);
    }
  };

  const handleSelectSavedConn = (conn: UserStorageConnection) => {
    setActiveConnId(conn.id);
    setSelectedProvider(conn.provider);
    if (conn.provider === 'local_fs') {
      onSelectLocalFolder(conn.localFolderName || '', conn.localFolderKey || '');
      onSelectEngine('local_fs');
    } else {
      onSelectCloudConnection(conn);
      onSelectEngine('s3_blob');
    }
    setImportNotification(null);
  };

  const handleExportJson = () => {
    try {
      let targetPayload = buildConnectionPayload();
      if (activeConnId) {
        const found = savedConnections.find((c) => c.id === activeConnId);
        if (found) targetPayload = found;
      }

      const exportDoc = exportStorageConnectionToJson(targetPayload, 'docustack');
      const jsonString = JSON.stringify(exportDoc, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const safeLabel = (targetPayload.label || targetPayload.provider).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const filename = `ultrst_storage_${safeLabel}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setGeneralError(`Export failed: ${err.message}`);
    }
  };

  const handleTriggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setGeneralError(null);
      setImportNotification(null);

      const text = await file.text();
      const parsed = parseStorageImportJson(text);

      if (parsed.isBundle && parsed.connections && parsed.connections.length > 0) {
        const first = parsed.connections[0];
        loadConnectionIntoForm(first);
        setShowNewConnectionForm(true);
        setImportNotification(`✓ Imported storage bundle. Testing connection for "${first.label}"...`);
        if (first.provider !== 'local_fs') {
          runProbeTest(first, true);
        }
      } else if (parsed.connection) {
        const conn = parsed.connection;
        loadConnectionIntoForm(conn);
        setShowNewConnectionForm(true);
        setImportNotification(`✓ Loaded credentials for "${conn.label || conn.provider}". Testing connectivity...`);
        if (conn.provider !== 'local_fs') {
          runProbeTest(conn, true);
        }
      }
    } catch (err: any) {
      setGeneralError(`Import failed: ${err.message}`);
    }
  };

  const loadConnectionIntoForm = (conn: UserStorageConnection) => {
    if (conn.provider) {
      setSelectedProvider(conn.provider);
      if (conn.provider === 'local_fs') {
        onSelectEngine('local_fs');
        if (conn.localFolderName) setLocalFolderName(conn.localFolderName);
        if (conn.localFolderKey) setLocalFolderKey(conn.localFolderKey);
      } else {
        onSelectEngine('s3_blob');
      }
    }

    if (conn.label) setConnectionLabel(conn.label);

    const newFormData: Record<string, string> = {};
    if (conn.b2KeyId) newFormData['b2KeyId'] = conn.b2KeyId;
    if (conn.b2ApplicationKey) newFormData['b2ApplicationKey'] = conn.b2ApplicationKey;
    if (conn.b2BucketName) newFormData['b2BucketName'] = conn.b2BucketName;
    if (conn.b2Region) newFormData['b2Region'] = conn.b2Region;
    if (conn.b2Endpoint) newFormData['b2Endpoint'] = conn.b2Endpoint;

    if (conn.r2AccountId) newFormData['r2AccountId'] = conn.r2AccountId;
    if (conn.r2AccessKeyId) newFormData['r2AccessKeyId'] = conn.r2AccessKeyId;
    if (conn.r2SecretAccessKey) newFormData['r2SecretAccessKey'] = conn.r2SecretAccessKey;
    if (conn.r2BucketName) newFormData['r2BucketName'] = conn.r2BucketName;

    if (conn.s3AccessKeyId) newFormData['s3AccessKeyId'] = conn.s3AccessKeyId;
    if (conn.s3SecretAccessKey) newFormData['s3SecretAccessKey'] = conn.s3SecretAccessKey;
    if (conn.s3BucketName) newFormData['s3BucketName'] = conn.s3BucketName;
    if (conn.s3Region) newFormData['s3Region'] = conn.s3Region;
    if (conn.s3Endpoint) newFormData['s3Endpoint'] = conn.s3Endpoint;

    if (conn.supabaseUrl) newFormData['supabaseUrl'] = conn.supabaseUrl;
    if (conn.supabaseAnonKey) newFormData['supabaseAnonKey'] = conn.supabaseAnonKey;
    if (conn.supabaseServiceKey) newFormData['supabaseServiceKey'] = conn.supabaseServiceKey;
    if (conn.supabaseBucketName) newFormData['supabaseBucketName'] = conn.supabaseBucketName;

    setFormData(newFormData);
  };

  const currentProviderConfig = STORAGE_PROVIDER_CONFIGS[selectedProvider];
  const isBackblazeKeySwapped =
    selectedProvider === 'backblaze_b2' &&
    formData['b2KeyId']?.startsWith('K00');

  return (
    <div className="space-y-3.5 border-2 border-brutalist bg-[var(--color-surface-subtle)] p-3.5">
      {/* Hidden File Input for JSON Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Header with Export & Import Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-brutalist/40 pb-2 gap-2">
        <div className="flex items-center gap-2">
          <HardDrive size={15} className="text-[var(--color-accent)]" />
          <span className="text-xs font-black uppercase text-[var(--color-text)]">
            WORKSPACE STORAGE OPTIONS
          </span>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
          {savedConnections.some((c) => c.role !== 'primary') && (
            <button
              type="button"
              onClick={handleSyncToClones}
              disabled={syncingClones}
              className="text-[9px] font-mono font-black uppercase px-2 py-1 border-2 border-sky-500/70 bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 flex items-center gap-1 cursor-pointer disabled:opacity-40 transition-all shadow-[1px_1px_0px_#000000]"
              title="Replicate all files and structure from Primary Storage to all Clone storages"
            >
              <RefreshCw size={10} className={syncingClones ? 'animate-spin text-sky-400' : 'text-sky-400'} />
              <span>{syncingClones ? 'REPLICATING...' : `SYNC TO CLONES (${savedConnections.filter((c) => c.role !== 'primary').length})`}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleTriggerImport}
            className="text-[9px] font-mono font-bold uppercase px-2 py-1 border border-brutalist/50 bg-black/40 hover:bg-black/80 hover:border-[var(--color-accent)] text-[var(--color-text)] flex items-center gap-1 cursor-pointer transition-colors"
            title="Import storage configuration from JSON file"
          >
            <Upload size={10} className="text-[var(--color-accent)]" />
            <span>IMPORT JSON</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="text-[9px] font-mono font-bold uppercase px-2 py-1 border border-brutalist/50 bg-black/40 hover:bg-black/80 hover:border-[var(--color-accent)] text-[var(--color-text)] flex items-center gap-1 cursor-pointer transition-colors"
            title="Download current storage credentials as portable JSON file"
          >
            <Download size={10} className="text-emerald-400" />
            <span>DOWNLOAD JSON</span>
          </button>
        </div>
      </div>

      {/* Synchronization Progress Bar Banner */}
      {syncProgress && (
        <div className="p-3 border-2 border-[var(--color-accent)] bg-black/90 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-black uppercase text-[var(--color-accent)] flex items-center gap-1.5">
              <RefreshCw size={13} className={syncProgress.percent < 100 ? 'animate-spin' : ''} />
              {syncProgress.title}
            </span>
            <span className="font-bold text-emerald-400">{syncProgress.percent}%</span>
          </div>

          {/* Brutalist Progress Track */}
          <div className="w-full h-2.5 bg-black border border-brutalist overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-sky-400 to-emerald-400 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, syncProgress.percent))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono opacity-90 truncate">
            <span className="truncate text-[var(--color-text)]">{syncProgress.statusMessage}</span>
            {syncProgress.totalFiles !== undefined && syncProgress.completedFiles !== undefined && (
              <span className="shrink-0 ml-2 font-bold text-sky-300">
                {syncProgress.completedFiles} / {syncProgress.totalFiles} files
              </span>
            )}
          </div>
        </div>
      )}

      {/* Notification Banner */}
      {importNotification && (
        <div className="p-2 border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 text-xs font-mono flex items-center justify-between gap-2">
          <span>{importNotification}</span>
          <button
            type="button"
            onClick={() => setImportNotification(null)}
            className="underline text-[10px] cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PRIMARY SECTION: SET STORAGE OPTION TILES
          ───────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono font-black uppercase text-[var(--color-accent)] block">
            SELECT ACTIVE STORAGE FOR THIS WORKSPACE:
          </span>
          <span className="text-[9px] font-mono text-sky-400/70">
            {savedConnections.length} OPTION{savedConnections.length !== 1 ? 'S' : ''} SAVED
          </span>
        </div>

        {savedConnections.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {savedConnections.map((conn) => {
              const isConnSelected = activeConnId === conn.id;
              const isPrimary = conn.role === 'primary';
              const cfg = STORAGE_PROVIDER_CONFIGS[conn.provider];
              const bucketName =
                conn.b2BucketName || conn.r2BucketName || conn.s3BucketName || conn.supabaseBucketName || conn.localFolderName || '';

              return (
                <div
                  key={conn.id}
                  onClick={() => {
                    handleSelectSavedConn(conn);
                    setShowNewConnectionForm(false);
                  }}
                  className={`p-2.5 border-2 text-left cursor-pointer transition-all flex flex-col justify-between ${
                    isConnSelected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 shadow-[3px_3px_0px_var(--color-accent)] ring-1 ring-[var(--color-accent)]'
                      : 'border-brutalist/40 bg-black/15 hover:border-brutalist hover:bg-black/25'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className={isConnSelected ? 'text-[var(--color-accent)]' : 'opacity-40'} />
                        <span className="text-xs font-black uppercase text-[var(--color-text)] truncate max-w-[140px]">
                          {conn.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isConnSelected && (
                          <span className="text-[8px] bg-[var(--color-accent)] text-black px-1.5 py-0.5 font-bold uppercase">
                            ACTIVE
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSavedConnection(conn.id, e)}
                          className="p-1 text-red-400 hover:bg-red-500/20 border border-red-500/30 cursor-pointer"
                          title="Delete connection"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                    <div className="text-[9px] font-mono opacity-70 mt-1 flex items-center justify-between">
                      <span className="uppercase text-[var(--color-accent)] font-bold">{cfg?.shortName || conn.provider}</span>
                      <span className="truncate max-w-[120px]">{bucketName} {conn.latencyMs ? `· ${conn.latencyMs}ms` : ''}</span>
                    </div>
                  </div>

                  {/* Bottom action row — PRIMARY toggle on ALL tiles + per-type sync actions */}
                  <div className="flex items-center gap-1.5 mt-2.5">
                    {/* Star toggle — promotes this to Primary, demotes others to Clone */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isPrimary) handleSetPrimaryConnection(conn, e);
                      }}
                      className={`flex-1 py-1 px-2 border text-[9px] font-mono font-black uppercase transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        isPrimary
                          ? 'border-[#D4AF37] bg-[#D4AF37] text-black shadow-[1px_1px_0px_#000000]'
                          : 'border-[#D4AF37]/50 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/30 text-[#D4AF37]'
                      }`}
                      title={isPrimary ? 'This is the Primary storage — all others are clones' : 'Set this as Primary storage'}
                    >
                      <Star size={10} className={isPrimary ? 'fill-current' : ''} />
                      <span>{isPrimary ? '★ PRIMARY' : 'SET PRIMARY'}</span>
                    </button>

                    {/* Sync action: primary local → sync to disk; clone → sync from primary */}
                    {isPrimary && conn.provider === 'local_fs' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSyncCurrentLocalFolder(conn);
                        }}
                        disabled={syncingClones}
                        className="py-1 px-2 border border-emerald-500/60 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 text-[9px] font-mono font-black uppercase transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                        title="Synchronize active workspace files to this local disk folder"
                      >
                        <RefreshCw size={9} className={syncingClones ? 'animate-spin' : ''} />
                        <span>SYNC DISK</span>
                      </button>
                    ) : !isPrimary ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSyncSingleClone(conn);
                        }}
                        disabled={syncingClones}
                        className="py-1 px-2 border border-sky-500/60 bg-sky-950/40 hover:bg-sky-900/60 text-sky-300 text-[9px] font-mono font-black uppercase transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                        title="Sync all files from Primary Storage directly to this clone"
                      >
                        <RefreshCw size={9} className={syncingClones ? 'animate-spin' : ''} />
                        <span>SYNC</span>
                      </button>
                    ) : null}
                  </div>

                  {/* Role pill — shows below action row for clarity */}
                  <div className="mt-1.5">
                    {isPrimary ? (
                      <div className="text-[8px] font-mono text-[#D4AF37]/80 uppercase tracking-wider">
                        Primary — all other options are clones of this source
                      </div>
                    ) : (
                      <div className="text-[8px] font-mono text-sky-400/70 uppercase tracking-wider">
                        Clone — receives files replicated from Primary
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 border-2 border-dashed border-[var(--color-accent)]/60 bg-black/20 text-center space-y-1.5 font-mono">
            <span className="text-xs font-black text-[var(--color-accent)] block uppercase tracking-wider">
              NO STORAGE OPTIONS CONNECTED YET
            </span>
            <p className="text-[10px] opacity-75 max-w-md mx-auto leading-relaxed">
              Connect a storage provider below (such as <strong>Backblaze B2</strong>, <strong>Cloudflare R2</strong>, <strong>Supabase</strong>, or <strong>AWS S3</strong>) to set up and sync your workspace documents.
            </p>
          </div>
        )}
        {/* ─── SYNC TO CLONES SECTION ─────────────────────────────────
            Visible whenever there are 2+ storage options.
            Replicates all workspace files from Primary to all Clones.
            ───────────────────────────────────────────────────────── */}
        {savedConnections.length > 1 && (
          <div className="mt-2.5 p-2.5 border border-sky-500/40 bg-sky-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[9px] font-black uppercase text-sky-300 block flex items-center gap-1.5">
                  <RefreshCw size={9} className="inline" /> REPLICATE WORKSPACE TO ALL CLONES
                </span>
                <span className="text-[8px] font-mono text-sky-400/70 block">
                  Copies all files &amp; structure from ★ Primary → {savedConnections.filter(c => c.role !== 'primary').length} Clone{savedConnections.filter(c => c.role !== 'primary').length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSyncToClones}
                disabled={syncingClones || savedConnections.filter(c => c.role !== 'primary').length === 0}
                className="text-[9px] font-mono font-black uppercase px-3 py-1.5 border-2 border-sky-500 bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-all shadow-[2px_2px_0px_#000000] shrink-0"
                title="Replicate all workspace files and structure from Primary Storage to every Clone"
              >
                <RefreshCw size={11} className={syncingClones ? 'animate-spin text-sky-300' : 'text-sky-400'} />
                <span>{syncingClones ? 'REPLICATING...' : `SYNC ALL TO CLONES (${savedConnections.filter(c => c.role !== 'primary').length})`}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-sky-500/25 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSaveClones}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setAutoSaveClones(val);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('docustack_auto_save_clones', String(val));
                    }
                  }}
                  className="w-3.5 h-3.5 accent-cyan-400 cursor-pointer"
                />
                <span className="text-[9px] font-mono font-bold text-sky-200">
                  Auto-replicate to all clones on auto-save
                </span>
              </label>
              <span className={`text-[8px] font-mono font-black uppercase px-1.5 py-0.5 border ${
                autoSaveClones ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300' : 'border-zinc-700 bg-zinc-800 text-zinc-400'
              }`}>
                {autoSaveClones ? 'AUTO-SYNC ON' : 'MANUAL ONLY'}
              </span>
            </div>
          </div>
        )}

        {/* Toggle / Add New Connection Button */}
        <button
          type="button"
          onClick={() => {
            setShowNewConnectionForm(!showNewConnectionForm);
            if (!showNewConnectionForm && selectedProvider === 'local_fs') {
              setSelectedProvider('backblaze_b2');
            }
          }}
          className="w-full py-1.5 px-2 border border-dashed border-brutalist/60 hover:border-[var(--color-accent)] bg-black/20 hover:bg-black/40 text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer text-[var(--color-text)] mt-1"
        >
          <Plus size={12} className="text-[var(--color-accent)]" />
          <span>{showNewConnectionForm ? 'HIDE CONNECT FORM' : '+ CONNECT ANOTHER STORAGE ENGINE'}</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TERTIARY SECTION: NEW CLOUD / STORAGE CONNECTION FORM
          ───────────────────────────────────────────────────────────── */}
      {showNewConnectionForm && (
        <div className="border border-brutalist/60 bg-black/30 p-3 space-y-3">
          <span className="text-[10px] font-black uppercase text-[var(--color-accent)] block">
            CHOOSE PROVIDER TO CONNECT:
          </span>

          {/* Provider Selector Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {ACTIVE_STORAGE_PROVIDERS.map((provId) => {
              const cfg = STORAGE_PROVIDER_CONFIGS[provId];
              const isSelected = selectedProvider === provId;

              return (
                <button
                  key={provId}
                  type="button"
                  onClick={() => {
                    setSelectedProvider(provId);
                    setTestResult(null);
                    setGeneralError(null);
                  }}
                  className={`p-2 text-left border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-[var(--color-accent)] bg-black/60 shadow-[2px_2px_0px_var(--color-accent)]'
                      : 'border-brutalist/40 bg-black/20 hover:border-brutalist hover:bg-black/30'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-black uppercase tracking-tight text-[var(--color-text)]">
                      {cfg?.shortName || provId}
                    </span>
                    {isSelected && <Check size={12} className="text-[var(--color-accent)]" />}
                  </div>
                  <div className="text-[8px] font-mono opacity-50 uppercase mt-0.5">
                    {cfg?.tag || provId}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedProvider === 'local_fs' && (
            <div className="space-y-3 pt-2 border-t border-brutalist/30">
              {/* Hidden HTML5 directory input for guaranteed system explorer opening in all browsers */}
              <input
                type="file"
                ref={html5FolderInputRef}
                {...({ webkitdirectory: '', directory: '' } as any)}
                multiple
                className="hidden"
                onChange={handleHtml5FolderSelect}
              />

              {/* Local Storage General Error Box */}
              {generalError && (
                <div className="p-2.5 border border-red-500/60 bg-red-950/40 text-red-400 text-xs font-mono space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>LOCAL STORAGE ERROR</span>
                  </div>
                  <div className="text-[11px] leading-relaxed">{generalError}</div>
                </div>
              )}

              {/* Status Banner: File System Access API State */}
              {!isLocalFsSupported ? (
                isBrave ? (
                  <div className="p-3 border-2 border-amber-500/60 bg-amber-950/25 text-[var(--color-text)] space-y-2">
                    <div className="flex items-center gap-2 text-amber-400">
                      <ShieldAlert size={16} className="shrink-0" />
                      <span className="font-black text-xs uppercase tracking-wide">
                        Brave Privacy Guard Active
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-90">
                      Brave is Chromium-based, but disables the <strong>File System Access API</strong> by default for anti-fingerprinting. To enable persistent local folder write sync, enable this flag:
                    </p>
                    <div className="flex items-center gap-2 p-1.5 bg-black border border-amber-500/40">
                      <code className="text-[11px] font-mono text-amber-300 flex-1 truncate select-all">
                        brave://flags/#file-system-access-api
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyBraveFlagUrl}
                        className="py-1 px-2 text-[10px] font-mono font-bold uppercase bg-amber-500 text-black hover:bg-amber-400 flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedFlagUrl ? <Check size={11} /> : <Copy size={11} />}
                        <span>{copiedFlagUrl ? 'COPIED!' : 'COPY URL'}</span>
                      </button>
                    </div>
                    <ol className="text-[10px] space-y-0.5 opacity-80 list-decimal list-inside font-mono">
                      <li>Open a new tab and paste the copied URL</li>
                      <li>Set <strong>File System Access API</strong> to <strong>Enabled</strong></li>
                      <li>Click <strong>Relaunch</strong> at the bottom of Brave</li>
                    </ol>
                    <div className="pt-0.5 text-[10px] text-amber-400/90 font-mono space-y-0.5">
                      <div>⚡ <strong>Why macOS shows &quot;Upload&quot; currently:</strong> Without the flag, macOS treats the fallback folder picker as a file upload input and labels the button &quot;Upload&quot;.</div>
                      <div>✓ <strong>To get the native &quot;Select&quot; button:</strong> Enable the flag above and relaunch Brave. macOS will then display the native Directory Chooser with the <strong>Select</strong> button!</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 border border-cyan-500/50 bg-cyan-950/20 text-[var(--color-text)] space-y-1.5">
                    <div className="flex items-center gap-1.5 text-cyan-400">
                      <Info size={14} className="shrink-0" />
                      <span className="font-bold text-xs uppercase">Browser Directory Access Notice</span>
                    </div>
                    <p className="text-[10px] leading-relaxed opacity-80">
                      Your browser does not support the W3C File System Access API. Clicking <strong>BROWSE DISK</strong> will open your system file explorer via HTML5 directory mode. For full persistent background disk syncing and native &quot;Select&quot; button, use Chrome, Edge, or enable the flag in Brave.
                    </p>
                  </div>
                )
              ) : (
                <div className="p-2 border border-emerald-500/40 bg-emerald-950/20 flex items-center gap-2 text-emerald-400 text-[11px] font-mono">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span>Native File System Access API active & ready (macOS native &quot;Select&quot; button enabled).</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase opacity-60 block">
                  Storage Option Label
                </label>
                <input
                  type="text"
                  value={connectionLabel}
                  onChange={(e) => setConnectionLabel(e.target.value)}
                  placeholder="e.g. My Local Documents Folder"
                  className="w-full bg-black border border-brutalist px-2 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              {/* Local Folder Name Input & Browse Button */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black uppercase opacity-60 block">
                    Target Local Folder Name
                  </label>
                  <span className="text-[8px] font-mono text-[var(--color-accent)] uppercase">
                    TYPE DIRECTLY OR BROWSE
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={localFolderName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocalFolderName(val);
                      const key = localFolderKey || `ws_folder_${Date.now()}`;
                      setLocalFolderKey(key);
                      onSelectLocalFolder(val, key);
                      onSelectEngine('local_fs');
                    }}
                    placeholder="e.g. MyDocuments or DocuStackVault"
                    className="flex-1 bg-black border border-brutalist px-2 py-1.5 text-xs font-mono text-emerald-400 font-bold focus:outline-none focus:border-[var(--color-accent)]"
                  />
                  <button
                    type="button"
                    onClick={handlePickLocalFolder}
                    className="py-1.5 px-3 border-2 border-brutalist bg-[var(--color-accent)] text-black hover:bg-[#c5a059] font-black text-xs uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_var(--color-border)] shrink-0"
                    title={isLocalFsSupported ? 'Open native folder picker with Select button' : 'Browse disk folder'}
                  >
                    <FolderOpen size={13} />
                    <span>{localFolderName ? 'CHANGE FOLDER' : 'BROWSE DISK'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveAndUse}
                  disabled={!localFolderName || saving}
                  className="py-1.5 px-3 border-2 border-brutalist bg-[var(--color-accent)] text-black hover:bg-[#c5a059] font-black text-xs uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-[2px_2px_0px_var(--color-border)]"
                >
                  <Check size={13} />
                  <span>{saving ? 'SAVING...' : 'SAVE LOCAL STORAGE OPTION'}</span>
                </button>
              </div>
            </div>
          )}

          {currentProviderConfig && selectedProvider !== 'local_fs' && (
            <div className="space-y-3 pt-2 border-t border-brutalist/30">
              {/* Connection Label */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase opacity-60 block">
                  Connection Label (e.g. My {currentProviderConfig.shortName} Vault)
                </label>
                <input
                  type="text"
                  value={connectionLabel}
                  onChange={(e) => setConnectionLabel(e.target.value)}
                  placeholder={`My ${currentProviderConfig.shortName} Vault`}
                  className="w-full bg-black border border-brutalist px-2 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              {/* Backblaze Key Swap Warning Banner */}
              {isBackblazeKeySwapped && (
                <div className="p-2 border border-amber-500/50 bg-amber-500/10 text-amber-300 text-[10px] font-mono leading-tight">
                  ⚠️ Notice: In Backblaze B2, the <strong>Key ID</strong> is 25 characters (starts with 000–005), and the <strong>Application Key</strong> is the 31-character secret starting with K00. Our engine will auto-detect and resolve the swap for you.
                </div>
              )}

              {/* Dynamic Provider Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentProviderConfig.fields.map((field) => (
                  <div key={field.key} className={field.key.includes('Key') || field.key.includes('Secret') ? 'sm:col-span-2' : ''}>
                    <label className="text-[9px] font-black uppercase opacity-60 block mb-0.5">
                      {field.label} {field.required && <span className="text-red-400">*</span>}
                    </label>
                    <input
                      type={field.type}
                      value={formData[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full bg-black border border-brutalist px-2 py-1.5 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                    />
                    {field.helpText && (
                      <span className="text-[8px] opacity-50 font-mono block mt-0.5 leading-none">
                        {field.helpText}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Test Result Display */}
              {testResult && (
                <div
                  className={`p-2 border text-xs font-mono flex items-start gap-2 ${
                    testResult.ok
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                      : 'border-red-500/50 bg-red-500/10 text-red-400'
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold uppercase">
                      {testResult.ok ? `✓ CONNECTED & ADDED AS ACTIVE TILE (${testResult.latencyMs}ms)` : 'CONNECTIVITY FAILED'}
                    </div>
                    {testResult.error && <div className="text-[10px] mt-1 whitespace-pre-line leading-relaxed">{testResult.error}</div>}
                  </div>
                </div>
              )}

              {/* General Error */}
              {generalError && (
                <div className="p-2 border border-red-500/50 bg-red-500/10 text-red-400 text-[10px] font-mono">
                  {generalError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || saving}
                  className="py-1.5 px-3 border-2 border-brutalist bg-[var(--color-accent)] text-black hover:bg-[#c5a059] font-black text-xs uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-[2px_2px_0px_var(--color-border)]"
                >
                  <Activity size={12} className={testing ? 'animate-spin' : ''} />
                  <span>{testing ? 'TESTING & CONNECTING...' : 'TEST CONNECTIVITY & SET STORAGE'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAndUse}
                  disabled={testing || saving}
                  className="py-1.5 px-3 border border-brutalist bg-black/40 hover:bg-black/70 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-[var(--color-text)]"
                >
                  <Zap size={13} />
                  <span>{saving ? 'SAVING...' : 'SAVE MANUAL'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
