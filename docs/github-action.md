# GitHub Action

cclint provides a GitHub Action for easy integration into your CI/CD pipelines. This allows you to automatically lint CLAUDE.md files on every push and pull request.

## Quick Start

Add this workflow to `.github/workflows/lint-claude.yml`:

```yaml
name: Lint CLAUDE.md

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  lint-claude:
    runs-on: ubuntu-latest
    name: Lint CLAUDE.md files
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Lint CLAUDE.md files
      uses: felixgeelhaar/cclint@v0.1.2
      with:
        files: 'CLAUDE.md'
        format: 'text'
        fail-on-error: 'true'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `files` | Files to lint (glob pattern or space-separated list) | No | `CLAUDE.md` |
| `format` | Output format (`text`, `json`, or `sarif`) | No | `text` |
| `max-size` | Maximum file size in characters | No | `10000` |
| `fail-on-error` | Fail the action if errors are found | No | `true` |
| `config-file` | Path to configuration file | No | Auto-detected |

## Outputs

| Output | Description |
|--------|-------------|
| `results` | Linting results in JSON format |
| `error-count` | Number of errors found |
| `warning-count` | Number of warnings found |

## Examples

### Basic Usage

```yaml
- name: Lint CLAUDE.md
  uses: felixgeelhaar/cclint@v0.1.2
  with:
    files: 'CLAUDE.md'
```

### Multiple Files

```yaml
- name: Lint multiple CLAUDE.md files
  uses: felixgeelhaar/cclint@v0.1.2
  with:
    files: 'CLAUDE.md docs/CLAUDE.md src/CLAUDE.md'
    format: 'json'
```

### Glob Patterns

```yaml
- name: Lint all CLAUDE.md files
  uses: felixgeelhaar/cclint@v0.1.2
  with:
    files: '**/CLAUDE.md'
    max-size: '15000'
```

### Custom Configuration

```yaml
- name: Lint with custom config
  uses: felixgeelhaar/cclint@v0.1.2
  with:
    files: 'CLAUDE.md'
    config-file: '.github/cclint-config.json'
```

### Don't Fail on Errors

```yaml
- name: Lint but continue on errors
  uses: felixgeelhaar/cclint@v0.1.2
  with:
    files: 'CLAUDE.md'
    fail-on-error: 'false'
  continue-on-error: true
```

### Using Outputs

```yaml
- name: Lint CLAUDE.md
  id: lint
  uses: felixgeelhaar/cclint@v0.1.2
  with:
    files: 'CLAUDE.md'
    format: 'json'
    
- name: Comment PR with results
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const results = JSON.parse('${{ steps.lint.outputs.results }}');
      const errorCount = '${{ steps.lint.outputs.error-count }}';
      const warningCount = '${{ steps.lint.outputs.warning-count }}';
      
      let comment = `## 📝 CLAUDE.md Lint Results\n\n`;
      comment += `- **Errors:** ${errorCount}\n`;
      comment += `- **Warnings:** ${warningCount}\n\n`;
      
      if (results.length > 0) {
        comment += `<details>\n<summary>Detailed Results</summary>\n\n`;
        comment += '```json\n' + JSON.stringify(results, null, 2) + '\n```\n';
        comment += `</details>`;
      }
      
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: comment
      });
```

### Matrix Strategy

```yaml
name: Lint CLAUDE.md files

on: [push, pull_request]

jobs:
  lint-claude:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        file: 
          - 'CLAUDE.md'
          - 'docs/CLAUDE.md'
          - 'api/CLAUDE.md'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Lint ${{ matrix.file }}
      uses: felixgeelhaar/cclint@v0.1.2
      with:
        files: ${{ matrix.file }}
        format: 'text'
```

### Integration with Other Actions

```yaml
name: Comprehensive Check

on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    # Install dependencies
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    # Run tests
    - name: Run tests
      run: npm test
    
    # Lint code
    - name: Lint TypeScript
      run: npm run lint
    
    # Lint CLAUDE.md
    - name: Lint CLAUDE.md
      uses: felixgeelhaar/cclint@v0.1.2
      with:
        files: 'CLAUDE.md'
        format: 'text'
        fail-on-error: 'true'
    
    # Build project
    - name: Build
      run: npm run build
```

## Alternative: Manual Installation

If you prefer to install cclint manually in your workflow:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    
- name: Install cclint
  run: npm install -g cclint
  
- name: Lint CLAUDE.md
  run: cclint lint CLAUDE.md --format json > lint-results.json
  
- name: Upload results
  uses: actions/upload-artifact@v4
  with:
    name: lint-results
    path: lint-results.json
```

## GitHub Code Scanning (SARIF)

Use `--format sarif` to publish violations as inline PR annotations and entries
in the repository's **Security → Code scanning** dashboard. Emit a SARIF 2.1.0
document and upload it with `github/codeql-action/upload-sarif`:

```yaml
jobs:
  cclint:
    runs-on: ubuntu-latest
    permissions:
      security-events: write # required to upload SARIF
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Lint CLAUDE.md (SARIF)
        run: npx @felixgeelhaar/cclint lint CLAUDE.md --format sarif > cclint.sarif
        continue-on-error: true # keep going so the SARIF still uploads on findings

      - name: Upload SARIF to Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: cclint.sarif
```

The SARIF `ruleId`, `level` (`error`/`warning`/`note`), and source
line/column are mapped from each violation, so findings land on the exact line
in the PR diff.

## Troubleshooting

### Action Not Found

Make sure you're using the correct version tag:
```yaml
uses: felixgeelhaar/cclint@v0.1.2  # ✅ Correct
uses: felixgeelhaar/cclint@main    # ❌ Incorrect
```

### No Files Found

Check your glob patterns and make sure files exist:
```yaml
- name: List files before linting
  run: find . -name "CLAUDE.md" -type f

- name: Lint CLAUDE.md
  uses: felixgeelhaar/cclint@v0.1.2
  with:
    files: 'CLAUDE.md'
```

### Permission Issues

Make sure the action has proper permissions:
```yaml
permissions:
  contents: read
  pull-requests: write  # If commenting on PRs
```

## Best Practices

1. **Pin to specific version**: Use `@v0.1.2` instead of `@main`
2. **Use meaningful job names**: Help identify failures quickly
3. **Cache when possible**: Cache Node.js dependencies for faster runs
4. **Fail fast**: Use `fail-on-error: true` to catch issues early
5. **Provide feedback**: Use outputs to comment on PRs with results