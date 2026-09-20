import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';
import { basename, dirname, join } from 'path';
import { existsSync } from 'fs';

const AT_START = new Location(1, 1);

/**
 * Guides AGENTS.md usage with Claude Code's 2.1.277+ fallback behaviour.
 *
 * @remarks
 * Default Project instructions (`claude-md-or-agents-md`): Claude Code reads
 * AGENTS.md only when no CLAUDE.md / `.claude/CLAUDE.md` / CLAUDE.local.md sits
 * on the path to the working directory. A CLAUDE.md that `@AGENTS.md`-imports
 * (or symlinks) remains the portable option for Bedrock/Foundry and for
 * dual-tool repos. This rule is advisory and uses lightweight sibling
 * existence checks.
 */
export class AgentsMdRule implements Rule {
  public readonly id = 'agents-md';
  public readonly description =
    'Guides AGENTS.md discovery and CLAUDE.md bridge patterns (Claude Code 2.1.277+)';

  public appliesTo(file: ContextFile): boolean {
    if (file.isAgentsMarkdown()) {
      return true;
    }
    const name = basename(file.path);
    return name === 'CLAUDE.md' || name === 'CLAUDE.local.md';
  }

  public lint(file: ContextFile): Violation[] {
    if (!this.appliesTo(file)) {
      return [];
    }

    if (file.isAgentsMarkdown()) {
      return this.lintAgentsFile(file);
    }

    const name = basename(file.path);
    if (name === 'CLAUDE.local.md') {
      return this.lintLocalWithAgentsSibling(file);
    }
    return this.lintClaudeWithAgentsSibling(file);
  }

  private lintAgentsFile(file: ContextFile): Violation[] {
    const dir = dirname(file.path);
    const hasSharedClaude =
      existsSync(join(dir, 'CLAUDE.md')) ||
      existsSync(join(dir, '.claude', 'CLAUDE.md'));
    const hasLocalClaude = existsSync(join(dir, 'CLAUDE.local.md'));

    const violations: Violation[] = [];

    if (hasSharedClaude) {
      violations.push(
        new Violation(
          this.id,
          'AGENTS.md is present alongside a CLAUDE.md in this directory. Under Claude Code\'s default Project instructions setting, CLAUDE.md wins and AGENTS.md is not loaded as a fallback — add `@AGENTS.md` to CLAUDE.md (or set Project instructions to claude-md-and-agents-md) if both should apply.',
          Severity.INFO,
          AT_START
        )
      );
    } else if (hasLocalClaude) {
      violations.push(
        new Violation(
          this.id,
          'A CLAUDE.local.md in this directory blocks Claude Code\'s default AGENTS.md fallback for developers who have that local file. Teammates without CLAUDE.local.md still read AGENTS.md. Prefer `@AGENTS.md` in a shared CLAUDE.md, or set Project instructions to claude-md-and-agents-md.',
          Severity.INFO,
          AT_START
        )
      );
    } else {
      violations.push(
        new Violation(
          this.id,
          'AGENTS.md will be read by Claude Code 2.1.277+ when no CLAUDE.md / .claude/CLAUDE.md / CLAUDE.local.md is on the path to the working directory (default Project instructions). For Bedrock/Foundry or older clients, keep a CLAUDE.md that imports `@AGENTS.md`.',
          Severity.INFO,
          AT_START
        )
      );
    }

    violations.push(...this.softContentHeuristics(file));
    return violations;
  }

  /**
   * Soft, schema-free tips for AGENTS.md content (agents.md has no required
   * sections — these are optional quality nudges).
   */
  private softContentHeuristics(file: ContextFile): Violation[] {
    const lower = file.content.toLowerCase();
    const violations: Violation[] = [];

    const hasBuildOrTest =
      /\b(npm|pnpm|yarn|bun|make|cargo|go test|pytest|vitest|jest|build|test)\b/i.test(
        lower
      );
    if (!hasBuildOrTest && file.getLineCount() > 5) {
      violations.push(
        new Violation(
          this.id,
          'AGENTS.md has no obvious build/test commands. Popular AGENTS.md files list how to install, build, and test so agents can verify their work.',
          Severity.INFO,
          AT_START
        )
      );
    }

    if (file.getLineCount() > 400) {
      violations.push(
        new Violation(
          this.id,
          `AGENTS.md is ${file.getLineCount()} lines. Nested package AGENTS.md files (closest wins) usually work better than one oversized root file.`,
          Severity.INFO,
          AT_START
        )
      );
    }

    return violations;
  }

  private lintClaudeWithAgentsSibling(file: ContextFile): Violation[] {
    const dir = dirname(file.path);
    const agentsSibling =
      existsSync(join(dir, 'AGENTS.md')) ||
      existsSync(join(dir, '.claude', 'AGENTS.md'));

    if (!agentsSibling) {
      return [];
    }

    if (this.importsAgents(file.content)) {
      return [];
    }

    return [
      new Violation(
        this.id,
        'Sibling AGENTS.md found without an `@AGENTS.md` import. Importing (or symlinking) keeps one source of truth for Codex/Cursor/other agents and still works when Claude Code cannot use the AGENTS.md fallback (Bedrock, Foundry, DO_NOT_TRACK).',
        Severity.INFO,
        AT_START
      ),
    ];
  }

  private lintLocalWithAgentsSibling(file: ContextFile): Violation[] {
    const dir = dirname(file.path);
    const agentsSibling =
      existsSync(join(dir, 'AGENTS.md')) ||
      existsSync(join(dir, '.claude', 'AGENTS.md'));

    if (!agentsSibling) {
      return [];
    }

    return [
      new Violation(
        this.id,
        'CLAUDE.local.md blocks Claude Code\'s default AGENTS.md fallback for this directory tree. Teammates without a local file still read AGENTS.md; you will not. Remove the local file, import `@AGENTS.md` from CLAUDE.md, or set Project instructions to claude-md-and-agents-md.',
        Severity.WARNING,
        AT_START
      ),
    ];
  }

  /** True when the file already bridges AGENTS.md via @-import. */
  private importsAgents(content: string): boolean {
    // Match @AGENTS.md / @./AGENTS.md / @.claude/AGENTS.md outside obvious
    // code fences by scanning line-by-line and skipping fenced regions.
    let inFence = false;
    for (const line of content.split(/\r\n|\r|\n/)) {
      if (/^```/.test(line.trimStart())) {
        inFence = !inFence;
        continue;
      }
      if (inFence) {
        continue;
      }
      if (/(^|[\s(])@(\.\/|\.\.\/)*(\.claude\/)?AGENTS\.md\b/.test(line)) {
        return true;
      }
    }
    return false;
  }
}
