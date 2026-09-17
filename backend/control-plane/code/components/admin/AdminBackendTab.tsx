'use client';

import React, { useState } from 'react';
import { Database, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { BrutalistInput } from '../BrutalistUi';
import { IconOnlyButton } from '../IconOnlyButton';
import { AdminBackendConfig, AdminBackendEngine } from '@/lib/control-plane-types';
import AdminDatabaseEngineFields from './AdminDatabaseEngineFields';

interface AdminBackendTabProps {
  config: AdminBackendConfig;
  engine: AdminBackendEngine;
  onSaveConfig: (updated: AdminBackendConfig) => Promise<void>;
  onTestConnection: (cfg: AdminBackendConfig) => Promise<{ success: boolean; message: string; latencyMs?: number }>;
  userToken: string | null;
}

export default function AdminBackendTab({ config, engine, onSaveConfig, onTestConnection, userToken }: AdminBackendTabProps) {
  const [profileName, setProfileName] = useState(config.activeProfile || 'Primary Control Plane');
  const [pgConn, setPgConn] = useState(config.postgres?.connectionString || '');
  const [pgHost, setPgHost] = useState(config.postgres?.host || 'localhost');
  const [pgDb, setPgDb] = useState(config.postgres?.database || 'docustack_control_plane');
  const [sbUrl, setSbUrl] = useState(config.supabase?.url || '');
  const [sbKey, setSbKey] = useState(config.supabase?.serviceRoleKey || '');
  const [sbAnonKey, setSbAnonKey] = useState(config.supabase?.anonKey || '');
  const [sbConnStr, setSbConnStr] = useState(config.supabase?.connectionString || '');
  const [sbTableName, setSbTableName] = useState(config.supabase?.tableName || 'users');
  const [neonConnStr, setNeonConnStr] = useState(config.neon?.connectionString || '');
  const [neonTableName, setNeonTableName] = useState(config.neon?.tableName || 'ultrst-users');
  const [firebaseProjectId, setFirebaseProjectId] = useState(config.firebase?.projectId || '');
  const [firebaseApiKey, setFirebaseApiKey] = useState(config.firebase?.apiKey || '');
  const [firebaseCollection, setFirebaseCollection] = useState(config.firebase?.collectionName || 'ultrst-users');
  const [remoteUrl, setRemoteUrl] = useState(config.remote_auth?.endpointUrl || '');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [provisioningNeon, setProvisioningNeon] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);

  const getCurrentConfigState = (): AdminBackendConfig => ({
    engine,
    activeProfile: profileName,
    sqlite: { dbPath: config.sqlite?.dbPath || '', walMode: config.sqlite?.walMode ?? false },
    postgres: { connectionString: pgConn, host: pgHost, port: 5432, database: pgDb, ssl: true },
    supabase: { url: sbUrl, serviceRoleKey: sbKey, anonKey: sbAnonKey, connectionString: sbConnStr, tableName: sbTableName || 'users' },
    neon: { connectionString: neonConnStr, tableName: neonTableName || 'ultrst-users' },
    firebase: { projectId: firebaseProjectId, apiKey: firebaseApiKey, collectionName: firebaseCollection || 'ultrst-users' },
    remote_auth: { endpointUrl: remoteUrl },
    status: 'connected',
  });

  const handleAutoProvisionNeon = async () => {
    if (!neonConnStr.trim() || !userToken) return;
    setProvisioningNeon(true);
    try {
      const res = await fetch('/api/admin/backend', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'provision_table', engine: 'neon', connectionString: neonConnStr.trim(), tableName: neonTableName.trim() || 'ultrst-users' }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message || (data.success ? 'Table provisioned in Neon!' : 'Provisioning failed') });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setProvisioningNeon(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await onTestConnection(getCurrentConfigState());
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveConfig(getCurrentConfigState());
      setTestResult({ success: true, message: 'Configuration successfully updated.' });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Failed to save configuration.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 font-mono select-none">
      <div className="flex items-center justify-between p-3 border-2 border-[#D4AF37] bg-[#1A1813]">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-[#D4AF37]" />
          <div>
            <h2 className="text-xs font-black uppercase text-[#F3EDE0] tracking-wider">ENGINE CONFIGURATION</h2>
            <div className="text-[10px] text-[#D4AF37] opacity-80">ACTIVE ENGINE: <strong className="uppercase">{engine}</strong></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IconOnlyButton icon={<RefreshCw size={16} className={testing ? 'animate-spin' : ''} />} tooltip="Test Connection" disabled={testing} onClick={handleTest} />
          <button type="button" onClick={handleSave} disabled={saving} className="px-3 py-1 text-xs font-black uppercase bg-[#D4AF37] text-black hover:bg-[#c5a059] transition-colors cursor-pointer">
            {saving ? 'SAVING...' : 'APPLY CONFIG'}
          </button>
        </div>
      </div>

      <div className="p-3 border-2 border-[#D4AF37]/50 bg-[#141318]">
        <label className="font-black uppercase block mb-1 text-xs text-[#D4AF37]">Profile Label</label>
        <BrutalistInput value={profileName} onChange={(e) => setProfileName(e.target.value)} />
      </div>

      <AdminDatabaseEngineFields
        engine={engine}
        pgConn={pgConn} setPgConn={setPgConn}
        pgHost={pgHost} setPgHost={setPgHost}
        pgDb={pgDb} setPgDb={setPgDb}
        sbUrl={sbUrl} setSbUrl={setSbUrl}
        sbKey={sbKey} setSbKey={setSbKey}
        sbAnonKey={sbAnonKey} setSbAnonKey={setSbAnonKey}
        sbTableName={sbTableName} setSbTableName={setSbTableName}
        sbConnStr={sbConnStr} setSbConnStr={setSbConnStr}
        neonConnStr={neonConnStr} setNeonConnStr={setNeonConnStr}
        neonTableName={neonTableName} setNeonTableName={setNeonTableName}
        firebaseProjectId={firebaseProjectId} setFirebaseProjectId={setFirebaseProjectId}
        firebaseApiKey={firebaseApiKey} setFirebaseApiKey={setFirebaseApiKey}
        firebaseCollection={firebaseCollection} setFirebaseCollection={setFirebaseCollection}
        remoteUrl={remoteUrl} setRemoteUrl={setRemoteUrl}
        onAutoProvisionNeon={handleAutoProvisionNeon}
        provisioningNeon={provisioningNeon}
      />

      {testResult && (
        <div className={`p-2.5 text-xs font-bold border-2 flex items-center gap-2 ${testResult.success ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300' : 'bg-red-950/60 border-red-500 text-red-300'}`}>
          {testResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{testResult.message} {testResult.latencyMs ? `(${testResult.latencyMs}ms)` : ''}</span>
        </div>
      )}
    </div>
  );
}
