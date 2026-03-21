---
name: database-design-migration
description: Database schema design, normalization, indexing strategies, migration management, query optimization, and data modeling patterns.
---

# Database Design & Migration

Use when designing databases, creating migrations, optimizing schemas, or when the user mentions database design, schema, migration, or database optimization.

## Key Principles

- Follow normalization up to 3NF unless performance requires denormalization
- Always create indexes for foreign keys
- Use appropriate data types for the database engine
- Write reversible migrations

## Common Patterns

- Repository pattern for data access
- Unit of Work for transaction management
- CQRS for read/write separation in high-traffic scenarios
