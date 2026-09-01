'use client';

import React from 'react';
import { Table, CheckCircle, Database, GitBranch, ShieldAlert } from 'lucide-react';
import { FunctionalityRegistryEntry } from '@/lib/control-plane-types';

interface AdminTablesTabProps {
  tables: FunctionalityRegistryEntry[];
}

export default function AdminTablesTab({ tables }: AdminTablesTabProps) {
  return (
    <div className="space-y-4 font-mono text-xs select-none">
      <div className="p-3 border-2 border-[#D4AF37] bg-[#1A1813] flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[#D4AF37] font-black uppercase text-xs">
          <Table size={15} /> FUNCTIONALITY TABLES
        </span>
        <span className="text-[10px] px-2 py-0.5 border border-[#D4AF37] bg-[#141310] font-black text-[#F3EDE0]">
          {tables.length} REGISTERED
        </span>
      </div>

      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {tables.map((tbl) => (
          <div key={tbl.id} className="p-3 border-2 border-[#D4AF37]/40 bg-[#16151B] shadow-[2px_2px_0px_#000000] space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-black text-xs text-[#F3EDE0] flex items-center gap-2">
                <Database size={14} className="text-[#D4AF37]" />
                <span>{tbl.name}</span>
                <span className="text-[10px] opacity-60 font-normal">({tbl.tableName})</span>
              </div>
              <span className="px-2 py-0.5 border border-emerald-500 text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-400">
                {tbl.autoMigrationStatus.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div className="p-1.5 border border-[#D4AF37]/30 bg-[#141310]">
                <span className="opacity-70 block">SERVICE</span>
                <span className="font-black uppercase text-[#D4AF37]">{tbl.service}</span>
              </div>
              <div className="p-1.5 border border-[#D4AF37]/30 bg-[#141310]">
                <span className="opacity-70 block">RECORDS</span>
                <span className="font-black uppercase">{tbl.recordCount}</span>
              </div>
              <div className="p-1.5 border border-[#D4AF37]/30 bg-[#141310]">
                <span className="opacity-70 block">ENGINE</span>
                <span className="font-black text-emerald-400">ATOMIC</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
