import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getAllRuleIds } from '../../src/infrastructure/RuleMetadata.js';

/**
 * Drift gate: README rule sections must match the registry exactly.
 *
 * Pre-fix, README claimed "18 rules" while `cclint explain` listed 11
 * because new rules (skill-structure, subagent-structure, hook-
 * configuration) were never added to RULE_METADATA. This test asserts
 * every registered rule has a README section and every README rule
 * heading is registered, so docs can never silently drift again.
 */
describe('rule registry / README drift', () => {
  const repoRoot = join(__dirname, '..', '..');

  function readReadme(): string {
    return readFileSync(join(repoRoot, 'README.md'), 'utf-8');
  }

  function readmeRuleIds(): Set<string> {
    const readme = readReadme();
    // Rule headings look like:  ### Rule Name (`rule-id`) ⭐ v0.6.0
    // Capture the backticked rule-id token.
    const ids = new Set<string>();
    const re = /^### [^\n`]+\(`([a-z][a-z0-9-]*)`\)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(readme)) !== null) {
      const id = m[1];
      if (id !== undefined) {
        ids.add(id);
      }
    }
    return ids;
  }

  it('every registered rule should have a README section', () => {
    const registered = new Set(getAllRuleIds());
    const documented = readmeRuleIds();

    const undocumented = [...registered].filter(id => !documented.has(id));
    expect(
      undocumented,
      `Rules missing from README: ${undocumented.join(', ')}`
    ).toEqual([]);
  });

  it('every README rule heading should be a registered rule', () => {
    const registered = new Set(getAllRuleIds());
    const documented = readmeRuleIds();

    // Allow deprecated rules to appear in README without registry entry.
    const deprecated = new Set(['content']);

    const orphaned = [...documented].filter(
      id => !registered.has(id) && !deprecated.has(id)
    );
    expect(
      orphaned,
      `README rules not in registry: ${orphaned.join(', ')}`
    ).toEqual([]);
  });
});
