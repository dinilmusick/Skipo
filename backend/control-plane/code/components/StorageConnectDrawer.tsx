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
}

const ACTIVE_STORAGE_PROVIDERS: UserStorageProvider[] = [
  'local_fs',
  'backblaze_b2',
  'cloudflare_r2',
  'supabase_storage',
  'aws_s3',
];

export default function StorageConnectDrawer({
  userToken,
  currentConnectionId,
  currentProvider = 'local_fs',
  currentLocalFolderName,
  currentLocalFolderKey,
  onSelectLocalFolder,
  onSelectCloudConnection,
  onSelectEngine,
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

  // File Input Ref for JSON Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsLocalFsSupported(isFileSystemAccessSupported());
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

  const fetchSavedConnections = async () => {
    try {
      setLoadingConnections(true);
      const res = await fetch('/api/auth/storage/connections', { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success && Array.isArray(data.connections)) {
        setSavedConnections(data.connections);
      }
    } catch (err) {
      console.warn('Failed to load saved storage connections:', err);
    } finally {
      setLoadingConnections(false);
    }
  };

  const handlePickLocalFolder = async () => {
    try {
      setGeneralError(null);
      const { handle, folderName: name } = await promptSelectLocalFolder();
      const generatedKey = `ws_handle_${Date.now()}`;

      await saveLocalDirectoryHandle(generatedKey, handle);

      setLocalFolderName(name);
      setLocalFolderKey(generatedKey);
      setActiveConnId(undefined);
      setSelectedProvider('local_fs');
      onSelectLocalFolder(name, generatedKey);
      onSelectEngine('local_fs');
    } catch (err: any) {
      if (err.message?.includes('USER_CANCELLED')) return;
      setGeneralError(err.message || 'Failed to select local folder.');
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
              await fetchSavedConnections();
              setActiveConnId(saveData.connection.id);
              onSelectCloudConnection(saveData.connection);
              onSelectEngine('s3_blob');
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

      await fetchSavedConnections();
      setActiveConnId(data.connection.id);
      onSelectCloudConnection(data.connection);
      onSelectEngine('s3_blob');
      setShowNewConnectionForm(false);
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to save connection.');
    } finally {
      setSaving(false);
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
        setSavedConnections((prev) => prev.filter((c) => c.id !== connId));
        if (activeConnId === connId) {
          setActiveConnId(undefined);
          setSelectedProvider('local_fs');
          onSelectEngine('local_fs');
        }
      }
    } catch (err: any) {
      alert(`Failed to delete connection: ${err.message}`);
    }
  };

  const handleSelectSavedConn = (conn: UserStorageConnection) => {
    setActiveConnId(conn.id);
    setSelectedProvider(conn.provider);
    onSelectCloudConnection(conn);
    onSelectEngine('s3_blob');
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

  const isLocalSelected = selectedProvider === 'local_fs' && !activeConnId;

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

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
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
        <span className="text-[9px] font-mono font-black uppercase text-[var(--color-accent)] block">
          SELECT ACTIVE STORAGE FOR THIS WORKSPACE:
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Tile 1: Local Disk Folder */}
          <div
            onClick={() => {
              setSelectedProvider('local_fs');
              setActiveConnId(undefined);
              setShowNewConnectionForm(false);
              onSelectEngine('local_fs');
              if (localFolderName && localFolderKey) {
                onSelectLocalFolder(localFolderName, localFolderKey);
              }
            }}
            className={`p-2.5 border-2 text-left cursor-pointer transition-all flex flex-col justify-between ${
              isLocalSelected
                ? 'border-[var(--color-accent)] bg-black/40 shadow-[2px_2px_0px_var(--color-accent)]'
                : 'border-brutalist/40 bg-black/15 hover:border-brutalist hover:bg-black/25'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen size={14} className={isLocalSelected ? 'text-[var(--color-accent)]' : 'opacity-60'} />
                <span className="text-xs font-black uppercase text-[var(--color-text)]">
                  LOCAL DISK FOLDER
                </span>
              </div>
              {isLocalSelected && (
                <span className="text-[8px] bg-[var(--color-accent)] text-black px-1.5 py-0.5 font-bold uppercase">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="text-[9px] font-mono opacity-70 mt-1 truncate">
              {localFolderName ? `Folder: ${localFolderName}` : 'Native Browser File System API'}
            </div>
          </div>

          {/* Tiles 2..N: User Saved Cloud Connections */}
          {savedConnections.map((conn) => {
            const isConnSelected = activeConnId === conn.id;
            const cfg = STORAGE_PROVIDER_CONFIGS[conn.provider];
            const bucketName =
              conn.b2BucketName || conn.r2BucketName || conn.s3BucketName || conn.supabaseBucketName || '';

            return (
              <div
                key={conn.id}
                onClick={() => {
                  handleSelectSavedConn(conn);
                  setShowNewConnectionForm(false);
                }}
                className={`p-2.5 border-2 text-left cursor-pointer transition-all flex flex-col justify-between ${
                  isConnSelected
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-[2px_2px_0px_#10B981]'
                    : 'border-brutalist/40 bg-black/15 hover:border-brutalist hover:bg-black/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className={isConnSelected ? 'text-emerald-400' : 'opacity-50'} />
                    <span className="text-xs font-black uppercase text-[var(--color-text)] truncate max-w-[150px]">
                      {conn.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isConnSelected && (
                      <span className="text-[8px] bg-emerald-500 text-black px-1.5 py-0.5 font-bold uppercase">
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
                  <span className="uppercase text-[var(--color-accent)]">{cfg?.shortName || conn.provider}</span>
                  <span className="truncate max-w-[120px]">{bucketName} {conn.latencyMs ? `· ${conn.latencyMs}ms` : ''}</span>
                </div>
              </div>
            );
          })}
        </div>

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
          SECONDARY SECTION: LOCAL FOLDER EXPLORER SELECTION
          ───────────────────────────────────────────────────────────── */}
      {isLocalSelected && (
        <div className="p-3 border border-brutalist/50 bg-black/25 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-[var(--color-accent)] flex items-center gap-1.5">
              <FolderOpen size={13} />
              LOCAL DISK FOLDER ATTACHMENT
            </span>
            <span className="text-[9px] font-mono opacity-60">OFFLINE FIRST</span>
          </div>

          {!isLocalFsSupported && (
            <div className="p-2 border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px]">
              ⚠️ Your current browser does not support the native File System Access API. Chrome, Edge, or Opera recommended for local folder access.
            </div>
          )}

          <div className="p-2.5 border-2 border-brutalist bg-black/40 flex items-center justify-between">
            <div>
              <span className="text-[9px] uppercase font-mono opacity-60 block">SELECTED FOLDER</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {localFolderName || 'No local folder attached yet'}
              </span>
            </div>
            <button
              type="button"
              onClick={handlePickLocalFolder}
              className="py-1.5 px-3 border-2 border-brutalist bg-[var(--color-accent)] text-black hover:bg-[#c5a059] font-black text-xs uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_var(--color-border)]"
            >
              <FolderOpen size={13} />
              <span>{localFolderName ? 'CHANGE FOLDER' : 'SELECT FOLDER'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TERTIARY SECTION: NEW CLOUD CONNECTION FORM
          ───────────────────────────────────────────────────────────── */}
      {showNewConnectionForm && (
        <div className="border border-brutalist/60 bg-black/30 p-3 space-y-3">
          <span className="text-[10px] font-black uppercase text-[var(--color-accent)] block">
            CHOOSE PROVIDER TO CONNECT:
          </span>

          {/* Provider Selector Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ACTIVE_STORAGE_PROVIDERS.filter((p) => p !== 'local_fs').map((provId) => {
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
                      {cfg.shortName}
                    </span>
                    {isSelected && <Check size={12} className="text-[var(--color-accent)]" />}
                  </div>
                  <div className="text-[8px] font-mono opacity-50 uppercase mt-0.5">
                    {cfg.tag}
                  </div>
                </button>
              );
            })}
          </div>

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
