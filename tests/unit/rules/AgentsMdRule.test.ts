import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AgentsMdRule } from '../../../src/rules/AgentsMdRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('AgentsMdRule', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cclint-agents-md-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('INFO when AGENTS.md is alone (fallback path)', () => {
    const path = join(root, 'AGENTS.md');
    writeFileSync(path, '# Agents\n\n- Run npm test\n');
    const violations = new AgentsMdRule().lint(
      new ContextFile(path, '# Agents\n\n- Run npm test\n')
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe(Severity.INFO);
    expect(violations[0]?.message).toMatch(/2\.1\.277/);
  });

  it('INFO when AGENTS.md sits beside CLAUDE.md', () => {
    writeFileSync(join(root, 'CLAUDE.md'), '# Claude\n');
    const path = join(root, 'AGENTS.md');
    writeFileSync(path, '# Agents\n');
    const violations = new AgentsMdRule().lint(
      new ContextFile(path, '# Agents\n')
    );

    expect(violations.some(v => v.message.includes('alongside a CLAUDE.md'))).toBe(
      true
    );
  });

  it('INFO when only CLAUDE.local.md blocks AGENTS.md for local developers', () => {
    writeFileSync(join(root, 'CLAUDE.local.md'), '# Local\n');
    const path = join(root, 'AGENTS.md');
    writeFileSync(path, '# Agents\n');
    const violations = new AgentsMdRule().lint(
      new ContextFile(path, '# Agents\n')
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toMatch(/CLAUDE\.local\.md/);
    expect(violations[0]?.message).toMatch(/Teammates without/);
    expect(violations[0]?.message).not.toMatch(/CLAUDE\.md wins/);
  });

  it('INFO when CLAUDE.md has sibling AGENTS.md without import', () => {
    writeFileSync(join(root, 'AGENTS.md'), '# Agents\n');
    const path = join(root, 'CLAUDE.md');
    writeFileSync(path, '# Project\n');
    const violations = new AgentsMdRule().lint(
      new ContextFile(path, '# Project\n')
    );

    expect(violations.some(v => v.message.includes('@AGENTS.md'))).toBe(true);
  });

  it('is quiet when CLAUDE.md already imports AGENTS.md', () => {
    writeFileSync(join(root, 'AGENTS.md'), '# Agents\n');
    const path = join(root, 'CLAUDE.md');
    const content = '@AGENTS.md\n\n## Claude Code\nUse plan mode.\n';
    writeFileSync(path, content);
    const violations = new AgentsMdRule().lint(new ContextFile(path, content));

    expect(violations).toEqual([]);
  });

  it('ignores @AGENTS.md mentions inside code fences', () => {
    writeFileSync(join(root, 'AGENTS.md'), '# Agents\n');
    const path = join(root, 'CLAUDE.md');
    const content = '# Project\n\n```md\n@AGENTS.md\n```\n';
    writeFileSync(path, content);
    const violations = new AgentsMdRule().lint(new ContextFile(path, content));

    expect(violations.some(v => v.message.includes('@AGENTS.md'))).toBe(true);
  });

  it('WARN when CLAUDE.local.md would block AGENTS.md fallback', () => {
    writeFileSync(join(root, 'AGENTS.md'), '# Agents\n');
    const path = join(root, 'CLAUDE.local.md');
    writeFileSync(path, '# Local\n');
    const violations = new AgentsMdRule().lint(
      new ContextFile(path, '# Local\n')
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe(Severity.WARNING);
    expect(violations[0]?.message).toMatch(/blocks/);
  });

  it('appliesTo AGENTS.md and CLAUDE memory filenames only', () => {
    const rule = new AgentsMdRule();
    expect(rule.appliesTo(new ContextFile('/r/AGENTS.md', '#\n'))).toBe(true);
    expect(rule.appliesTo(new ContextFile('/r/CLAUDE.md', '#\n'))).toBe(true);
    expect(rule.appliesTo(new ContextFile('/r/README.md', '#\n'))).toBe(false);
  });

  it('INFO when AGENTS.md lacks build/test hints', () => {
    const path = join(root, 'AGENTS.md');
    const content = [
      '# Agents',
      '',
      '- Be careful with the codebase',
      '- Follow team conventions always',
      '- Prefer clarity',
      '- Ask before large refactors',
      '- Keep commits small',
      '',
    ].join('\n');
    writeFileSync(path, content);
    const violations = new AgentsMdRule().lint(new ContextFile(path, content));
    expect(
      violations.some(v => v.message.includes('build/test commands'))
    ).toBe(true);
  });
});
