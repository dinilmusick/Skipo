export * from './types';
import { UserAuthPageProps } from './types';

// @generated
// ══════════════════════════════════════════════════════════════════════════════
// DEDICATED USER AUTHENTICATION & REGISTRATION PORTAL
// Isolated from Admin Login with Neo-Brutalist design tokens
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  Layers,
  Lock,
  UserPlus,
  LogIn,
  Eye,
  EyeOff,
  Shield,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '../../../frontend-state/appStore';
import { BaseButton } from '../../../../libraries/skipo/ui/components/base/BaseButton';
import { UserAuthHeader } from './UserAuthHeader';
import { AuthStatusBox } from './AuthStatusBox';
import { UserAuthFooterBar } from './UserAuthFooter';
import { AdminGatewayInfo } from './AdminGatewayInfo';
import { AuthFormFields } from './AuthFormFields';

import { apiClient } from '../../../../libraries/client/apiClient';

export const UserAuthPage: React.FC<UserAuthPageProps> = ({
  onSwitchToAdminPortal,
  onLoginSuccess,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Email address is required.');
      return;
    }

    if (!password) {
      setError('Password is required.');
      return;
    }

    setLoading(true);

    try {
      if (authMode === 'login') {
        const data = await apiClient.login(cleanEmail, password);
        if (!data.success) {
          throw new Error(data.error || 'Login failed. Please check your credentials.');
        }
        useAppStore.getState().login(data.user, data.token);
      } else {
        if (!name.trim()) {
          throw new Error('Please enter your full name or display name.');
        }
        if (password.length < 4) {
          throw new Error('Password must be at least 4 characters long.');
        }
        const data = await apiClient.register({
          name: name.trim(),
          email: cleanEmail,
          password,
          role: 'user',
        });
        if (!data.success) {
          throw new Error(data.error || 'Registration failed.');
        }
        useAppStore.getState().login(data.user, data.token);
      }

      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--skipo-bg)] text-[var(--skipo-text)] font-mono flex flex-col justify-between select-none relative">
      {/* Top Navbar */}
      <UserAuthHeader onSwitchToAdminPortal={onSwitchToAdminPortal} />

      {/* Main Authentication Box */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md border-2 border-[var(--skipo-border-color)] bg-[var(--skipo-surface)] shadow-[6px_6px_0px_var(--skipo-border-color)] p-6">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-2 mb-6 border-b border-[var(--skipo-border-color)] pb-3">
            <BaseButton
              type="button"
              variant={authMode === 'login' ? 'accent' : 'ghost'}
              size="sm"
              onClick={() => {
                setAuthMode('login');
                setError(null);
              }}
              className="py-2 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogIn size={13} />
              <span>SIGN IN</span>
            </BaseButton>

            <BaseButton
              type="button"
              variant={authMode === 'register' ? 'accent' : 'ghost'}
              size="sm"
              onClick={() => {
                setAuthMode('register');
                setError(null);
              }}
              className="py-2 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserPlus size={13} />
              <span>CREATE ACCOUNT</span>
            </BaseButton>
          </div>
          <AuthStatusBox authMode={authMode} error={error} />
          <form onSubmit={handleSubmit} className="space-y-4">
            <AuthFormFields
              authMode={authMode}
              name={name}
              setName={setName}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
            />

            <BaseButton
              type="submit"
              disabled={loading}
              variant="accent"
              size="md"
              className="w-full py-2.5 bg-[var(--skipo-accent)] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[2px_2px_0px_var(--skipo-border-color)] disabled:opacity-50 transition-all mt-2"
            >
              <LogIn size={14} />
              <span>{loading ? 'PROCESSING...' : authMode === 'login' ? 'SIGN IN TO WORKSPACE' : 'CREATE ACCOUNT'}</span>
            </BaseButton>
          </form>

          <AdminGatewayInfo onSwitchToAdminPortal={onSwitchToAdminPortal} />
        </div>
      </main>

      <UserAuthFooterBar />
    </div>
  );
};

export default UserAuthPage;
