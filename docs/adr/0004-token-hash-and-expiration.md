# ADR 0004: Token hashing and expiration for provider portal access

## Context
The provider portal is public and must allow access only to specific Work Orders. Tokens must be revocable and should not be stored in plaintext for security reasons.

## Decision
- Generate a random token for each portal link.
- Store only a SHA-256 hash (with a server secret) in the database.
- Enforce expiration timestamps and active flags.
- Revoke tokens when Work Orders are closed or canceled.

## Alternatives Considered

### 1) Store plaintext tokens
Rejected due to security risk and audit exposure.

### 2) Use signed JWTs without server-side storage
Rejected because revocation would be difficult without persistent state.

## Consequences

### Positive
- Token leakage does not expose plaintext in DB
- Easy revocation and TTL enforcement

### Negative
- Requires server-side lookup and hashing for each request
- Slightly more complex token management
