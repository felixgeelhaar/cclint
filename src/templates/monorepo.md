# {{projectName}}

{{projectDescription}}

## Project Overview

This is a monorepo containing multiple packages/applications managed with {{packageManager}}.

## Development Commands

```bash
# Install all dependencies
{{installCommand}}

# Run all tests
{{testCommand}}

# Build all packages
{{buildCommand}}

# Run a specific package
{{runPackageCommand}}
```

## Architecture

### Monorepo Structure

```
.
├── packages/
│   ├── core/           # Core shared library
│   │   ├── package.json
│   │   └── src/
│   ├── api/            # API server
│   │   ├── package.json
│   │   └── src/
│   └── web/            # Web application
│       ├── package.json
│       └── src/
├── apps/               # Standalone applications
├── tools/              # Build and development tools
├── package.json        # Root package.json
└── {{workspaceConfig}} # Workspace configuration
```

### Package Dependencies

- `@{{projectName}}/core` - Shared utilities and types
- `@{{projectName}}/api` - Backend API (depends on core)
- `@{{projectName}}/web` - Frontend app (depends on core)

## Working with Packages

### Adding a new package

```bash
# Create package directory
mkdir -p packages/new-package
cd packages/new-package
npm init
```

### Running commands in a specific package

```bash
# Using npm workspaces
npm run test -w packages/core

# Using pnpm
pnpm --filter @{{projectName}}/core test

# Using yarn
yarn workspace @{{projectName}}/core test
```

### Cross-package dependencies

When one package depends on another:

```json
{
  "dependencies": {
    "@{{projectName}}/core": "workspace:*"
  }
}
```

## CI/CD

Each package can be built and tested independently. The CI pipeline should:

1. Detect changed packages
2. Build affected packages and their dependents
3. Run tests for affected packages
4. Deploy if on main branch

## Code Sharing

- Place shared types in `packages/core/src/types/`
- Place shared utilities in `packages/core/src/utils/`
- Export through package's main entry point
