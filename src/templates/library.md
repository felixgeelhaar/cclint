# {{projectName}}

{{projectDescription}}

## Project Overview

This is a reusable library/package published to {{registry}}.

## Installation

```bash
{{packageInstallCommand}}
```

## Development Commands

```bash
# Install dependencies
{{installCommand}}

# Run tests
{{testCommand}}

# Build library
{{buildCommand}}

# Run linter
{{lintCommand}}

# Generate documentation
{{docsCommand}}
```

## Architecture

### Directory Structure

```
src/
├── index.ts          # Main export file
├── types.ts          # Public type definitions
├── utils/            # Internal utilities
└── ...

tests/
├── index.test.ts
└── ...
```

### Exports

The library exports the following:

```typescript
// Main exports
export { mainFunction } from './main';
export { HelperClass } from './helper';

// Types
export type { Config, Options } from './types';
```

## API Reference

### `mainFunction(options: Options): Result`

Description of the main function.

**Parameters:**

- `options.param1` - Description of param1
- `options.param2` - Description of param2

**Returns:** Description of return value

**Example:**

```{{language}}
import { mainFunction } from '{{projectName}}';

const result = mainFunction({
  param1: 'value',
  param2: 42,
});
```

## Publishing

### Version Bumping

```bash
# Patch release (bug fixes)
npm version patch

# Minor release (new features)
npm version minor

# Major release (breaking changes)
npm version major
```

### Publishing to Registry

```bash
{{publishCommand}}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

{{license}}
