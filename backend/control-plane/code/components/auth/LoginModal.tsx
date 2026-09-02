'use client';

import React, { useState } from 'react';
import { LogIn, UserPlus, Shield, X, Check, AlertTriangle, Key, Mail, User, ShieldCheck, Eye, EyeOff, Folder } from 'lucide-react';
import { UserAccount, UserRole } from '@/lib/types';
import { BrutalistButton, BrutalistCard, BrutalistInput, BrutalistBadge } from '../BrutalistUi';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Omit<UserAccount, 'passwordHash'> | null;
  onLoginSuccess: (user: Omit<UserAccount, 'passwordHash'>, token: string) => void;
  onLogout: () => void;
  onOpenAdminPanel?: () => void;
}

export default function LoginModal({ isOpen, onClose, currentUser, onLoginSuccess, onLogout, onOpenAdminPanel }: LoginModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = tab === 'login' ? { email, password } : { email, password, name, role };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Request failed');
      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <BrutalistCard variant="surface" depth="lg" className="w-full max-w-md p-5 border-2 border-brutalist animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b-2 border-brutalist">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-[var(--color-accent)]" />
            <h2 className="font-mono text-sm font-black uppercase tracking-wider">
              {currentUser ? 'AUTHENTICATED SESSION' : tab === 'login' ? 'SIGN IN TO VAULT' : 'CREATE VAULT ACCOUNT'}
            </h2>
          </div>
          <BrutalistButton variant="ghost" size="icon" onClick={onClose}><X size={16} /></BrutalistButton>
        </div>

        {currentUser ? (
          <div className="mt-4 space-y-4">
            <div className="p-3 border-2 border-brutalist bg-black/10 flex items-center gap-3">
              <span className="text-2xl">{currentUser.avatarGlyph || '👤'}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-black">{currentUser.name}</span>
                  <BrutalistBadge variant="accent">{currentUser.role.toUpperCase()}</BrutalistBadge>
                </div>
                <div className="font-mono text-xs opacity-70">{currentUser.email}</div>
                {currentUser.workspacePath && (
                  <div className="font-mono text-[10px] opacity-60 flex items-center gap-1 mt-1">
                    <Folder size={11} /> {currentUser.workspaceName || 'Vault'}: {currentUser.workspacePath}
                  </div>
                )}
              </div>
            </div>
            {currentUser.role === 'admin' && onOpenAdminPanel && (
              <BrutalistButton
                variant="accent"
                className="w-full flex items-center justify-center gap-2 font-mono font-black text-xs"
                onClick={() => {
                  onClose();
                  onOpenAdminPanel();
                }}
              >
                <ShieldCheck size={16} /> OPEN ADMIN CONTROL PLANE
              </BrutalistButton>
            )}
            <div className="flex gap-2 pt-2">
              <BrutalistButton variant="secondary" className="w-full text-red-500 hover:bg-red-500/20" onClick={() => { onLogout(); onClose(); }}>
                DISCONNECT SESSION
              </BrutalistButton>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Tab switch */}
            <div className="flex border-2 border-brutalist">
              <button
                type="button"
                className={`flex-1 py-1.5 font-mono text-xs font-black uppercase ${tab === 'login' ? 'bg-[var(--color-accent)] text-white' : 'bg-black/10'}`}
                onClick={() => { setTab('login'); setError(null); }}
              >
                SIGN IN
              </button>
              <button
                type="button"
                className={`flex-1 py-1.5 font-mono text-xs font-black uppercase ${tab === 'register' ? 'bg-[var(--color-accent)] text-white' : 'bg-black/10'}`}
                onClick={() => { setTab('register'); setError(null); }}
              >
                NEW ACCOUNT
              </button>
            </div>

            {error && (
              <div className="p-2.5 bg-red-500/20 border-2 border-red-500 text-red-400 font-mono text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {tab === 'register' && (
                <div>
                  <label className="font-mono text-[10px] uppercase font-bold block mb-1">Display Name</label>
                  <BrutalistInput
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Hunter"
                    required
                  />
                </div>
              )}
              <div>
                <label className="font-mono text-[10px] uppercase font-bold block mb-1">Email Address</label>
                <BrutalistInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@docustack.vault"
                  required
                />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase font-bold block mb-1">Password</label>
                <div className="relative flex items-center">
                  <BrutalistInput
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 p-1 text-[var(--color-accent)] hover:text-[var(--color-text)] focus:outline-none transition-colors cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {tab === 'register' && (
                <div>
                  <label className="font-mono text-[10px] uppercase font-bold block mb-1">Account Role</label>
                  <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                    {(['user', 'pro', 'admin'] as UserRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`p-1.5 border-2 border-brutalist uppercase font-bold ${role === r ? 'bg-[var(--color-accent)] text-white' : 'bg-black/10'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <BrutalistButton variant="accent" className="w-full mt-2" disabled={loading}>
                {loading ? 'AUTHENTICATING...' : tab === 'login' ? 'ENTER WORKSPACE' : 'CREATE ACCOUNT & ENTER'}
              </BrutalistButton>
            </form>
          </div>
        )}
      </BrutalistCard>
    </div>
  );
}

