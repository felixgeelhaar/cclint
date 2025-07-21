#!/usr/bin/env node

import { writeFileSync, chmodSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const HOOK_SCRIPT = `#!/bin/sh

# cclint pre-commit hook
# Automatically lint CLAUDE.md files before commit

echo "🔍 Running cclint on CLAUDE.md files..."

# Find all CLAUDE.md files in the repository
CLAUDE_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E "(CLAUDE|claude)\\.md$" || true)

if [ -z "$CLAUDE_FILES" ]; then
  echo "ℹ️  No CLAUDE.md files to lint"
  exit 0
fi

# Run cclint on the files
if command -v cclint >/dev/null 2>&1; then
  LINT_CMD="cclint"
elif command -v npx >/dev/null 2>&1; then
  LINT_CMD="npx cclint"
else
  echo "❌ cclint not found. Please install it globally: npm install -g cclint"
  exit 1
fi

echo "📝 Linting files: $CLAUDE_FILES"

# Lint each file
EXIT_CODE=0
for file in $CLAUDE_FILES; do
  if [ -f "$file" ]; then
    echo "  Checking $file..."
    if ! $LINT_CMD lint "$file"; then
      EXIT_CODE=1
    fi
  fi
done

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ cclint found issues in your CLAUDE.md files"
  echo "💡 Fix the issues above or use --no-verify to skip this check"
  echo ""
  exit 1
else
  echo "✅ All CLAUDE.md files passed linting"
fi

exit 0
`;

function installHook() {
  const gitDir = '.git';
  const hooksDir = join(gitDir, 'hooks');
  const hookPath = join(hooksDir, 'pre-commit');

  // Check if we're in a git repository
  if (!existsSync(gitDir)) {
    console.error('❌ Not a git repository. Run this script from the root of your git repository.');
    process.exit(1);
  }

  // Create hooks directory if it doesn't exist
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  // Check if pre-commit hook already exists
  if (existsSync(hookPath)) {
    console.log('⚠️  Pre-commit hook already exists. Backing up...');
    writeFileSync(hookPath + '.backup', readFileSync(hookPath));
  }

  // Write the hook script
  writeFileSync(hookPath, HOOK_SCRIPT, { mode: 0o755 });

  // Make sure it's executable
  chmodSync(hookPath, 0o755);

  console.log('✅ cclint pre-commit hook installed successfully!');
  console.log('');
  console.log('The hook will automatically run cclint on CLAUDE.md files before each commit.');
  console.log('To skip the check for a specific commit, use: git commit --no-verify');
  console.log('');
}

// Run if called directly
import { fileURLToPath } from 'url';
import { basename } from 'path';

if (basename(fileURLToPath(import.meta.url)) === basename(process.argv[1])) {
  installHook();
}

export { installHook };