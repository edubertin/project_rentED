# ADR 0003: Execution proof requires Pix information and at least one photo

## Context
Execution proof is the system's confirmation point for completed work. The business requires proof of execution and payment routing data, but payment itself stays outside the platform.

## Decision
Require the following on proof submission:
- at least one photo (stored using the existing Documents pipeline)
- Pix receiver name
- Pix key type and value

Admin approval is required before closing the Work Order.

## Alternatives Considered

### 1) Allow proof without photo
Rejected due to weak evidence of execution.

### 2) Collect payment inside the system
Rejected because payment integration adds complexity and is out of scope for current phase.

## Consequences

### Positive
- Clear accountability and verification
- Payment remains external but Pix info is captured for operational workflow

### Negative
- Additional input burden for providers
- Requires validation and storage for Pix fields
