import { describe, it, expect } from 'vitest';
import { ContextFile } from '../../../src/domain/ContextFile.js';

describe('ContextFile — CLAUDE.md-document applicability', () => {
  const md = (path: string): ContextFile => new ContextFile(path, '# x\n');

  it('treats CLAUDE.md (and nested) as a Claude document', () => {
    expect(md('CLAUDE.md').isClaudeMarkdown()).toBe(true);
    expect(md('packages/app/CLAUDE.md').isClaudeMarkdown()).toBe(true);
    expect(md('notes.md').isClaudeMarkdown()).toBe(true);
  });

  it('excludes skills, agents, output-styles, AGENTS.md, and rules', () => {
    const skill = md('.claude/skills/foo/SKILL.md');
    const agent = md('.claude/agents/reviewer.md');
    const style = md('.claude/output-styles/terse.md');
    const agents = md('AGENTS.md');
    const nestedAgents = md('.claude/AGENTS.md');
    const rule = md('.claude/rules/api.md');

    expect(skill.isSkillFile()).toBe(true);
    expect(agent.isAgentFile()).toBe(true);
    expect(style.isOutputStyle()).toBe(true);
    expect(agents.isAgentsMarkdown()).toBe(true);
    expect(nestedAgents.isAgentsMarkdown()).toBe(true);
    expect(rule.isClaudeRulesFile()).toBe(true);

    for (const f of [skill, agent, style, agents, nestedAgents, rule]) {
      expect(f.isMarkdown()).toBe(true);
      expect(f.isClaudeMarkdown()).toBe(false);
    }
  });

  it('treats AGENTS.md as a project instruction file', () => {
    expect(md('AGENTS.md').isProjectInstructionFile()).toBe(true);
    expect(md('CLAUDE.md').isProjectInstructionFile()).toBe(true);
    expect(md('.claude/rules/x.md').isProjectInstructionFile()).toBe(false);
  });

  it('non-markdown files are never Claude documents', () => {
    expect(
      new ContextFile('.claude/settings.json', '{}').isClaudeMarkdown()
    ).toBe(false);
  });
});
