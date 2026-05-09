import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Version drift regression gate.
 *
 * Before v0.11.0 the package.json said 0.7.0 while README and CHANGELOG
 * advertised 0.11.0. Users running `cclint --version` saw the wrong
 * number — quiet trust killer. This test pins the four sources to the
 * same value so any future bump fails CI unless all four move together.
 */
describe('version sync', () => {
  const repoRoot = join(__dirname, '..', '..');

  function readPackageVersion(): string {
    const pkg = JSON.parse(
      readFileSync(join(repoRoot, 'package.json'), 'utf-8')
    ) as { version: string };
    return pkg.version;
  }

  function readCliVersion(): string {
    const src = readFileSync(join(repoRoot, 'src/cli/index.ts'), 'utf-8');
    const match = src.match(/\.version\(['"]([^'"]+)['"]\)/);
    if (!match) {
      throw new Error('Could not find .version() call in src/cli/index.ts');
    }
    return match[1] as string;
  }

  function readChangelogTopVersion(): string {
    const changelog = readFileSync(join(repoRoot, 'CHANGELOG.md'), 'utf-8');
    const match = changelog.match(/^## \[?([0-9]+\.[0-9]+\.[0-9]+)\]?/m);
    if (!match) {
      throw new Error('Could not find version heading in CHANGELOG.md');
    }
    return match[1] as string;
  }

  function readReadmeActionVersion(): string {
    const readme = readFileSync(join(repoRoot, 'README.md'), 'utf-8');
    const match = readme.match(/cclint@v([0-9]+\.[0-9]+\.[0-9]+)/);
    if (!match) {
      throw new Error('Could not find action version in README.md');
    }
    return match[1] as string;
  }

  it('package.json and CLI version() should match', () => {
    expect(readCliVersion()).toBe(readPackageVersion());
  });

  it('CHANGELOG top entry should match package.json version', () => {
    expect(readChangelogTopVersion()).toBe(readPackageVersion());
  });

  it('README action snippet should match package.json version', () => {
    expect(readReadmeActionVersion()).toBe(readPackageVersion());
  });
});
