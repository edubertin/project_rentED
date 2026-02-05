# ADR 0007: Domain event log stored in PostgreSQL

## Context
The rentED system includes multiple business workflows such as property management, contract imports, and Work Orders, where important state transitions and user actions must be auditable and traceable.

Traditional technical logging is not sufficient to understand business behavior, debug workflow issues, or generate operational metrics.

The system requires a simple and reliable way to capture key business events without introducing external infrastructure or additional complexity.

## Decision
A centralized domain event log will be implemented using a PostgreSQL table (e.g. `domain_events`).

Each business-critical action or state transition will insert a new event record containing:
- event_type (e.g. `work_order_created`, `quote_submitted`)
- entity_type (e.g. `work_order`, `property`)
- entity_id (reference to the affected entity)
- actor_type (`admin`, `portal`, `system`)
- actor_id (optional reference when applicable)
- payload (JSONB with relevant contextual data)
- created_at timestamp

Events will be queried directly from PostgreSQL for timelines, audits, and basic metrics.

No external event streaming systems will be introduced at this stage.

## Alternatives Considered

### 1) Technical application logs only
Rejected due to:
- lack of structured business meaning
- difficulty querying and aggregating
- poor auditability

### 2) Separate event system (Kafka, message brokers)
Rejected due to:
- unnecessary operational complexity
- infrastructure overhead
- not justified for current scale

### 3) No event tracking
Rejected due to:
- loss of workflow history
- harder debugging
- inability to generate business insights

## Consequences

### Positive
- Clear audit trail of business activity
- Simple implementation using existing database
- Easy querying and reporting
- Foundation for future automation and analytics

### Negative
- Additional write operations on business actions
- Requires discipline to log relevant events consistently
- Event volume grows over time (manageable with retention policies if needed)
