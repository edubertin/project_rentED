# ADR 0005: Temporary provider identity (no persistent accounts)

## Context
Providers are recurring but must be handled with minimal friction. Creating full user accounts is out of scope and increases operational overhead.

## Decision
Store provider identity (name and phone) on the Work Order quote/interest/proof records only. No persistent provider accounts are created.

## Alternatives Considered

### 1) Full provider accounts
Rejected due to onboarding friction and early-stage complexity.

### 2) Anonymous submissions without identity
Rejected due to lack of accountability and operational tracking.

## Consequences

### Positive
- Fast provider onboarding
- Keeps system complexity low

### Negative
- No centralized provider profile or history beyond each Work Order
