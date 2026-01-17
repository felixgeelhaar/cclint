# {{projectName}}

{{projectDescription}}

## Project Overview

This is a Python project using {{packageManager}} for dependency management.

## Development Commands

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
{{installCommand}}

# Run tests
{{testCommand}}

# Run linting
{{lintCommand}}

# Format code
{{formatCommand}}
```

## Architecture

### Directory Structure

```
{{projectName}}/
├── __init__.py       # Package initialization
├── main.py           # Main entry point
├── models/           # Data models
├── services/         # Business logic
└── utils/            # Utility functions

tests/
├── __init__.py
├── test_main.py
└── ...
```

### Key Technologies

- **Language**: Python 3.x
- **Package Manager**: {{packageManager}}
- **Test Framework**: {{testFramework}}

## Code Style

- Follow PEP 8 guidelines
- Use type hints for function signatures
- Use docstrings for public functions and classes
- Maximum line length: 88 characters (black default)

## Testing

Run tests with:

```bash
{{testCommand}}
```

Test files should be placed in `tests/` directory with `test_` prefix.

## Environment Variables

Create a `.env` file for local development:

```bash
# .env
DEBUG=true
DATABASE_URL=postgresql://localhost/{{projectName}}
```
