---
name: backend-environment-hosting
description: Deployment and hosting directives for Vercel Serverless/Edge, Local Desktop, and LAN/Docker.
---

# MULTI-ENVIRONMENT HOSTING DIRECTIVES

## 1. HOSTING MATRIX & INVARIANTS

| Target Platform | DB Strategy | Storage Strategy | Invariant Rules |
| :--- | :--- | :--- | :--- |
| **Vercel Serverless** | Postgres / Supabase Pooler | AWS S3 / Supabase / R2 | Stateless, SSL, dynamic dev imports, sanitize DB URL |
| **Local Desktop** | SQLite (WAL mode) | Local Filesystem | Zero-divergence Control Plane, normalized paths |
| **Docker / LAN** | PocketBase / Postgres | Local FS / MinIO | Bind `0.0.0.0`, dynamic CORS, `/api/health` probe |

## 2. SERVERLESS EXECUTION CONSTRAINTS

$$\begin{array}{ll}
\mathbf{E_1} \text{ (No Ephemeral Persistence)} & \text{Persistence} \cap \{/\text{tmp}\} = \emptyset \implies \text{Use Cloud Blob / DB} \\
\mathbf{E_2} \text{ (Dynamic Dev Tooling)} & \forall t \in \{\text{vite}, \text{esbuild}\}: t \xrightarrow{\text{import}} \text{dynamic inside } (\neg\text{VERCEL} \wedge \neg\text{PROD}) \\
\mathbf{E_3} \text{ (Sanitized DB URLs)} & \text{Conn}(url) \implies \neg\text{Matches}(url, \text{"example.com"|"sample.neon"}) \\
\mathbf{E_4} \text{ (Safe JSON Ingress)} & \text{ParseJSON}(res) \implies \text{ContentType}(res) = \text{"application/json"}
\end{array}$$

## 3. DESKTOP LOCAL SQLITE CONTRACT

```typescript
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");
```
