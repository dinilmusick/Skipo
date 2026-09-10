---
name: krnlts-runtime-core
description: Directives for Entity<TState, TEvents> runtime execution, capability bubbling, flow construction, and state mutations.
---

# KRNLTS RUNTIME & CORE ENTITY ENGINE

## 1. RUNTIME LAWS & BUBBLING

$$\forall c \in \text{Capabilities}(\text{Child}): c \xrightarrow{\text{bubble}} \text{Parent}.\text{resolveCapability}(\text{QualifiedID})$$

$$\text{Imports}(\text{Entity}) \cap \text{src/libraries/*} = \emptyset \quad (\text{thenFunction with raw library is FORBIDDEN})$$

## 2. ENTITY & FLOW BUILDER PATTERNS

```typescript
/** @role skeleton */
export class OrderEntity extends Entity<OrderState, OrderEvents> {
  constructor() {
    super("OrderEntity", null, { initialState: { status: "idle", total: 0 } });
  }

  setupFlows() {
    this.flow("checkout")
      .thenFunctionality("ValidateCart")                       // Quad-unit
      .thenEntityOrchestration("BillingEntity", "ChargeCard")  // Peer orchestration
      .branch((res) => res.approved, "ShipOrder", "CancelOrder")
      .register({ visibility: "public" });
  }
}
```
