'use client';

import React from 'react';
import { Layers, Server, Shield, CheckCircle2, Cpu, HardDrive } from 'lucide-react';
import { WorkspaceRegistryItem } from '@/lib/control-plane-types';

interface AdminWorkspacesTabProps {
  workspaces: WorkspaceRegistryItem[];
}

export default function AdminWorkspacesTab({ workspaces }: AdminWorkspacesTabProps) {
  return (
    <div className="space-y-4 font-mono text-xs select-none">
      <div className="p-3 border-2 border-[#D4AF37] bg-[#1A1813] flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[#D4AF37] font-black uppercase text-xs">
          <Shield size={16} /> DATA PLANE ISOLATION
        </span>
        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500 text-[10px] font-black uppercase">
          VERIFIED
        </span>
      </div>

      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {workspaces.map((ws) => (
          <div key={ws.id} className="p-3 border-2 border-[#D4AF37]/40 bg-[#16151B] shadow-[2px_2px_0px_#000000] space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-black text-xs text-[#F3EDE0] flex items-center gap-2">
                <Layers size={14} className="text-[#D4AF37]" />
                <span>{ws.name}</span>
              </div>
              <span className="px-2 py-0.5 border border-[#D4AF37]/50 text-[10px] font-black uppercase bg-[#141310] text-[#D4AF37]">
                {(ws.backendConfig?.mode || 'Local').toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-2 border border-[#D4AF37]/30 bg-[#141310]">
                <div className="text-[9px] opacity-70 uppercase">DATA ENGINE</div>
                <div className="font-black text-[10px] uppercase text-[#D4AF37]">{ws.backendConfig?.dataProvider || 'local_fs'}</div>
              </div>
              <div className="p-2 border border-[#D4AF37]/30 bg-[#141310]">
                <div className="text-[9px] opacity-70 uppercase">STORAGE</div>
                <div className="font-black text-[10px] uppercase">{ws.backendConfig?.storageProvider || 'local'}</div>
              </div>
              <div className="p-2 border border-[#D4AF37]/30 bg-[#141310]">
                <div className="text-[9px] opacity-70 uppercase">DOCUMENTS</div>
                <div className="font-black text-[10px]">{ws.docCount ?? 0}</div>
              </div>
              <div className="p-2 border border-[#D4AF37]/30 bg-[#141310]">
                <div className="text-[9px] opacity-70 uppercase">MEDIA</div>
                <div className="font-black text-[10px]">{ws.mediaCount ?? 0}</div>
              </div>
            </div>

            <div className="text-[10px] opacity-70 pt-1 flex items-center justify-between text-[#D4AF37]">
              <span>OWNER: {ws.ownerEmail || ws.ownerId}</span>
              <span>{new Date(ws.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
