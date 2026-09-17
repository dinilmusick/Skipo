'use client';

import React from 'react';
import { ArrowLeft, ShieldCheck, RefreshCw, LogOut, CheckCircle2, Lock, Database, Terminal } from 'lucide-react';
import { IconOnlyButton } from '../IconOnlyButton';
import { AdminDatabaseClusterConfig, ControlPlaneTelemetry } from '@/lib/control-plane-types';
import { UserAccount } from '@/lib/types';

interface AdminDashboardHeaderProps {
  currentUser: Omit<UserAccount, 'passwordHash'> | null;
  cluster: AdminDatabaseClusterConfig | null;
  telemetry: ControlPlaneTelemetry | null;
  activeTab: 'databases' | 'logs';
  setActiveTab: (tab: 'databases' | 'logs') => void;
  loading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}

export default function AdminDashboardHeader({
  currentUser,
  cluster,
  telemetry,
  activeTab,
  setActiveTab,
  loading,
  onRefresh,
  onLogout,
}: AdminDashboardHeaderProps) {
  return (
    <div className="space-y-4 select-none">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-2 border-[#D4AF37] bg-[#16151B] shadow-[6px_6px_0px_#D4AF37]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onLogout}
            className="p-2 border-2 border-[#D4AF37] bg-[#1A1813] hover:bg-[#D4AF37] hover:text-black transition-colors cursor-pointer"
            title="Return to Admin Login"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="p-2 border-2 border-[#D4AF37] bg-[#1A1813] text-[#D4AF37]">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black uppercase text-[#F3EDE0] tracking-wider">
              ADMIN CONTROL PLANE
            </h1>
            <div className="text-[10px] text-[#D4AF37] opacity-80 flex items-center gap-2">
              <span>ADMIN: {currentUser?.email}</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">DATABASE CLUSTER ACTIVE</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <IconOnlyButton
            icon={<RefreshCw size={16} className={loading ? 'animate-spin' : ''} />}
            tooltip="Refresh Database Pool"
            disabled={loading}
            onClick={onRefresh}
          />
          <IconOnlyButton
            icon={<LogOut size={16} />}
            tooltip="Terminate Admin Session"
            onClick={onLogout}
          />
        </div>
      </div>

      {/* Telemetry Status Grid */}
      {telemetry && cluster && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border-2 border-[#D4AF37]/50 bg-[#16151B] p-2.5 shadow-[3px_3px_0px_#000000]">
            <div className="text-[9px] opacity-70 uppercase font-black text-neutral-400">DATABASES CONFIGURED</div>
            <div className="font-black text-xs text-[#D4AF37] uppercase truncate mt-0.5">
              {cluster.databases.length} Connections
            </div>
          </div>
          <div className="border-2 border-[#D4AF37]/50 bg-[#16151B] p-2.5 shadow-[3px_3px_0px_#000000]">
            <div className="text-[9px] opacity-70 uppercase font-black text-neutral-400">REDUNDANT CLONES</div>
            <div className="font-black text-xs text-emerald-400 mt-0.5">
              {cluster.databases.filter((d) => d.enabled && d.role !== 'primary').length} Active Replicas
            </div>
          </div>
          <div className="border-2 border-[#D4AF37]/50 bg-[#16151B] p-2.5 shadow-[3px_3px_0px_#000000]">
            <div className="text-[9px] opacity-70 uppercase font-black text-neutral-400">TOTAL ACCOUNTS</div>
            <div className="font-black text-xs text-emerald-400 mt-0.5 flex items-center gap-1">
              <CheckCircle2 size={12} /> {telemetry.totalUsers} Registered
            </div>
          </div>
          <div className="border-2 border-[#D4AF37]/50 bg-[#16151B] p-2.5 shadow-[3px_3px_0px_#000000]">
            <div className="text-[9px] opacity-70 uppercase font-black text-neutral-400">ADMIN GUARD</div>
            <div className="font-black text-xs text-[#D4AF37] mt-0.5 flex items-center gap-1">
              <Lock size={12} /> ENFORCED
            </div>
          </div>
        </div>
      )}

      {/* Admin Tab Switcher */}
      <div className="flex items-center justify-center gap-4 border-2 border-[#D4AF37] p-2.5 bg-[#1A1813]">
        <IconOnlyButton
          icon={<Database size={18} />}
          tooltip="Database Storage & Redundancy Clones"
          badgeCount={cluster?.databases?.length}
          active={activeTab === 'databases'}
          onClick={() => setActiveTab('databases')}
        />
        <IconOnlyButton
          icon={<Terminal size={18} />}
          tooltip="Security Audit Logs"
          active={activeTab === 'logs'}
          onClick={() => setActiveTab('logs')}
        />
      </div>
    </div>
  );
}
