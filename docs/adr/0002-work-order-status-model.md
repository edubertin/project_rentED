# ADR 0002: Work Order status model and transitions

## Context
Work Orders can follow two different contracting modes: quote-based and fixed-offer. Each mode has distinct lifecycle steps (submission, approval, execution, rework) that must be consistently enforced across API, UI, and audit logs.

Without a defined status model, the system risks inconsistent behavior, unclear UI states, and data integrity issues.

## Decision
Define explicit statuses and transitions for each Work Order type:

**Quote flow**
- quote_requested -> quote_submitted -> approved_for_execution -> proof_submitted -> closed
- rework_requested can occur after proof_submitted
- canceled can occur before closed

**Fixed-offer flow**
- offer_open -> assigned -> proof_submitted -> closed
- rework_requested can occur after proof_submitted
- canceled can occur before closed

Transitions are enforced by backend validation and reflected in dashboard UI and portal allowed actions.

## Alternatives Considered

### 1) Single generic status model
Rejected due to ambiguity between quote and fixed flows and higher risk of invalid transitions.

### 2) Fully implicit statuses derived from related records
Rejected because it becomes fragile and harder to reason about in UI and audits.

## Consequences

### Positive
- Clear and predictable lifecycle for each Work Order type
- Easier UI/UX state mapping
- Enforceable audit trail and validations

### Negative
- Requires explicit transition logic in the backend
- Slightly higher schema complexity
