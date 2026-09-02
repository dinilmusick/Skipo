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
  FileText,
} from 'lucide-react';
import {
  UserStorageConnection,
  UserStorageProvider,
  DatabaseEngine,
  UltrstStorageExport,
  UltrstStorageBundleExport,
} from '@/lib/types';
import {
  STORAGE_PROVIDER_CONFIGS,
  exportStorageConnectionToJson,
  exportStorageBundleToJson,
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
  const [savedConnections, setSavedConnections] = useState<UserStorageConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);

  // Form Fields State
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

  const runProbeTest = async (payload: UserStorageConnection) => {
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
    await runProbeTest(payload);
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
      onSelectCloudConnection(data.connection);
      onSelectEngine('s3_blob');
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
      }
    } catch (err: any) {
      alert(`Failed to delete connection: ${err.message}`);
    }
  };

  // EXPORT CURRENT CREDENTIALS AS JSON
  const handleExportJson = () => {
    try {
      const payload = buildConnectionPayload();
      const exportDoc = exportStorageConnectionToJson(payload, 'docustack');
      const jsonString = JSON.stringify(exportDoc, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const safeLabel = (payload.label || payload.provider).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
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

  // IMPORT CREDENTIALS FROM JSON
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
        // Multi-connection bundle: import the first into active view, and offer to save all
        const first = parsed.connections[0];
        loadConnectionIntoForm(first);
        setImportNotification(`✓ Imported bundle containing ${parsed.connections.length} storage connections. Active: ${first.label}`);
        // Run test probe on first
        if (first.provider !== 'local_fs') {
          runProbeTest(first);
        }
      } else if (parsed.connection) {
        const conn = parsed.connection;
        loadConnectionIntoForm(conn);
        setImportNotification(`✓ Successfully loaded credentials for "${conn.label || conn.provider}".`);
        if (conn.provider !== 'local_fs') {
          runProbeTest(conn);
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
  const activeSavedConnsForProvider = savedConnections.filter((c) => c.provider === selectedProvider);

  // Diagnostic warning check for Backblaze B2 key swap
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
            WORKSPACE STORAGE ENGINE
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

      {/* Import Notification Banner */}
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

      {/* Provider Selector Clean Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                setImportNotification(null);
                if (provId === 'local_fs') {
                  onSelectEngine('local_fs');
                } else {
                  onSelectEngine('s3_blob');
                }
              }}
              className={`p-2.5 text-left border-2 transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-[var(--color-accent)] bg-black/40 shadow-[2px_2px_0px_var(--color-accent)]'
                  : 'border-brutalist/40 bg-black/15 hover:border-brutalist hover:bg-black/25'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-black uppercase tracking-tight text-[var(--color-text)]">
                  {cfg.shortName}
                </span>
                {isSelected && <Check size={13} className="text-[var(--color-accent)]" />}
              </div>
              <div className="text-[9px] font-mono opacity-50 uppercase mt-1">
                {cfg.tag}
              </div>
            </button>
          );
        })}
      </div>

      {/* Saved Connections Quick-Select */}
      {activeSavedConnsForProvider.length > 0 && selectedProvider !== 'local_fs' && (
        <div className="space-y-1.5 border border-brutalist/40 bg-black/30 p-2.5">
          <span className="text-[9px] font-black uppercase text-[var(--color-accent)] block">
            SAVED {currentProviderConfig?.shortName.toUpperCase()} CONNECTIONS ON YOUR PROFILE:
          </span>
          <div className="space-y-1">
            {activeSavedConnsForProvider.map((conn) => {
              const isSelected = currentConnectionId === conn.id;
              return (
                <div
                  key={conn.id}
                  onClick={() => onSelectCloudConnection(conn)}
                  className={`p-2 border flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-brutalist/40 bg-black/20 hover:border-brutalist hover:bg-black/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={13} className={isSelected ? 'text-emerald-400' : 'opacity-40'} />
                    <div>
                      <div className="text-xs font-black text-[var(--color-text)] uppercase">{conn.label}</div>
                      <div className="text-[9px] font-mono opacity-60">
                        Bucket: {conn.b2BucketName || conn.r2BucketName || conn.s3BucketName || conn.supabaseBucketName}
                        {conn.latencyMs ? ` · ${conn.latencyMs}ms` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <span className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.5 font-bold uppercase">
                        ACTIVE
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSavedConnection(conn.id, e)}
                      className="p-1 text-red-400 hover:bg-red-500/20 border border-red-500/30"
                      title="Delete connection"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Provider Details & Input Area */}
      <div className="border border-brutalist/50 bg-black/25 p-3 space-y-3">
        {/* LOCAL FOLDER AREA */}
        {selectedProvider === 'local_fs' && (
          <div className="space-y-2.5">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-[var(--color-accent)] flex items-center gap-1.5">
                <FolderOpen size={13} />
                BROWSER LOCAL DISK STORAGE
              </span>
              <p className="text-[11px] opacity-80 leading-snug">
                Select any folder on your computer. When opening the app from the browser (Vercel or localhost),
                the app connects directly to your local files using the standard File System Access API.
              </p>
            </div>

            {!isLocalFsSupported && (
              <div className="p-2 border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px]">
                ⚠️ Your current browser does not support the native File System Access API. Chrome, Edge, or Opera recommended for local folder access.
              </div>
            )}

            <div className="p-2.5 border-2 border-brutalist bg-black/40 flex items-center justify-between">
              <div>
                <span className="text-[9px] uppercase font-mono opacity-60 block">SELECTED LOCAL FOLDER</span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {localFolderName || 'No folder selected yet'}
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

            {localFolderName && (
              <p className="text-[9px] opacity-60 font-mono">
                ✓ Handle stored in browser IndexedDB · Will auto-prompt permission on subsequent sessions.
              </p>
            )}
          </div>
        )}

        {/* CLOUD PROVIDERS (B2, R2, S3, Supabase) FORM */}
        {selectedProvider !== 'local_fs' && currentProviderConfig && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-[var(--color-accent)]">
                  CONNECT NEW {currentProviderConfig.shortName.toUpperCase()} BUCKET
                </span>
                <p className="text-[10px] opacity-70 leading-tight mt-0.5">
                  {currentProviderConfig.description}
                </p>
              </div>
            </div>

            {/* Connection Name */}
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
                ⚠️ Notice: In Backblaze B2, the <strong>Key ID</strong> is 25 characters (starts with 000–005), and the <strong>Application Key</strong> is the 31-character secret starting with K00. If entered in opposite fields, our engine will automatically swap and resolve them for you.
              </div>
            )}

            {/* Dynamic Provider Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentProviderConfig.fields.map((field) => (
                <div key={field.key} className={field.key.includes('Key') || field.key.includes('Secret') || field.key.includes('Endpoint') ? 'sm:col-span-2' : ''}>
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
                    {testResult.ok ? `✓ CONNECTED SUCCESSFULLY (${testResult.latencyMs}ms latency)` : 'CONNECTIVITY FAILED'}
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
                className="py-1.5 px-3 border border-brutalist bg-black/40 hover:bg-black/70 font-black text-xs uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Activity size={12} className={testing ? 'animate-spin' : ''} />
                <span>{testing ? 'PROBING...' : 'TEST CONNECTIVITY'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAndUse}
                disabled={testing || saving}
                className="flex-1 py-1.5 px-3 border-2 border-brutalist bg-[var(--color-accent)] text-black hover:bg-[#c5a059] font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-[2px_2px_0px_var(--color-border)]"
              >
                <Zap size={13} />
                <span>{saving ? 'SAVING...' : 'SAVE & CONNECT STORAGE'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
