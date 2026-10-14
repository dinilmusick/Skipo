# SKIPO — IMPLEMENTATION SPECIFICATION

STATUS := CANONICAL
AUTHORITY := SKIPO repository
ROLE := application construction / composition layer

## 1. CORE MODEL

KRNLTS := backend framework.
KLOKS := reusable backend service library.
REACT := frontend framework.
FLOKS := reusable React UI library.
SKIPO := application builder/composition system consuming these layers.

CRUCIBLE := an application built on SKIPO.
CRUCIBLE is NOT a replacement for SKIPO.

## 2. OWNERSHIP

SKIPO OWNS:
- application construction
- application composition
- application-level backend/frontend wiring
- application contracts
- generators/scaffolds/mutators/validators used to construct SKIPO applications
- application graph/composition semantics
- SKIPO development/build/test governance

SKIPO DOES NOT OWN:
- KRNLTS framework internals
- KLOKS service implementations
- React internals
- FLOKS reusable component implementations
- KRUSBL promotion engine
- CRUCIBLE ecosystem control-plane behavior

## 3. DEPENDENCY DIRECTION

KRNLTS → KLOKS
React → FLOKS

KRNLTS + KLOKS + React + FLOKS
                  ↓
                SKIPO
                  ↓
               CRUCIBLE

SKIPO MAY consume all four foundational layers.
Foundational layers MUST NOT depend on SKIPO.

## 4. APPLICATION MODEL

APPLICATION :=
{
  frontend,
  backend,
  contracts,
  configuration,
  composition,
  runtime wiring
}

BACKEND:
  KRNLTS + KLOKS

FRONTEND:
  React + FLOKS

SKIPO connects the two.

## 5. SERVICE / COMPONENT MODEL

Backend:
  service → KLOKS → application

Frontend:
  component → FLOKS → application

Application-specific behavior belongs in SKIPO application code, not KLOKS/FLOKS.

## 6. GOVERNANCE

Existing SKIPO generators, mutators, validators, scripts, scaffolds, and contract-boundary mechanisms remain authoritative for SKIPO implementation.

No new governance subsystem is introduced solely for CRUCIBLE.

## 7. CRUCIBLE BOUNDARY

CRUCIBLE:
  uses SKIPO
  uses KRNLTS/KLOKS/FLOKS through SKIPO-compatible application contracts
  orchestrates ecosystem update/check workflows

SKIPO:
  provides the application foundation
  does not become the ecosystem orchestrator

## 8. TEST MODEL

REPO_TEST:
  build
  typecheck
  unit tests
  generator tests
  mutator tests
  validator tests
  application composition tests

CONTRACT_TEST:
  KLOKS consumption
  FLOKS consumption
  KRNLTS compatibility
  React compatibility
  generated application validity

## 9. ACCEPTANCE

PASS ⇔
  existing validation suite passes
  ∧ composition tests pass
  ∧ dependency boundaries hold
  ∧ generators/mutators remain deterministic
  ∧ no lower-layer ownership leakage
  ∧ CRUCIBLE remains an application consumer

## 10. AGENT RULE

AGENT_SKIPO:
  inspect current generators/mutators/validators first
  preserve valid existing governance
  implement missing application-layer requirements
  update tests
  do not absorb CRUCIBLE orchestration
  do not reimplement KRNLTS/KLOKS/FLOKS internals
