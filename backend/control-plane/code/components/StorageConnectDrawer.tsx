'use client';

import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Cloud,
  Globe,
  Radio,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Zap,
  Activity,
  Layers,
  ChevronDown,
  Shield,
} from 'lucide-react';
import {
  UserStorageConnection,
  UserStorageProvider,
  DatabaseEngine,
} from '@/lib/types';
import {
  STORAGE_PROVIDER_CONFIGS,
  StorageProviderMeta,
} from '@/lib/storage-providers';
import {
  isFileSystemAccessSupported,
  promptSelectLocalFolder,
  saveLocalDirectoryHandle,
  getLocalDirectoryHandle,
  verifyDirectoryHandlePermission,
} from '@/lib/local-fs-handle';
import { BrutalistButton, BrutalistBadge } from '../BrutalistUi';

interface StorageConnectDrawerProps {
  userToken?: string | null;
  currentConnectionId?: string;
  currentProvider?: UserStorageProvider;
  currentLocalFolderName?: string;
  currentLocalFolderKey?: string;
  onSelectLocalFolder: (folderName: string, folderKey: string) => void;
  onSelectCloudConnection: (connection: UserStorageConnection) => void;
  onSelectEngine: (engine: DatabaseEngine) => void;
  onConnectGoogleDrive?: () => void;
  googleDriveConnected?: boolean;
  googleDriveAccountEmail?: string;
}

export default function StorageConnectDrawer({
  userToken,
  currentConnectionId,
  currentProvider = 'local_fs',
  currentLocalFolderName,
  currentLocalFolderKey,
  onSelectLocalFolder,
  onSelectCloudConnection,
  onSelectEngine,
  onConnectGoogleDrive,
  googleDriveConnected,
  googleDriveAccountEmail,
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
    setFormData((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
  };

  const buildConnectionPayload = (): UserStorageConnection => {
    return {
      id: `conn_${selectedProvider}_${Date.now()}`,
      provider: selectedProvider,
      label: connectionLabel.trim() || `${STORAGE_PROVIDER_CONFIGS[selectedProvider]?.shortName || selectedProvider} Vault`,
      createdAt: new Date().toISOString(),
      ...formData,
    };
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      setGeneralError(null);

      const payload = buildConnectionPayload();
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

      if (selectedProvider === 'supabase_storage') {
        onSelectEngine('s3_blob');
      } else if (selectedProvider === 'backblaze_b2' || selectedProvider === 'cloudflare_r2' || selectedProvider === 'aws_s3') {
        onSelectEngine('s3_blob');
      }
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

  const currentProviderConfig = STORAGE_PROVIDER_CONFIGS[selectedProvider];
  const activeSavedConnsForProvider = savedConnections.filter((c) => c.provider === selectedProvider);

  return (
    <div className="space-y-4 border-2 border-brutalist bg-[var(--color-surface-subtle)] p-3.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-brutalist/40 pb-2">
        <div className="flex items-center gap-2">
          <HardDrive size={15} className="text-[var(--color-accent)]" />
          <span className="text-xs font-black uppercase text-[var(--color-text)]">
            WORKSPACE STORAGE ENGINE
          </span>
        </div>
        <span className="text-[9px] font-mono font-bold text-[var(--color-accent)] bg-black/40 px-2 py-0.5 border border-brutalist/40">
          USER OWNED
        </span>
      </div>

      {/* Provider Selector Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {(['local_fs', 'backblaze_b2', 'cloudflare_r2', 'supabase_storage', 'aws_s3', 'google_drive'] as UserStorageProvider[]).map((provId) => {
          const cfg = STORAGE_PROVIDER_CONFIGS[provId];
          const isSelected = selectedProvider === provId;
          const hasSaved = savedConnections.some((c) => c.provider === provId);

          return (
            <button
              key={provId}
              type="button"
              onClick={() => {
                setSelectedProvider(provId);
                setTestResult(null);
                setGeneralError(null);
                if (provId === 'local_fs') {
                  onSelectEngine('local_fs');
                } else if (provId === 'google_drive') {
                  onSelectEngine('google_drive');
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
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[8px] font-black uppercase px-1 py-0.2 border font-mono"
                    style={{
                      borderColor: cfg.color,
                      color: cfg.color,
                      backgroundColor: `${cfg.color}15`,
                    }}
                  >
                    {cfg.tag}
                  </span>
                  {isSelected && <Check size={11} className="text-[var(--color-accent)]" />}
                </div>
                <div className="text-[11px] font-black uppercase tracking-tight text-[var(--color-text)]">
                  {cfg.shortName}
                </div>
              </div>
              <div className="text-[9px] opacity-60 font-mono mt-1 leading-tight line-clamp-1">
                {cfg.freeTier}
              </div>
            </button>
          );
        })}
      </div>

      {/* Saved Connections Quick-Select for Current Provider */}
      {activeSavedConnsForProvider.length > 0 && selectedProvider !== 'local_fs' && selectedProvider !== 'google_drive' && (
        <div className="space-y-1.5 border border-brutalist/40 bg-black/30 p-2.5">
          <span className="text-[9px] font-black uppercase text-[var(--color-accent)] block">
            SAVED {currentProviderConfig.shortName.toUpperCase()} CONNECTIONS ON YOUR PROFILE:
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

        {/* GOOGLE DRIVE AREA */}
        {selectedProvider === 'google_drive' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-[#3B82F6] flex items-center gap-1.5">
                <Globe size={13} />
                GOOGLE DRIVE WORKSPACE
              </span>
              {googleDriveConnected ? (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 border border-emerald-500/40">
                  ✓ CONNECTED
                </span>
              ) : (
                <span className="text-[9px] bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 border border-amber-500/40">
                  AUTH REQUIRED
                </span>
              )}
            </div>

            <p className="text-[11px] opacity-80 leading-snug">
              Syncs documents with your personal Google Drive account under canonical folder structures.
            </p>

            {googleDriveConnected ? (
              <div className="text-xs p-2 border border-emerald-500/40 bg-emerald-500/10 space-y-1">
                <p className="text-[11px]">
                  Connected Account: <strong className="text-[var(--color-text)]">{googleDriveAccountEmail}</strong>
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={onConnectGoogleDrive}
                className="w-full py-2 px-3 border-2 border-brutalist bg-[#3B82F6] text-white hover:bg-blue-600 font-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer shadow-[2px_2px_0px_var(--color-border)]"
              >
                <Globe size={14} />
                <span>CONNECT GOOGLE DRIVE ACCOUNT</span>
              </button>
            )}
          </div>
        )}

        {/* CLOUD PROVIDERS (B2, R2, S3, Supabase) FORM */}
        {selectedProvider !== 'local_fs' && selectedProvider !== 'google_drive' && (
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
                    {testResult.ok ? `✓ CONNECTED SUCCESSFULLY (${testResult.latencyMs}ms latency)` : 'CONNECTIVITY FAILED'}
                  </div>
                  {testResult.error && <div className="text-[10px] mt-0.5 break-all">{testResult.error}</div>}
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
