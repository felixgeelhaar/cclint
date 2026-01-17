# {{projectName}}

{{projectDescription}}

## Project Overview

This is a Go project using Go modules for dependency management.

## Development Commands

```bash
# Download dependencies
go mod download

# Run the application
go run .

# Run tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Build binary
go build -o {{projectName}}

# Run linter
golangci-lint run

# Format code
go fmt ./...
```

## Architecture

### Directory Structure

```
.
├── cmd/              # Application entry points
│   └── {{projectName}}/
│       └── main.go
├── internal/         # Private application code
│   ├── handlers/     # HTTP handlers
│   ├── services/     # Business logic
│   └── models/       # Data structures
├── pkg/              # Public library code
├── go.mod            # Module definition
└── go.sum            # Dependency checksums
```

### Key Technologies

- **Language**: Go
- **Module Path**: {{modulePath}}
- **Test Framework**: go test (built-in)

## Code Style

- Follow Effective Go guidelines
- Use `gofmt` for formatting
- Keep functions focused and small
- Handle all errors explicitly
- Use meaningful variable names

## Testing

Run tests with:

```bash
go test ./...
```

Test files should be in the same package with `_test.go` suffix.

### Table-Driven Tests

Use table-driven tests for comprehensive coverage:

```go
func TestAdd(t *testing.T) {
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"positive", 1, 2, 3},
        {"negative", -1, -2, -3},
        {"zero", 0, 0, 0},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if got := Add(tt.a, tt.b); got != tt.expected {
                t.Errorf("Add(%d, %d) = %d, want %d", tt.a, tt.b, got, tt.expected)
            }
        })
    }
}
```

## Error Handling

- Always check returned errors
- Use `errors.Is` and `errors.As` for error checking
- Wrap errors with context using `fmt.Errorf("context: %w", err)`
