#!/usr/bin/env node

import { writeFileSync, chmodSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const PRE_PUSH_HOOK_SCRIPT = `#!/bin/sh

# cclint pre-push hook
# Check linting and formatting before push

echo "🔍 Running pre-push checks..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "❌ Not in a git repository"
  exit 1
fi

# Check if package.json exists (ensure we're in a Node.js project)
if [ ! -f "package.json" ]; then
  echo "ℹ️  No package.json found, skipping pre-push checks"
  exit 0
fi

# Function to check if npm script exists
script_exists() {
  npm run "$1" --silent > /dev/null 2>&1
  return $?
}

# Track if any checks failed
FAILED=0

# Run TypeScript type checking
if script_exists "typecheck"; then
  echo "📝 Running TypeScript type check..."
  if ! npm run typecheck; then
    echo "❌ TypeScript type check failed"
    FAILED=1
  else
    echo "✅ TypeScript type check passed"
  fi
fi

# Run linting
if script_exists "lint"; then
  echo "🔍 Running ESLint..."
  if ! npm run lint; then
    echo "❌ Linting failed"
    FAILED=1
  else
    echo "✅ Linting passed"
  fi
fi

# Run formatting check
if script_exists "format:check"; then
  echo "💅 Checking code formatting..."
  if ! npm run format:check; then
    echo "❌ Code formatting check failed"
    echo "💡 Run 'npm run format' to fix formatting issues"
    FAILED=1
  else
    echo "✅ Code formatting check passed"
  fi
fi

# Run tests
if script_exists "test"; then
  echo "🧪 Running tests..."
  if ! npm test; then
    echo "❌ Tests failed"
    FAILED=1
  else
    echo "✅ All tests passed"
  fi
fi

if [ $FAILED -eq 1 ]; then
  echo ""
  echo "❌ Pre-push checks failed. Please fix the issues above before pushing."
  echo "💡 To skip these checks, use: git push --no-verify"
  echo ""
  exit 1
else
  echo ""
  echo "✅ All pre-push checks passed! 🚀"
  echo ""
fi

exit 0
`;

function installPrePushHook() {
  const gitDir = '.git';
  const hooksDir = join(gitDir, 'hooks');
  const hookPath = join(hooksDir, 'pre-push');

  // Check if we're in a git repository
  if (!existsSync(gitDir)) {
    console.error('❌ Not a git repository. Run this script from the root of your git repository.');
    process.exit(1);
  }

  // Create hooks directory if it doesn't exist
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  // Check if pre-push hook already exists
  if (existsSync(hookPath)) {
    console.log('⚠️  Pre-push hook already exists. Backing up...');
    writeFileSync(hookPath + '.backup', readFileSync(hookPath));
  }

  // Write the hook script
  writeFileSync(hookPath, PRE_PUSH_HOOK_SCRIPT, { mode: 0o755 });

  // Make sure it's executable
  chmodSync(hookPath, 0o755);

  console.log('✅ Pre-push hook installed successfully!');
  console.log('');
  console.log('The hook will run the following checks before each push:');
  console.log('  📝 TypeScript type checking');
  console.log('  🔍 ESLint linting');
  console.log('  💅 Prettier formatting');
  console.log('  🧪 Test suite');
  console.log('');
  console.log('To skip the checks for a specific push, use: git push --no-verify');
  console.log('');
}

// Run if called directly
import { fileURLToPath } from 'url';
import { basename } from 'path';

if (basename(fileURLToPath(import.meta.url)) === basename(process.argv[1])) {
  installPrePushHook();
}

export { installPrePushHook };