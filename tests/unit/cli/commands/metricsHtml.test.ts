import { describe, it, expect } from 'vitest';
import {
  badgeMarkdown,
  renderMetricsHtml,
} from '../../../../src/cli/commands/metrics.js';

describe('metrics dashboard helpers', () => {
  it('renders an empty state', () => {
    const html = renderMetricsHtml([]);
    expect(html).toContain('No snapshots yet');
    expect(html).toContain('No score yet');
  });

  it('escapes path text and shows the latest score', () => {
    const html = renderMetricsHtml([
      {
        recordedAt: '2026-09-21T00:00:00.000Z',
        path: '<script>',
        files: 1,
        errors: 0,
        warnings: 1,
        infos: 0,
        score: 97,
      },
    ]);
    expect(html).toContain('Latest score: 97');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('formats a shields badge from the score', () => {
    expect(badgeMarkdown(95)).toContain('brightgreen');
    expect(badgeMarkdown(70)).toContain('yellow');
    expect(badgeMarkdown(10)).toContain('red');
  });
});
