---
name: database-multi-engine-guidelines
description: Directives for multi-engine database support, Settings modal, live connection testing, and IDatabaseAdapter interface.
---

# MULTI-ENGINE DATABASE ARCHITECTURE GUIDELINES

## 1. FORMAL ADAPTER INTERFACE

$$\text{DBProviders} = \{\text{sqlite}, \text{postgres}, \text{firebase}, \text{mongodb}, \text{custom}\}$$

$$\forall m \in \text{Features}: m \xrightarrow{\text{calls}} \text{IDatabaseAdapter} \quad (\text{Zero Vendor Lock-in})$$

```typescript
export interface IDatabaseAdapter {
  connect(cfg: DatabaseConfiguration): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<{ ok: boolean; latencyMs: number }>;
  query<T>(queryObj: QueryDefinition): Promise<T>;
  execute(commandObj: CommandDefinition): Promise<ExecutionResult>;
}
```

## 2. CONNECTION TESTING PROTOCOL

- **Endpoint**: `POST /api/database/test` $\to$ `{ success: boolean, latencyMs: number, engine: DBProvider }`
- **Settings Tab**: `SettingsModal.tsx` $\to$ live status badges (Active/Connecting/Error) + monochromatic cards.
