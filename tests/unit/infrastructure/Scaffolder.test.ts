import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Scaffolder } from '../../../src/infrastructure/Scaffolder.js';
import { ProjectDetector } from '../../../src/infrastructure/ProjectDetector.js';

describe('Scaffolder.preview', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'cclint-scaffold-'));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('renders content without writing to disk', () => {
    const scaffolder = new Scaffolder();
    const outputPath = join(workDir, 'CLAUDE.md');
    const result = scaffolder.preview({
      template: 'minimal',
      projectName: 'preview-proj',
      projectDescription: 'Preview only',
      outputPath,
    });

    expect(result.path).toBe(outputPath);
    expect(result.content).toContain('preview-proj');
    expect(result.content).toContain('Preview only');
    expect(existsSync(outputPath)).toBe(false);
  });

  it('matches scaffold content for the same options', () => {
    writeFileSync(
      join(workDir, 'package.json'),
      JSON.stringify({
        name: 'lib-demo',
        description: 'A library',
        main: 'index.js',
      })
    );
    const detection = new ProjectDetector(workDir).detect();
    const scaffolder = new Scaffolder();
    const template = scaffolder.getTemplateForDetection(detection);
    const outputPath = join(workDir, 'CLAUDE.md');

    const previewed = scaffolder.preview({
      template,
      detection,
      outputPath,
    });
    const written = scaffolder.scaffold({
      template,
      detection,
      outputPath,
    });

    expect(template).toBe('library');
    expect(previewed.content).toBe(written.content);
    expect(readFileSync(outputPath, 'utf-8')).toBe(written.content);
  });
});
