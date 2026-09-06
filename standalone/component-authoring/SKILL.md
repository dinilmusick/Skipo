---
name: skipo-component-authoring
description: Strict guidelines and blueprints for authoring application-specific UI and backend components by inheriting from @skipo/ui base classes and @skipo/core / @skipo/backend foundations.
---

# SKIPO COMPONENT AUTHORING & INHERITANCE GUIDE

Universal reference for AI agents constructing custom application features. Enforces strict base class inheritance, theme token cascading, and architectural constraint compliance.

---

## 1. UI Component Authoring: Inheritance Patterns

Every custom component created for an application MUST extend or compose `@skipo/ui` base primitives.

### A. Icon-Only Action Button Pattern
Interactive action buttons MUST NOT have static text labels. The label appears exclusively in the bottom strip center on hover.
```tsx
'use client';
import React from 'react';
import { IconOnlyButton, BaseButtonProps } from '@skipo/ui';

export interface DeleteActionProps {
  onDelete: () => void;
  itemName: string;
}

export const DeleteActionButton: React.FC<DeleteActionProps> = ({ onDelete, itemName }) => {
  return (
    <IconOnlyButton
      variant="danger"
      label={`DELETE ${itemName.toUpperCase()} (PERMANENT REMOVAL)`}
      onClick={onDelete}
      icon={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      }
    />
  );
};
```

### B. Credential Input Pattern with External Key Portal Link
Any field asking for external credentials MUST use `CredentialField` with a link directly to the service's key generation dashboard.
```tsx
'use client';
import React from 'react';
import { CredentialField } from '@skipo/ui';

export interface ProviderApiConfigProps {
  apiKey: string;
  onChangeKey: (val: string) => void;
}

export const OpenAiKeyInput: React.FC<ProviderApiConfigProps> = ({ apiKey, onChangeKey }) => {
  return (
    <CredentialField
      serviceId="openai"
      value={apiKey}
      onChange={(e) => onChangeKey(e.target.value)}
      placeholder="sk-proj-..."
    />
  );
};
```

### C. Top Toolbar Navigation Pattern (Flat Tabs Only)
All primary navigation MUST be flat in `TopToolbar`. Creating nested tabs inside child views is strictly forbidden.
```tsx
'use client';
import React from 'react';
import { TopToolbar, TopToolbarTab } from '@skipo/ui';

const APP_TABS: TopToolbarTab[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'settings', label: 'Settings' }
];

export const AppNavigation: React.FC<{ activeTab: string; onSelect: (id: string) => void }> = ({
  activeTab,
  onSelect
}) => {
  return (
    <TopToolbar
      title="MY APPLICATION"
      tabs={APP_TABS}
      activeTabId={activeTab}
      onSelectTab={onSelect}
    />
  );
};
```

---

## 2. Inviolable Component Rules

1. **Zero Raw HTML Controls**:
   - `❌ <button onClick={...}>` $\longrightarrow$ `✅ <BaseButton onClick={...}>` or `<IconOnlyButton ...>`
   - `❌ <input type="text" ...>` $\longrightarrow$ `✅ <BaseInput ...>` or `<CredentialField ...>`
   - `❌ <textarea ...>` $\longrightarrow$ `✅ <BaseTextarea ...>`
   - `❌ <select ...>` $\longrightarrow$ `✅ <BaseSelect ...>`
2. **Zero Floating Tooltip Bubbles**:
   - Never render floating `.skipo-tooltip` bubbles or popover text. Hovering an element MUST route text to the bottom strip center.
3. **Zero Static Text Labels on Interactive Buttons**:
   - Buttons in toolbars and docks must be strictly icon-only with monochromatic SVGs.
4. **Mandatory Semantic Theme Tokens**:
   - Never hardcode HEX or RGB values (`#D4AF37`, `rgba(0,0,0,0.5)`).
   - Use CSS custom properties: `var(--skipo-bg)`, `var(--skipo-text)`, `var(--skipo-accent)`, `var(--skipo-border)`, etc.
5. **One Component Per File & 200-Line Limit**:
   - Exactly one exported component per `.tsx` file.
   - Max 200 lines per file (enforced statically).

---

## 3. Backend Service Authoring: Foundation Inheritance

All backend services, providers, and controllers MUST inherit from `SkipoBase` or domain-specific base classes.

```typescript
import { SkipoBase, type SkipoConfig } from '@skipo/core';

export class TaskManagerService extends SkipoBase {
  protected async onInitialize(): Promise<void> {
    this.logger.log('Initializing TaskManager');
  }

  protected async onDispose(): Promise<void> {
    this.logger.log('Disposing TaskManager');
  }
}
```

---

## 4. Verification Checklist

Before considering an app generation turn complete, run:
```bash
# 1. Typecheck
pnpm typecheck

# 2. Architectural constraints verification
npx skipo-validate

# 3. Unit and integration test suite
pnpm test
```
All gates must pass with 0 errors.
