'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Database, Terminal, RefreshCw, AlertCircle } from 'lucide-react';
import { BrutalistCard } from '../BrutalistUi';
import { IconOnlyButton } from '../IconOnlyButton';
import { AdminDatabaseClusterConfig, ControlPlaneTelemetry } from '@/lib/control-plane-types';
import { UserAccount } from '@/lib/types';
import AdminDatabaseClusterTab from './AdminDatabaseClusterTab';
import AdminAuditTab from './AdminAuditTab';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToken: string | null;
  currentUser: Omit<UserAccount, 'passwordHash'> | null;
}

export default function AdminPanelModal({ isOpen, onClose, userToken }: AdminPanelModalProps) {
  const [activeTab, setActiveTab] = useState<'databases' | 'logs'>('databases');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cluster, setCluster] = useState<AdminDatabaseClusterConfig | null>(null);
  const [telemetry, setTelemetry] = useState<ControlPlaneTelemetry | null>(null);

  const fetchAdminData = async () => {
    if (!userToken) return;
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' };
      const res = await fetch('/api/admin/backend', { headers });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!data.success) throw new Error(data.error || 'Failed to load control plane');
      setCluster(data.cluster);
      setTelemetry(data.telemetry);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchAdminData();
  }, [isOpen, userToken]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <BrutalistCard variant="surface" depth="lg" className="border-2 border-[#D4AF37] p-4 sm:p-5 bg-[#141310] shadow-[8px_8px_0px_#D4AF37]">
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#D4AF37] mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 border-2 border-[#D4AF37] bg-[#D4AF37] text-black">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2 className="font-mono text-sm sm:text-base font-black uppercase text-[#F3EDE0] tracking-tight">
                  ADMIN CONTROL PLANE
                </h2>
                <p className="font-mono text-[10px] text-[#D4AF37] opacity-80">
                  Accounts Database, Redundant Clones & System Logs
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 border-2 border-[#D4AF37] text-[#F3EDE0] hover:bg-[#D4AF37] hover:text-black transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/15 border-2 border-red-500 text-red-400 font-mono text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span className="font-bold">{error}</span>
            </div>
          )}

          {/* 2 Navigation Tabs: Databases & Logs */}
          <div className="flex items-center justify-center gap-4 border-2 border-[#D4AF37] p-2.5 bg-[#1A1813] mb-4 overflow-x-auto">
            <IconOnlyButton
              icon={<Database size={18} />}
              tooltip="Database Storage & Redundancy Clones"
              badgeCount={cluster?.databases?.length}
              active={activeTab === 'databases'}
              onClick={() => setActiveTab('databases')}
            />
            <IconOnlyButton
              icon={<Terminal size={18} />}
              tooltip="Security & System Audit Logs"
              active={activeTab === 'logs'}
              onClick={() => setActiveTab('logs')}
            />
          </div>

          {loading && !cluster ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 font-mono text-xs font-black text-[#D4AF37]">
              <RefreshCw size={24} className="animate-spin" />
              <span>SYNCHRONIZING CONTROL PLANE...</span>
            </div>
          ) : (
            <div>
              {activeTab === 'databases' && cluster && (
                <AdminDatabaseClusterTab
                  cluster={cluster}
                  userToken={userToken}
                  onRefresh={fetchAdminData}
                />
              )}
              {activeTab === 'logs' && <AdminAuditTab userToken={userToken} />}
            </div>
          )}
        </BrutalistCard>
      </div>
    </div>
  );
}
