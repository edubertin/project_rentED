# ADR 0006: Reuse existing Documents storage for proof uploads

## Context
The platform already stores documents on local filesystem and tracks them in the documents table. Work Order proofs require file uploads but introducing a separate storage system adds complexity.

## Decision
Use the existing documents pipeline for Work Order proof photos:
- store files under ./data/uploads
- create a documents row
- link the proof to document_id

## Alternatives Considered

### 1) New storage service (S3/MinIO)
Rejected due to unnecessary infrastructure for current scope.

### 2) Store proofs directly in the Work Order table
Rejected due to mixing binary data with core domain entities.

## Consequences

### Positive
- Minimal new infrastructure
- Consistent download mechanism

### Negative
- Local storage is not ideal for production scale
- Requires future migration if storage backend changes
