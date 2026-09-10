---
name: krnl-agentic-api-endpoints
description: AI Agent guide for programmatic inspection, scaffolding, mutation, and testing via Krnl Studio REST/WS endpoints.
---

# KRNL STUDIO AGENTIC API SUITE (`agentic-api`)

## 1. PREEMPTIVE DOCUMENTATION PROTOCOL

$$\forall \text{res} \in \text{APIResponses}: \text{res}.\text{preemptiveDocumentation} = \{\text{action}, \text{suggestedNextSteps}: [\{\text{endpoint}, \text{rpcMethod}, \text{payload}, \text{curl}\}]\}$$

$$\text{ExternalAgentInvoke}(\tau) \implies \text{BroadcastWS}(\text{"agent.activity"}) \wedge \text{RuneGlowHighlight}(\tau.\text{targetNode})$$

## 2. ENDPOINT DIRECTORY MATRIX (`http://localhost:8080`)

| Subsystem | HTTP Endpoint | WS RPC Method | Payload Schema |
| :--- | :--- | :--- | :--- |
| **Project** | `POST /api/v1/project/create` | `project.create` | `{"name": string, "targetDir": string}` |
| **Project** | `GET /api/v1/project/graph` | `graph.getArchitecture` | `{}` |
| **Entity** | `POST /api/v1/entity/create` | `entity.create` | `{"name": string}` |
| **Functionality** | `POST /api/v1/functionality/create` | `functionality.create` | `{"entityName": string, "name": string}` |
| **Library** | `POST /api/v1/library/create` | `library.create` | `{"name": string}` |
| **File Edit** | `POST /api/v1/file/edit` | `file.edit` | `{"filePath": string, "newContent": string}` |
| **UI Synth** | `POST /api/v1/ui/generate` | `ui.generate` | `{"componentTree": object, "target": string}` |
| **Audit** | `POST /api/v1/validate/audit` | `validate.audit` | `{}` |
| **Sandbox Test** | `POST /api/v1/test/execute` | `test.executeFunction` | `{"filePath": string, "input": object}` |
| **Doc Catalog** | `GET /api/v1/docs/endpoints` | `docs.endpoints` | `{}` |
