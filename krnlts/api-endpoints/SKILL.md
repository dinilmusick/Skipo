---
name: krnl-agentic-api-endpoints
description: Comprehensive guide for AI Agents to programmatically build, scaffold, mutate, validate, and test Krnl codebases via Krnl Studio REST and WebSocket JSON-RPC endpoints with Preemptive Documentation.
---

# KRNL STUDIO AGENTIC API SUITE (`agentic-api`)

This skill defines the complete programmatic API surface exposed by **Krnl Studio** (`http://localhost:8080`), allowing autonomous AI Agents to inspect, build, test, and evolve Krnl applications programmatically.

---

## 1. PREEMPTIVE DOCUMENTATION PROTOCOL
Every API response returned to an AI Agent includes a **`preemptiveDocumentation`** envelope:
```json
{
  "status": "success",
  "payload": { ... },
  "preemptiveDocumentation": {
    "action": "entity.create",
    "description": "Surgically creates a new root or component Entity on disk...",
    "suggestedNextSteps": [
      {
        "id": "functionality.create",
        "title": "Scaffold Quad-Unit Functionality",
        "endpoint": "POST /api/v1/functionality/create",
        "rpcMethod": "graph.createFunctionality",
        "description": "Generates a 4-layer quad-unit nested in the target Entity.",
        "examplePayload": { "entityName": "OrderSystem", "name": "CreateOrder" },
        "curl": "curl -X POST http://localhost:8080/api/v1/functionality/create -H 'Content-Type: application/json' -d '{\"entityName\":\"OrderSystem\",\"name\":\"CreateOrder\"}'"
      }
    ],
    "documentationIndexEndpoint": "GET http://localhost:8080/api/v1/docs/endpoints"
  }
}
```
> **Zero Guesswork**: Agents can immediately copy-paste the next step's exact endpoint, method, and example payload from `suggestedNextSteps`.

---

## 2. OBSERVABLE STATE & REAL-TIME UI SYNCHRONIZATION
```
∀ api_call ∈ External_Agent_Invocations:
  Server broadcasts "agent.activity" over WebSocket to all active browser sessions.
  Visual Node Canvas highlights affected entity with a gold rune glow.
  Live Toast HUD displays: "🤖 AI Agent executed [action] ([timestamp])".
```
- **Rule**: Phantom / silent execution is strictly prohibited. Every mutation or sandboxed test run by an AI agent reflects in real-time in the user's browser UI.

---

## 3. FULL AGENTIC ENDPOINTS DIRECTORY

### 3.1 Workspace Management
| Route | Method | RPC Method | Description | Example Payload |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/project/create` | `POST` | `project.create` | Scaffold new full-stack workspace | `{"name":"PayApp","targetDir":"./PayApp"}` |
| `/api/v1/project/load` | `POST` | `project.load` | Switch active workspace context | `{"path":"examples/unified-workspace"}` |
| `/api/v1/project/graph` | `GET` | `graph.getArchitecture` | Inspect AST & return 30-node architecture graph | `{}` |
| `/api/v1/project/status` | `GET` | `project.getStatus` | Return entity counts, health, & purity status | `{}` |

### 3.2 Architectural Scaffolding
| Route | Method | RPC Method | Description | Example Payload |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/entity/create` | `POST` | `entity.create` | Scaffold Entity on disk with magnetic loader hooks | `{"name":"OrderSystem"}` |
| `/api/v1/functionality/create` | `POST` | `functionality.create` | Scaffold 4-layer Quad-Unit | `{"entityName":"OrderSystem","name":"CreateOrder"}` |
| `/api/v1/library/create` | `POST` | `library.create` | Scaffold Layer 0 pure Concept Library | `{"name":"CryptoConcepts"}` |
| `/api/v1/flow/addStep` | `POST` | `flow.addStep` | Surgically inject `.then()` into Entity flow pipeline | `{"entityFilePath":"...","flowName":"PayFlow","stepFunctionName":"Charge"}` |

### 3.3 Code Mutation & UI Synthesis
| Route | Method | RPC Method | Description | Example Payload |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/file/read` | `POST` | `file.read` | Read exact source code of any workspace file | `{"filePath":"src/.../logic.ts"}` |
| `/api/v1/file/edit` | `POST` | `file.edit` | Surgically edit function logic or helper blocks | `{"filePath":"src/.../logic.ts","newContent":"..."}` |
| `/api/v1/ui/generate` | `POST` | `ui.generate` | Synthesize reactive VanJS `.ts` from component tree | `{"componentTree":{...},"targetFilePath":"..."}` |

### 3.4 Validation & Quality Gates
| Route | Method | RPC Method | Description | Example Payload |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/validate/audit` | `POST` | `validate.audit` | Deep AST 4-layer function purity & line limit audit | `{}` |

### 3.5 Sandboxed Execution & Testing
| Route | Method | RPC Method | Description | Example Payload |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/test/execute` | `POST` | `test.executeFunction` | Run targeted function in Worker sandbox with metrics | `{"filePath":".../logic.ts","input":{"a":10,"b":20}}` |

### 3.6 Documentation Introspection
| Route | Method | RPC Method | Description | Example Payload |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/docs/endpoints` | `GET` | `docs.endpoints` | Return full documentation catalog with curl examples | `{}` |
