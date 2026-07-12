import { describe, it, expect } from 'vitest';
import { PluginManifestRule } from '../../../src/rules/PluginManifestRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

const PLUGIN = '.claude-plugin/plugin.json';
const MARKETPLACE = '.claude-plugin/marketplace.json';

function lint(content: string, path = PLUGIN) {
  return new PluginManifestRule().lint(new ContextFile(path, content));
}

const messages = (content: string, path = PLUGIN): string[] =>
  lint(content, path).map(v => v.message);

describe('PluginManifestRule', () => {
  describe('identity + gating', () => {
    it('has the expected id and description', () => {
      const rule = new PluginManifestRule();
      expect(rule.id).toBe('plugin-manifest');
      expect(rule.description).toContain('plugin');
    });

    it('appliesTo only plugin/marketplace manifests', () => {
      const rule = new PluginManifestRule();
      expect(rule.appliesTo(new ContextFile(PLUGIN, '{}'))).toBe(true);
      expect(rule.appliesTo(new ContextFile(MARKETPLACE, '{}'))).toBe(true);
      expect(rule.appliesTo(new ContextFile('package.json', '{}'))).toBe(false);
    });

    it('returns no violations for a non-manifest file', () => {
      expect(lint('{ not: json', 'package.json')).toHaveLength(0);
    });
  });

  describe('JSON parsing', () => {
    it('flags invalid JSON', () => {
      const violations = lint('{ "name": ');
      expect(violations).toHaveLength(1);
      expect(violations[0]?.message).toContain('Invalid JSON');
      expect(violations[0]?.severity).toBe(Severity.ERROR);
    });

    it('flags a non-object top-level value', () => {
      expect(messages('[]')).toContain(
        'Plugin manifest must be a JSON object.'
      );
    });
  });

  describe('plugin.json', () => {
    it('accepts a valid manifest', () => {
      const content = JSON.stringify({
        name: 'my-plugin',
        version: '1.2.3',
        description: 'Does things',
        commands: ['./commands/run.md'],
        agents: './agents',
        hooks: { PreToolUse: [] },
      });
      expect(lint(content)).toHaveLength(0);
    });

    it('requires a name', () => {
      expect(messages(JSON.stringify({ version: '1.0.0' }))).toContain(
        'Manifest is missing required "name" field.'
      );
    });

    it('rejects an empty name', () => {
      expect(messages(JSON.stringify({ name: '  ' }))).toContain(
        '"name" must be a non-empty string.'
      );
    });

    it('rejects a non-SemVer version', () => {
      const v = lint(JSON.stringify({ name: 'x', version: 'v1' }));
      expect(v.some(x => x.message.includes('not valid SemVer'))).toBe(true);
    });

    it('rejects a non-string version', () => {
      expect(messages(JSON.stringify({ name: 'x', version: 3 }))).toContain(
        '"version" must be a SemVer string (e.g. "1.2.3").'
      );
    });

    it('accepts a manifest without a version (optional)', () => {
      expect(lint(JSON.stringify({ name: 'x' }))).toHaveLength(0);
    });

    it('rejects a resource field of the wrong type', () => {
      expect(messages(JSON.stringify({ name: 'x', commands: 42 }))).toContain(
        '"commands" must be a path string or an array of path strings.'
      );
    });

    it('rejects a non-string entry inside a resource array', () => {
      expect(
        messages(JSON.stringify({ name: 'x', skills: ['./ok', 5] }))
      ).toContain('"skills[1]" must be a path string.');
    });

    it('flags an empty resource path', () => {
      expect(messages(JSON.stringify({ name: 'x', agents: '' }))).toContain(
        '"agents" is an empty path.'
      );
    });

    it('warns on absolute and backslash resource paths', () => {
      const v = lint(
        JSON.stringify({ name: 'x', commands: '/etc/run.md', agents: 'a\\b' })
      );
      expect(v.some(x => x.message.includes('absolute path'))).toBe(true);
      expect(v.some(x => x.message.includes('backslashes'))).toBe(true);
      expect(v.every(x => x.severity === Severity.WARNING)).toBe(true);
    });

    it('flags a non-string description', () => {
      expect(messages(JSON.stringify({ name: 'x', description: 1 }))).toContain(
        '"description" must be a string.'
      );
    });
  });

  describe('marketplace.json', () => {
    it('accepts a valid marketplace', () => {
      const content = JSON.stringify({
        name: 'my-market',
        owner: { name: 'me' },
        plugins: [{ name: 'a', source: './plugins/a', version: '1.0.0' }],
      });
      expect(lint(content, MARKETPLACE)).toHaveLength(0);
    });

    it('requires a plugins array', () => {
      expect(messages(JSON.stringify({ name: 'm' }), MARKETPLACE)).toContain(
        'Marketplace manifest is missing required "plugins" array.'
      );
    });

    it('rejects a non-array plugins value', () => {
      expect(
        messages(JSON.stringify({ name: 'm', plugins: {} }), MARKETPLACE)
      ).toContain('"plugins" must be an array of plugin entries.');
    });

    it('requires each entry to have a name', () => {
      const v = lint(
        JSON.stringify({ name: 'm', plugins: [{ source: './a' }] }),
        MARKETPLACE
      );
      expect(
        v.some(
          x => x.message.includes('plugins[0]') && x.message.includes('name')
        )
      ).toBe(true);
    });

    it('warns when an entry is missing a source', () => {
      const v = lint(
        JSON.stringify({ name: 'm', plugins: [{ name: 'a' }] }),
        MARKETPLACE
      );
      const sourceWarn = v.find(x => x.message.includes('source'));
      expect(sourceWarn?.severity).toBe(Severity.WARNING);
    });

    it('validates SemVer of entry versions', () => {
      const v = lint(
        JSON.stringify({
          name: 'm',
          plugins: [{ name: 'a', source: './a', version: 'bad' }],
        }),
        MARKETPLACE
      );
      expect(v.some(x => x.message.includes('not valid SemVer'))).toBe(true);
    });
  });
});
