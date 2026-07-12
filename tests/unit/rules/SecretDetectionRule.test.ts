import { describe, it, expect } from 'vitest';
import { SecretDetectionRule } from '../../../src/rules/SecretDetectionRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';
import type { Violation } from '../../../src/domain/Violation.js';

function md(content: string, path = '/repo/CLAUDE.md'): ContextFile {
  return new ContextFile(path, content);
}

function lint(content: string): Violation[] {
  return new SecretDetectionRule().lint(md(content));
}

// Realistic-shaped but entirely synthetic, high-variety tokens. None are real
// credentials; they exist only to exercise the detector's shape matching.
const FIXTURES = {
  openai: 'sk-Ab3xK9mZ2pQr7TvWn4Lf8YcJ5DgH1soE6UoIaPbNqRtM0uW',
  openaiProject: 'sk-proj-Ab3xK9mZ2pQr7TvWn4Lf8YcJ5DgH1soE6UoIaPbNq',
  anthropic: 'sk-ant-api03-Ab3xK9mZ2pQr7TvWn4Lf8YcJ5DgH1soE6UoIaPbNqRtM',
  githubPat: 'ghp_Ab3xK9mZ2pQr7TvWn4Lf8YcJ5DgH1soE6UoIa',
  githubOauth: 'gho_Zq7Wn4Lf8YcJ5DgH1soE6UoIaPbNqRtM0uWAb3x',
  githubFineGrained:
    'github_pat_11ABZ3XQ0Ab3xK9mZ2pQr7TvWn4Lf8YcJ5DgH1soE6UoIaPbNqRtM',
  aws: 'AKIA3XYZQRSTUVWK1J4B',
  google: 'AIzaSyB1nK9mZ2pQr7TvWn4Lf8oYcJ5DgH0sEqT',
  slack: 'xoxb-2413538028932-2413539874323-Ab3xK9mZ2pQr7TvWn4Lf8Yc',
  privateKey: '-----BEGIN RSA PRIVATE KEY-----',
  highEntropyAssignment: 'API_SECRET=Zx9Kq3Vb7Nm2Wp5Rt8Lf4Yc6Jd1Hg0Se',
};

describe('SecretDetectionRule', () => {
  describe('rule identity', () => {
    it('has id secret-detection', () => {
      expect(new SecretDetectionRule().id).toBe('secret-detection');
    });

    it('has a non-empty description', () => {
      expect(new SecretDetectionRule().description.length).toBeGreaterThan(0);
    });
  });

  describe('appliesTo', () => {
    const rule = new SecretDetectionRule();

    it('applies to markdown files', () => {
      expect(rule.appliesTo(md('x', '/repo/CLAUDE.md'))).toBe(true);
      expect(rule.appliesTo(md('x', '/repo/notes.markdown'))).toBe(true);
    });

    it('does not apply to non-markdown files', () => {
      expect(rule.appliesTo(md('x', '/repo/.claude/settings.json'))).toBe(
        false
      );
      expect(rule.appliesTo(md('x', '/repo/index.ts'))).toBe(false);
    });
  });

  describe('positive detections', () => {
    it.each([
      ['OpenAI', FIXTURES.openai, /openai/i],
      ['OpenAI project', FIXTURES.openaiProject, /openai/i],
      ['Anthropic', FIXTURES.anthropic, /anthropic/i],
      ['GitHub personal access token', FIXTURES.githubPat, /github/i],
      ['GitHub OAuth token', FIXTURES.githubOauth, /github/i],
      ['GitHub fine-grained token', FIXTURES.githubFineGrained, /github/i],
      ['AWS access key', FIXTURES.aws, /aws/i],
      ['Google API key', FIXTURES.google, /google/i],
      ['Slack token', FIXTURES.slack, /slack/i],
      ['private key block', FIXTURES.privateKey, /private key/i],
    ])('detects %s secrets', (_label, secret, kindMatcher) => {
      const violations = lint(`# Title\n\nHere is a token: ${secret}\n`);
      expect(violations.length).toBeGreaterThanOrEqual(1);
      const first = violations[0]!;
      expect(first.severity).toBe(Severity.ERROR);
      expect(first.message).toMatch(kindMatcher);
    });

    it('detects secrets inside fenced code blocks', () => {
      const violations = lint(
        ['# Title', '', '```bash', `export KEY=${FIXTURES.openai}`, '```'].join(
          '\n'
        )
      );
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0]!.severity).toBe(Severity.ERROR);
    });

    it('detects a high-entropy KEY=/TOKEN=/SECRET=/PASSWORD= assignment', () => {
      const violations = lint(`# Title\n\n${FIXTURES.highEntropyAssignment}\n`);
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations[0]!.severity).toBe(Severity.ERROR);
    });

    it('reports the correct line number', () => {
      const violations = lint(`# Title\n\nsome prose\n${FIXTURES.aws}\n`);
      expect(violations[0]!.location.line).toBe(4);
    });
  });

  describe('masking', () => {
    it('masks the secret and never echoes the full value', () => {
      const violations = lint(`token: ${FIXTURES.openai}`);
      const message = violations[0]!.message;
      expect(message).not.toContain(FIXTURES.openai);
      // First 4 chars shown followed by an ellipsis.
      expect(message).toContain(`${FIXTURES.openai.slice(0, 4)}…`);
    });
  });

  describe('placeholder negatives (no false positives)', () => {
    it.each([
      ['OpenAI xxxx placeholder', 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'],
      ['OpenAI all-same-char', 'sk-aaaaaaaaaaaaaaaaaaaaaaaa'],
      ['Anthropic placeholder', 'sk-ant-your-api-key-here-goes'],
      ['AWS xxxx placeholder', 'AKIAXXXXXXXXXXXXXXXX'],
      ['AWS EXAMPLE placeholder', 'AKIAIOSFODNN7EXAMPLE'],
      ['angle-bracket placeholder', 'API_KEY=<your-openai-key-here>'],
      ['your-api-key-here assignment', 'API_KEY=your-api-key-here'],
      ['env reference', 'API_KEY=${OPENAI_API_KEY}'],
      ['example word', 'TOKEN=example-token-value-placeholder'],
    ])('does not fire on %s', (_label, content) => {
      expect(lint(content)).toHaveLength(0);
    });

    it('does not fire on ordinary prose and code', () => {
      const content = [
        '# Project',
        '',
        'Run `npm run build` to compile the TypeScript sources.',
        '',
        '```bash',
        'export NODE_ENV=production',
        'npm test',
        '```',
      ].join('\n');
      expect(lint(content)).toHaveLength(0);
    });

    it('does not fire on a low-entropy assignment', () => {
      expect(lint('PASSWORD=changeme')).toHaveLength(0);
      expect(lint('SECRET=hunter2')).toHaveLength(0);
    });
  });

  describe('deduplication', () => {
    it('reports a prefixed secret once even inside an assignment', () => {
      const violations = lint(`OPENAI_API_KEY=${FIXTURES.openai}`);
      expect(violations).toHaveLength(1);
    });
  });
});
