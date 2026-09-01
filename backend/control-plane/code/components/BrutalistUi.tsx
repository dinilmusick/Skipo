'use client';

import React, { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

// 1. Theme-Aware Brutalist Button
interface BrutalistButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'accent' | 'secondary' | 'surface' | 'subtle' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  active?: boolean;
}

export const BrutalistButton: React.FC<BrutalistButtonProps> = ({
  children,
  variant = 'surface',
  size = 'md',
  active = false,
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-[11px] h-7 font-black uppercase',
    md: 'px-3 py-1.5 text-xs h-9 font-black uppercase',
    lg: 'px-4 py-2.5 text-sm h-11 font-black uppercase',
    icon: 'h-8 w-8 flex items-center justify-center font-black',
  };

  const variantStyles = {
    accent: 'bg-[var(--color-accent)] text-black border-brutalist hover:brightness-110 active:translate-x-[1px] active:translate-y-[1px]',
    secondary: 'bg-[var(--color-accent-secondary)] text-black border-brutalist hover:brightness-110 active:translate-x-[1px] active:translate-y-[1px]',
    surface: 'bg-[var(--color-surface)] text-[var(--color-text)] border-brutalist hover:brightness-110 active:translate-x-[1px] active:translate-y-[1px]',
    subtle: 'bg-[var(--color-surface-subtle)] text-[var(--color-text)] border-brutalist hover:brightness-110 active:translate-x-[1px] active:translate-y-[1px]',
    ghost: 'bg-transparent text-current border-transparent hover:bg-black/10 hover:border-brutalist active:translate-y-[1px]',
  };

  const activeClass = active 
    ? 'bg-[var(--color-accent)]! text-black! shadow-[1px_1px_0px_var(--color-border)] translate-x-[1px] translate-y-[1px]'
    : 'shadow-[2px_2px_0px_var(--color-border)]';

  return (
    <button
      className={`border-2 inline-flex items-center justify-center gap-1.5 transition-all duration-75 select-none cursor-pointer ${sizeClasses[size]} ${variantStyles[variant]} ${activeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// 2. Theme-Aware Brutalist Card
interface BrutalistCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'subtle' | 'base';
  interactive?: boolean;
  depth?: 'sm' | 'md' | 'lg';
}

export const BrutalistCard: React.FC<BrutalistCardProps> = ({
  children,
  variant = 'surface',
  interactive = false,
  depth = 'md',
  className = '',
  style,
  ...props
}) => {
  const bgColors = {
    surface: 'bg-[var(--color-surface)] text-[var(--color-text)]',
    subtle: 'bg-[var(--color-surface-subtle)] text-[var(--color-text)]',
    base: 'bg-[var(--color-base)] text-[var(--color-text)]',
  };

  const shadows = {
    sm: 'shadow-[2px_2px_0px_var(--color-border)]',
    md: 'shadow-[4px_4px_0px_var(--color-border)]',
    lg: 'shadow-[6px_6px_0px_var(--color-border)]',
  };

  const hoverClass = interactive
    ? 'hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_var(--color-border)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0px_var(--color-border)]'
    : '';

  return (
    <div
      className={`border-2 border-brutalist p-3 select-none transition-all duration-100 ${bgColors[variant]} ${shadows[depth]} ${hoverClass} ${className}`}
      style={{
        borderColor: 'var(--color-border)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

// 3. Theme-Aware Brutalist Badge
interface BrutalistBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'accent' | 'secondary' | 'surface' | 'subtle';
}

export const BrutalistBadge: React.FC<BrutalistBadgeProps> = ({
  children,
  variant = 'accent',
  className = '',
  ...props
}) => {
  const variantStyles = {
    accent: 'bg-[var(--color-accent)] text-black border-brutalist',
    secondary: 'bg-[var(--color-accent-secondary)] text-black border-brutalist',
    surface: 'bg-[var(--color-surface)] text-[var(--color-text)] border-brutalist',
    subtle: 'bg-[var(--color-surface-subtle)] text-[var(--color-text)] border-brutalist',
  };

  return (
    <span
      className={`border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider select-none inline-block ${variantStyles[variant]} ${className}`}
      style={{ borderColor: 'var(--color-border)' }}
      {...props}
    >
      {children}
    </span>
  );
};

// 4. Theme-Aware Brutalist Inputs and Selects
export const BrutalistInput: React.FC<InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...props
}) => {
  return (
    <input
      className={`w-full border-2 border-brutalist bg-[var(--color-surface-subtle)] text-[var(--color-text)] px-2.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] placeholder-muted transition-all ${className}`}
      style={{ borderColor: 'var(--color-border)' }}
      {...props}
    />
  );
};

export const BrutalistSelect: React.FC<SelectHTMLAttributes<HTMLSelectElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <select
      className={`border-2 border-brutalist bg-[var(--color-surface-subtle)] text-[var(--color-text)] px-2.5 py-1.5 text-xs font-mono font-black uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] transition-all cursor-pointer ${className}`}
      style={{ borderColor: 'var(--color-border)' }}
      {...props}
    >
      {children}
    </select>
  );
};

// 5. Brutalist Headings
interface BrutalistHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4;
}

export const BrutalistHeading: React.FC<BrutalistHeadingProps> = ({
  level = 3,
  children,
  className = '',
  ...props
}) => {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
  const sizes = {
    1: 'text-2xl font-black uppercase tracking-tight',
    2: 'text-xl font-black uppercase tracking-wide',
    3: 'text-sm font-black uppercase tracking-wider',
    4: 'text-xs font-bold uppercase tracking-wider',
  };

  return (
    <Tag
      className={`${sizes[level]} text-[var(--color-text)] ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
};
