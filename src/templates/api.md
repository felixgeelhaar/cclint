# {{projectName}}

{{projectDescription}}

## Project Overview

This is a {{apiType}} API service.

## Development Commands

```bash
# Install dependencies
{{installCommand}}

# Start development server
{{devCommand}}

# Run tests
{{testCommand}}

# Build for production
{{buildCommand}}

# Start production server
{{startCommand}}
```

## Architecture

### Directory Structure

```
src/
├── routes/           # API route handlers
│   ├── users.ts
│   ├── products.ts
│   └── index.ts
├── middleware/       # Express/Koa middleware
│   ├── auth.ts
│   ├── validation.ts
│   └── error-handler.ts
├── services/         # Business logic
├── models/           # Data models / ORM entities
├── utils/            # Utility functions
└── index.ts          # Application entry point
```

### Key Technologies

- **Framework**: {{framework}}
- **Database**: {{database}}
- **Authentication**: {{authMethod}}

## API Endpoints

### Authentication

```
POST /api/auth/login     # User login
POST /api/auth/register  # User registration
POST /api/auth/refresh   # Refresh token
```

### Resources

```
GET    /api/{{resource}}       # List all
GET    /api/{{resource}}/:id   # Get by ID
POST   /api/{{resource}}       # Create new
PUT    /api/{{resource}}/:id   # Update by ID
DELETE /api/{{resource}}/:id   # Delete by ID
```

## Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/{{projectName}}

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# External Services
REDIS_URL=redis://localhost:6379
```

## Error Handling

All API errors follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [{ "field": "email", "message": "Invalid email format" }]
  }
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Testing

```bash
# Run all tests
{{testCommand}}

# Run with coverage
{{testCoverageCommand}}

# Run specific test file
{{testFileCommand}}
```

### Test Structure

```
tests/
├── unit/             # Unit tests
├── integration/      # Integration tests
├── e2e/              # End-to-end tests
└── fixtures/         # Test data
```

## Database

### Migrations

```bash
# Create migration
{{migrationCreateCommand}}

# Run migrations
{{migrationRunCommand}}

# Rollback
{{migrationRollbackCommand}}
```

### Seeding

```bash
{{seedCommand}}
```

## Deployment

### Docker

```bash
# Build image
docker build -t {{projectName}} .

# Run container
docker run -p 3000:3000 {{projectName}}
```

### Health Check

```
GET /health
```

Returns `200 OK` with:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-17T12:00:00Z",
  "version": "1.0.0"
}
```
