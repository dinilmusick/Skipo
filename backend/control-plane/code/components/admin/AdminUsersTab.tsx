'use client';

import React, { useState } from 'react';
import { User, Shield, Trash2, Search, Sparkles, Check, Folder, Save } from 'lucide-react';
import { BrutalistInput } from '../BrutalistUi';
import { IconOnlyButton } from '../IconOnlyButton';
import { UserAccount, UserRole } from '@/lib/types';

interface AdminUsersTabProps {
  users: Omit<UserAccount, 'passwordHash'>[];
  onUpdateUser: (userId: string, updates: { role?: UserRole; workspacePath?: string; workspaceName?: string; name?: string }) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  currentUserId?: string;
}

export default function AdminUsersTab({ users, onUpdateUser, onDeleteUser, currentUserId }: AdminUsersTabProps) {
  const [search, setSearch] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editWorkspacePath, setEditWorkspacePath] = useState('');
  const [editWorkspaceName, setEditWorkspaceName] = useState('');
  const [updating, setUpdating] = useState(false);

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleRoleToggle = async (user: Omit<UserAccount, 'passwordHash'>) => {
    setUpdating(true);
    try {
      const nextRole: UserRole = user.role === 'admin' ? 'user' : 'admin';
      await onUpdateUser(user.id, { role: nextRole });
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveWorkspace = async (userId: string) => {
    setUpdating(true);
    try {
      await onUpdateUser(userId, {
        workspacePath: editWorkspacePath,
        workspaceName: editWorkspaceName,
      });
      setEditingUserId(null);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs select-none">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
          <BrutalistInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="FILTER ACCOUNTS..."
            className="pl-8"
          />
        </div>
        <div className="px-3 py-2 border-2 border-[#D4AF37] bg-[#141310] text-[#D4AF37] font-black">
          {users.length}
        </div>
      </div>

      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {filtered.map((user) => {
          const isSelf = user.id === currentUserId;

          return (
            <div key={user.id} className="p-3 border-2 border-[#D4AF37]/40 bg-[#16151B] shadow-[2px_2px_0px_#000000] space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{user.avatarGlyph || '👤'}</span>
                  <div>
                    <div className="font-black text-xs text-[#F3EDE0] flex items-center gap-1.5">
                      <span>{user.name}</span>
                      {isSelf && <span className="text-[9px] px-1 bg-[#D4AF37] text-black font-black">YOU</span>}
                      <span className="text-[9px] px-1 bg-[#D4AF37]/20 text-[#D4AF37] uppercase font-bold">
                        {user.role}
                      </span>
                    </div>
                    <div className="text-[10px] opacity-75 text-[#D4AF37]">{user.email}</div>
                    <div className="text-[10px] opacity-60 text-[#F3EDE0] truncate max-w-[280px]">
                      📁 {user.workspaceName || 'Vault'}: {user.workspacePath || './docustack_vault'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <IconOnlyButton
                    icon={<Shield size={16} />}
                    tooltip={`Toggle Role (Current: ${user.role.toUpperCase()})`}
                    active={user.role === 'admin'}
                    disabled={updating}
                    onClick={() => handleRoleToggle(user)}
                  />

                  <IconOnlyButton
                    icon={<Folder size={16} />}
                    tooltip={`Edit Workspace Path & Folder (Current: ${user.workspaceName || 'Vault'})`}
                    active={editingUserId === user.id}
                    disabled={updating}
                    onClick={() => {
                      if (editingUserId === user.id) setEditingUserId(null);
                      else {
                        setEditingUserId(user.id);
                        setEditWorkspacePath(user.workspacePath || './docustack_vault');
                        setEditWorkspaceName(user.workspaceName || 'DocuStack Vault');
                      }
                    }}
                  />

                  {!isSelf && (
                    <IconOnlyButton
                      icon={<Trash2 size={16} />}
                      tooltip={`Delete Account [${user.email}]`}
                      variant="danger"
                      disabled={updating}
                      onClick={() => onDeleteUser(user.id)}
                    />
                  )}
                </div>
              </div>

              {editingUserId === user.id && (
                <div className="pt-2 border-t border-[#D4AF37]/30 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-[#D4AF37] font-bold block mb-0.5">WORKSPACE NAME</span>
                      <input
                        type="text"
                        value={editWorkspaceName}
                        onChange={(e) => setEditWorkspaceName(e.target.value)}
                        placeholder="Workspace Folder Name"
                        className="w-full px-2 py-1 border-2 border-[#D4AF37] bg-[#141310] font-mono text-xs text-[#F3EDE0]"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-[#D4AF37] font-bold block mb-0.5">FOLDER PATH</span>
                      <input
                        type="text"
                        value={editWorkspacePath}
                        onChange={(e) => setEditWorkspacePath(e.target.value)}
                        placeholder="e.g. /home/user/vault or ./docustack_vault"
                        className="w-full px-2 py-1 border-2 border-[#D4AF37] bg-[#141310] font-mono text-xs text-[#F3EDE0]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => handleSaveWorkspace(user.id)}
                      className="px-3 py-1 bg-[#D4AF37] text-black font-mono font-black text-xs hover:bg-[#F3EDE0] transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Save size={12} /> SAVE WORKSPACE CONFIG
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

