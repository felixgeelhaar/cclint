# Pull Request: Add GitHub Actions Workflows

## Summary
Adds comprehensive CI/CD automation with GitHub Actions workflows for testing, security auditing, and automated npm publishing.

## Files Added
- `.github/workflows/ci.yml` - Continuous Integration workflow
- `.github/workflows/release.yml` - Release automation workflow

## CI Workflow Features
- **Multi-version testing**: Node.js 18.x, 20.x, 22.x
- **Comprehensive checks**: TypeScript, ESLint, Vitest tests
- **Coverage reporting**: Codecov integration
- **Self-linting**: Tests cclint on its own CLAUDE.md
- **Security auditing**: npm audit with vulnerability checks

## Release Workflow Features
- **Triggered by**: Git tags matching `v*` pattern
- **Automated publishing**: npm registry with public access
- **Version management**: Extracts version from git tag
- **GitHub releases**: Automatic release creation with changelog
- **Quality gates**: All tests must pass before publishing

## Setup Required
1. Add `NPM_TOKEN` secret in repository settings
2. Optional: Add `CODECOV_TOKEN` for coverage reporting

## Usage
```bash
# Trigger CI on any push/PR to main or develop
git push origin main

# Trigger release on version tag
git tag v0.1.0
git push origin v0.1.0
```

## Test Plan
- [x] Workflows syntax validated
- [x] All scripts referenced in workflows exist in package.json
- [x] CLI commands tested and working
- [ ] Requires manual verification after merge

## Breaking Changes
None - only adds new automation capabilities.