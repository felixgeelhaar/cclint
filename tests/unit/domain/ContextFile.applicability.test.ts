import { describe, it, expect } from 'vitest';
import { ContextFile } from '../../../src/domain/ContextFile.js';

describe('ContextFile — CLAUDE.md-document applicability', () => {
  const md = (path: string): ContextFile => new ContextFile(path, '# x\n');

  it('treats CLAUDE.md (and nested) as a Claude document', () => {
    expect(md('CLAUDE.md').isClaudeMarkdown()).toBe(true);
    expect(md('packages/app/CLAUDE.md').isClaudeMarkdown()).toBe(true);
    expect(md('notes.md').isClaudeMarkdown()).toBe(true);
  });

  it('excludes skills, agents, and output-styles from Claude-document rules', () => {
    const skill = md('.claude/skills/foo/SKILL.md');
    const agent = md('.claude/agents/reviewer.md');
    const style = md('.claude/output-styles/terse.md');

    expect(skill.isSkillFile()).toBe(true);
    expect(agent.isAgentFile()).toBe(true);
    expect(style.isOutputStyle()).toBe(true);

    for (const f of [skill, agent, style]) {
      expect(f.isMarkdown()).toBe(true);
      expect(f.isClaudeMarkdown()).toBe(false);
    }
  });

  it('non-markdown files are never Claude documents', () => {
    expect(
      new ContextFile('.claude/settings.json', '{}').isClaudeMarkdown()
    ).toBe(false);
  });
});
