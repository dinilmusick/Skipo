---
name: krnlts-network-ingress
description: Directives for KrnlTS unified port gateway, dynamic discovery fallback chain, HTTP/WS transport, and MCP surface.
---

# KRNLTS INGRESS NETWORK & UNIFIED GATEWAY

## 1. UNIFIED PORT GATEWAY

$$\text{Surface} = \{\text{REST } (/\text{call}/\{fid\}), \text{WS RPC}, \text{MCP Tools}, \text{Admin UI}\} \longrightarrow \text{Single Port } P$$

## 2. DYNAMIC PORT RESOLUTION CASCADE

$$\text{Port}_{\text{listen}} = \begin{cases}
\text{preferredPort}, & \text{configured} \\
\text{process.env.PORT}, & \text{defined} \\
\text{Registry}(\text{app.ports.json}), & \text{resolved} \\
\text{SystemRegistry}(10099), & \text{connected} \\
\text{KernelDynamic}(0), & \text{fallback (Zero-Failure)}
\end{cases}$$

## 3. MODEL CONTEXT PROTOCOL (MCP)

$$\forall f \in \text{PublicFunctionalities}: f \xrightarrow{\text{project}} \text{MCPTool}(/\text{mcp} \vee \text{stdio})$$
