---
name: skipo-component-authoring
description: Strict guidelines and blueprints for authoring application-specific UI and backend components by inheriting from @skipo/ui base classes and @skipo/core / @skipo/backend foundations.
---

# SKIPO COMPONENT AUTHORING & INHERITANCE GUIDE

Universal reference for AI agents constructing custom application features. Enforces strict base class inheritance, theme token cascading, and architectural constraint compliance.

---

## 1. UI Component Authoring: Inheritance Patterns

Every custom component created for an application MUST extend or compose `@skipo/ui` base primitives.

### A. Custom Button Example
```tsx
'use client';

import React from 'react';
import { BaseButton, BaseButtonProps } from '@skipo/ui';

export interface ActionButtonProps extends Omit<BaseButtonProps, 'variant'> {
  actionType: 'primary' | 'destructive' | 'neutral';
}

export const ActionButton: React.FC<ActionButtonProps> = ({ actionType, children, ...props }) => {
  const variantMap = {
    primary: 'accent' as const,
    destructive: 'danger' as const,
    neutral: 'secondary' as const,
  };

  return (
    <BaseButton variant={variantMap[actionType]} {...props}>
      {children}
    </BaseButton>
  );
};
```

### B. Custom Card Container Example
```tsx
'use client';

import React from 'react';
import { BaseCard, BaseBadge } from '@skipo/ui';

export interface ProjectCardProps {
  title: string;
  status: 'active' | 'archived';
  description: string;
  onClick?: () => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ title, status, description, onClick }) => {
  return (
    <BaseCard depth="md" interactive onClick={onClick} className="project-card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-base text-[var(--skipo-text)]">{title}</h3>
        <BaseBadge variant={status === 'active' ? 'success' : 'neutral'}>
          {status}
        </BaseBadge>
      </div>
      <p className="text-sm text-[var(--skipo-text-muted)]">{description}</p>
    </BaseCard>
  );
};
```

---

## 2. Inviolable Component Rules

1. **Zero Raw HTML Controls**:
   - `❌ <button onClick={...}>` $\longrightarrow$ `✅ <BaseButton onClick={...}>`
   - `❌ <input type="text" ...>` $\longrightarrow$ `✅ <BaseInput ...>`
   - `❌ <textarea ...>` $\longrightarrow$ `✅ <BaseTextarea ...>`
   - `❌ <select ...>` $\longrightarrow$ `✅ <BaseSelect ...>`
2. **Mandatory Theme Tokens**:
   - Never hardcode HEX colors or RGB values in inline styles.
   - Use CSS custom properties: `var(--skipo-bg)`, `var(--skipo-text)`, `var(--skipo-accent)`, `var(--skipo-border)`.
3. **One Component Per File**:
   - Exactly one exported component per `.tsx` file.
   - Accompanying types and small pure helpers ($< 20$ lines) are permitted.
4. **200-Line Limit**:
   - If a component grows beyond 180 lines, extract sub-views into separate sibling files.

---

## 3. Backend Service Authoring: Foundation Inheritance

All backend services, providers, and controllers MUST inherit from `SkipoBase` or domain-specific base classes.

### A. Custom Service Class
```typescript
import { SkipoBase, type SkipoConfig } from '@skipo/core';

export interface TaskManagerConfig extends SkipoConfig {
  maxConcurrency: number;
}

export class TaskManagerService extends SkipoBase {
  private maxConcurrency: number;

  constructor(config: TaskManagerConfig) {
    super(config);
    this.maxConcurrency = config.maxConcurrency;
  }

  protected async onInitialize(): Promise<void> {
    this.logger.log(`Initializing TaskManager with concurrency: ${this.maxConcurrency}`);
  }

  protected async onDispose(): Promise<void> {
    this.logger.log('Disposing TaskManager workers');
  }

  public async executeTask(taskId: string): Promise<void> {
    this.ensureInitialized();
    this.ensureNotDisposed();
    // Implementation
  }
}
```

### B. Custom Account Provider
Extend `BaseAccountProvider` to implement custom identity persistence (e.g. Postgres, DynamoDB) while automatically inheriting password hashing, rate limiting, session management, and admin bootstrap protection.
```typescript
import { BaseAccountProvider, type User, type CreateUserData } from '@skipo/backend/auth';

export class CustomDbAccountProvider extends BaseAccountProvider {
  protected async findUserByEmail(email: string): Promise<User | null> {
    // Custom database query
    return null;
  }

  protected async createUser(data: CreateUserData): Promise<User> {
    // Custom database insert
    return {} as User;
  }

  protected async updateUser(id: string, patch: Partial<User>): Promise<User> {
    // Custom database update
    return {} as User;
  }

  protected async findUserById(id: string): Promise<User | null> {
    return null;
  }

  protected async listUsers(): Promise<User[]> {
    return [];
  }
}
```

---

## 4. Summary & Verification

When reviewing generated code:
1. Does every UI element trace back to `@skipo/ui`?
2. Does every backend service extend `SkipoBase`?
3. Does every file stay under 200 lines?
4. Does `npx skipo-validate` succeed with 0 violations?
