import { describe, it, expect, beforeEach } from 'vitest';
import { PluginSandbox } from '../../../../src/infrastructure/security/PluginSandbox.js';
import { CustomRule } from '../../../../src/domain/CustomRule.js';
import type { Plugin } from '../../../../src/domain/CustomRule.js';
import { ContextFile } from '../../../../src/domain/ContextFile.js';
import { Violation } from '../../../../src/domain/Violation.js';
import { Severity } from '../../../../src/domain/Severity.js';
import { Location } from '../../../../src/domain/Location.js';
import type { Fix } from '../../../../src/domain/AutoFix.js';

class BaseRule extends CustomRule {
  constructor(
    id: string,
    private impl: (file: ContextFile) => Violation[]
  ) {
    super(id, `${id} test rule`);
  }
  protected validateInternal(file: ContextFile): Violation[] {
    return this.impl(file);
  }
  public generateFixes(): Fix[] {
    return [];
  }
}

function plugin(rule: CustomRule): Plugin {
  return { name: 'test-plugin', version: '0.0.0', rules: [rule] };
}

describe('PluginSandbox — adversarial', () => {
  let sandbox: PluginSandbox;
  let file: ContextFile;

  beforeEach(() => {
    sandbox = new PluginSandbox({ timeout: 500 });
    file = new ContextFile('CLAUDE.md', '# Test\n');
  });

  describe('timeout enforcement', () => {
    it('should kill plugin stuck in async pending promise', async () => {
      const evil = new BaseRule('evil-pending', () => {
        // never resolves
        return new Promise(() => undefined) as unknown as Violation[];
      });

      const result = await sandbox.executePlugin(plugin(evil), file);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/timed out/i);
    });

    it('should kill plugin that yields but exceeds timeout', async () => {
      const evil = new BaseRule('slow-cooperative', async () => {
        // Yields to event loop but takes too long.
        await new Promise(r => setTimeout(r, 2000));
        return [];
      });

      const start = Date.now();
      const result = await sandbox.executePlugin(plugin(evil), file);
      const elapsed = Date.now() - start;

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/timed out/i);
      expect(elapsed).toBeLessThan(1500);
    });
  });

  describe('error containment', () => {
    it('should contain plugin throw without crashing host', async () => {
      const evil = new BaseRule('throws', () => {
        throw new Error('boom from plugin');
      });

      const result = await sandbox.executePlugin(plugin(evil), file);
      // Per current implementation rule errors are logged but not propagated;
      // the sandbox returns success with empty violations.
      expect(result).toBeDefined();
      expect(result.violations ?? []).toEqual([]);
    });

    it('should contain non-Error throw values (string, object)', async () => {
      const evilString = new BaseRule('throws-string', () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'string error';
      });
      const evilObject = new BaseRule('throws-obj', () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw { weird: true };
      });

      const r1 = await sandbox.executePlugin(plugin(evilString), file);
      const r2 = await sandbox.executePlugin(plugin(evilObject), file);

      expect(r1.violations ?? []).toEqual([]);
      expect(r2.violations ?? []).toEqual([]);
    });
  });

  describe('output validation', () => {
    it('should drop violations that are not proper Violation objects', async () => {
      const evil = new BaseRule('bad-output', () => {
        return [
          { not: 'a violation' } as unknown as Violation,
          'string instead of object' as unknown as Violation,
          null as unknown as Violation,
          undefined as unknown as Violation,
        ];
      });

      const result = await sandbox.executePlugin(plugin(evil), file);
      expect(result.success).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('should accept properly shaped violations', async () => {
      const good = new BaseRule('good', () => [
        new Violation('good', 'msg', Severity.WARNING, new Location(1, 1)),
      ]);

      const result = await sandbox.executePlugin(plugin(good), file);
      expect(result.success).toBe(true);
      expect(result.violations).toHaveLength(1);
    });

    it('should drop violations that are not arrays', async () => {
      const evil = new BaseRule('non-array', () => {
        return 'not an array' as unknown as Violation[];
      });

      const result = await sandbox.executePlugin(plugin(evil), file);
      expect(result.success).toBe(true);
      expect(result.violations).toEqual([]);
    });
  });

  describe('input immutability', () => {
    it('should pass a frozen ContextFile so plugins cannot mutate it', async () => {
      let mutationFailed = false;
      const probe = new BaseRule('mutator', f => {
        try {
          (f as unknown as { content: string }).content = 'tampered';
        } catch {
          mutationFailed = true;
        }
        return [];
      });

      const original = file.content;
      await sandbox.executePlugin(plugin(probe), file);

      expect(file.content).toBe(original);
      expect(mutationFailed).toBe(true);
    });
  });

  describe('module allowlist', () => {
    it('should reject relative imports', () => {
      expect(sandbox.isModuleAllowed('./evil')).toBe(false);
      expect(sandbox.isModuleAllowed('../../../etc/passwd')).toBe(false);
      expect(sandbox.isModuleAllowed('/absolute/evil')).toBe(false);
    });

    it('should reject network and fs node-builtins by default', () => {
      expect(sandbox.isModuleAllowed('fs')).toBe(false);
      expect(sandbox.isModuleAllowed('net')).toBe(false);
      expect(sandbox.isModuleAllowed('http')).toBe(false);
      expect(sandbox.isModuleAllowed('child_process')).toBe(false);
      expect(sandbox.isModuleAllowed('node:fs')).toBe(false);
      expect(sandbox.isModuleAllowed('node:child_process')).toBe(false);
    });

    it('should allow approved utility modules', () => {
      expect(sandbox.isModuleAllowed('path')).toBe(true);
      expect(sandbox.isModuleAllowed('url')).toBe(true);
      expect(sandbox.isModuleAllowed('node:path')).toBe(true);
    });

    it('should reject unknown third-party modules', () => {
      expect(sandbox.isModuleAllowed('node-fetch')).toBe(false);
      expect(sandbox.isModuleAllowed('axios')).toBe(false);
    });
  });

  describe('signature gate', () => {
    it('should reject plugin with no signature', () => {
      const dummy = plugin(new BaseRule('x', () => []));
      expect(sandbox.validatePluginSignature(dummy)).toBe(false);
      expect(sandbox.validatePluginSignature(dummy, '')).toBe(false);
    });

    it('should accept plugin with non-empty signature placeholder', () => {
      // Note: current implementation only checks length > 0.
      // This is documented as a placeholder until real signature
      // verification lands; this test pins the current contract.
      const dummy = plugin(new BaseRule('x', () => []));
      expect(sandbox.validatePluginSignature(dummy, 'sig')).toBe(true);
    });
  });

  describe('known sandbox limitations (documenting current threat model)', () => {
    // These tests document gaps in the current same-process sandbox.
    // They are skipped to avoid actually exercising dangerous paths in CI,
    // but the comments preserve the audit trail until a worker-thread or
    // isolated-vm-based sandbox lands.

    it.skip('LIMITATION: synchronous infinite loop blocks event loop — timeout cannot fire', () => {
      // executeWithTimeout uses setTimeout, but Promise.resolve(fn())
      // synchronously calls fn(). A while(true) inside the rule
      // starves the event loop and prevents the timeout from firing.
      // Worker threads or isolated-vm would solve this.
      expect(true).toBe(true);
    });

    it.skip('LIMITATION: plugin can require fs because sandbox does not block runtime require', () => {
      // The isModuleAllowed allowlist only governs what a future loader
      // would honor. The current sandbox runs plugin code in the host
      // Node process, so a malicious rule.lint() can still call
      // require('fs') itself. Migration target: worker_threads.
      expect(true).toBe(true);
    });

    it.skip('LIMITATION: plugin can call process.exit() and bring down the host', () => {
      // Same root cause as above. Worker-thread isolation would scope
      // process.exit to the worker.
      expect(true).toBe(true);
    });

    it.skip('LIMITATION: memory check is post-hoc, not enforced mid-execution', () => {
      // executePlugin compares heapUsed delta after the rule returns.
      // A rule that allocates 4 GB will OOM the host before the check.
      expect(true).toBe(true);
    });
  });
});
