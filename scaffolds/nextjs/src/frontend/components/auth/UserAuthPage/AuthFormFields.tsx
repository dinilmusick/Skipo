// ══════════════════════════════════════════════════════════════════════════════
// AUTH FORM FIELDS COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { BaseInput } from '../../../../libraries/skipo/ui/components/base/BaseInput';
import { BaseButton } from '../../../../libraries/skipo/ui/components/base/BaseButton';

interface AuthFormFieldsProps {
  authMode: 'login' | 'register';
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
}

export const AuthFormFields: React.FC<AuthFormFieldsProps> = ({
  authMode,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
}) => {
  return (
    <>
      {authMode === 'register' && (
        <div>
          <label
            htmlFor="user-name-input"
            className="block text-[11px] font-bold text-[var(--skipo-text-muted)] uppercase tracking-wider mb-1"
          >
            Full Name
          </label>
          <BaseInput
            id="user-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Developer"
            required
            className="w-full"
          />
        </div>
      )}

      <div>
        <label
          htmlFor="user-email-input"
          className="block text-[11px] font-bold text-[var(--skipo-text-muted)] uppercase tracking-wider mb-1"
        >
          Email Address or Username
        </label>
        <BaseInput
          id="user-email-input"
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g. operator or developer@example.com"
          autoComplete="username"
          required
          className="w-full"
        />
      </div>

      <div>
        <label
          htmlFor="user-password-input"
          className="block text-[11px] font-bold text-[var(--skipo-text-muted)] uppercase tracking-wider mb-1"
        >
          Password
        </label>
        <div className="relative">
          <BaseInput
            id="user-password-input"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
            required
            className="w-full pr-10"
          />
          <BaseButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1.5 text-[var(--skipo-text-muted)] hover:text-[var(--skipo-text)] cursor-pointer"
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </BaseButton>
        </div>
      </div>
    </>
  );
};
