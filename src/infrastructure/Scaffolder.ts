import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { DetectionResult } from './ProjectDetector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Available template names
 */
export type TemplateName =
  | 'minimal'
  | 'typescript'
  | 'python'
  | 'go'
  | 'monorepo'
  | 'library'
  | 'api';

/**
 * Options for scaffolding a CLAUDE.md file
 */
export interface ScaffoldOptions {
  /** Template to use */
  template: TemplateName;
  /** Project name (used in template) */
  projectName?: string;
  /** Project description */
  projectDescription?: string;
  /** Overwrite existing file */
  overwrite?: boolean;
  /** Output file path */
  outputPath?: string;
  /** Detection result for smart defaults */
  detection?: DetectionResult | undefined;
}

/**
 * Result of scaffolding operation
 */
export interface ScaffoldResult {
  /** Path where file was written */
  path: string;
  /** Content that was written */
  content: string;
  /** Whether an existing file was overwritten */
  wasOverwritten: boolean;
}

/**
 * Template variable values
 */
interface TemplateVariables {
  projectName: string;
  projectDescription: string;
  packageManager: string;
  testFramework: string;
  installCommand: string;
  testCommand: string;
  buildCommand: string;
  devCommand: string;
  lintCommand: string;
  typecheckCommand: string;
  formatCommand: string;
  language: string;
  modulePath: string;
  registry: string;
  packageInstallCommand: string;
  publishCommand: string;
  license: string;
  docsCommand: string;
  apiType: string;
  framework: string;
  database: string;
  authMethod: string;
  resource: string;
  startCommand: string;
  testCoverageCommand: string;
  testFileCommand: string;
  migrationCreateCommand: string;
  migrationRunCommand: string;
  migrationRollbackCommand: string;
  seedCommand: string;
  workspaceConfig: string;
  runPackageCommand: string;
}

/**
 * Scaffolds CLAUDE.md files from templates with variable substitution.
 */
export class Scaffolder {
  private templatesDir: string;

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir ?? join(__dirname, '..', 'templates');
  }

  /**
   * List all available template names
   */
  listTemplates(): TemplateName[] {
    return [
      'minimal',
      'typescript',
      'python',
      'go',
      'monorepo',
      'library',
      'api',
    ];
  }

  /**
   * Scaffold a CLAUDE.md file from a template
   */
  scaffold(options: ScaffoldOptions): ScaffoldResult {
    const outputPath = options.outputPath ?? 'CLAUDE.md';
    const wasOverwritten = existsSync(outputPath);

    if (wasOverwritten && !options.overwrite) {
      throw new Error(
        `File already exists: ${outputPath}. Use --force to overwrite.`
      );
    }

    const templateContent = this.loadTemplate(options.template);
    const variables = this.buildVariables(options);
    const content = this.renderTemplate(templateContent, variables);

    writeFileSync(outputPath, content, 'utf8');

    return {
      path: outputPath,
      content,
      wasOverwritten,
    };
  }

  /**
   * Render a template string with variable substitution
   */
  renderTemplate(
    template: string,
    variables: Partial<TemplateVariables>
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined) {
        const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        result = result.replace(pattern, value);
      }
    }

    // Remove any unreplaced placeholders
    result = result.replace(/\{\{[a-zA-Z]+\}\}/g, '');

    return result;
  }

  /**
   * Get the best template for a detection result
   */
  getTemplateForDetection(detection: DetectionResult): TemplateName {
    // Check structure first
    if (detection.structure === 'monorepo') {
      return 'monorepo';
    }
    if (detection.structure === 'library') {
      return 'library';
    }
    if (detection.structure === 'api') {
      return 'api';
    }

    // Fall back to language
    switch (detection.type) {
      case 'typescript':
        return 'typescript';
      case 'javascript':
        return 'typescript'; // Use TypeScript template for JS too
      case 'python':
        return 'python';
      case 'go':
        return 'go';
      default:
        return 'minimal';
    }
  }

  private loadTemplate(name: TemplateName): string {
    const templatePath = join(this.templatesDir, `${name}.md`);

    if (!existsSync(templatePath)) {
      throw new Error(`Template not found: ${name}`);
    }

    return readFileSync(templatePath, 'utf8');
  }

  private buildVariables(options: ScaffoldOptions): Partial<TemplateVariables> {
    const detection = options.detection;
    const pm = detection?.packageManager ?? 'npm';

    // Default values
    const defaults: Partial<TemplateVariables> = {
      projectName:
        options.projectName ?? detection?.projectName ?? 'my-project',
      projectDescription:
        options.projectDescription ??
        detection?.projectDescription ??
        'A brief description of the project.',
      packageManager: pm,
      testFramework: detection?.testFramework ?? 'jest',
      language: detection?.type ?? 'typescript',
      registry: 'npm',
      license: 'MIT',
      apiType: 'REST',
      framework: 'Express',
      database: 'PostgreSQL',
      authMethod: 'JWT',
      resource: 'items',
      workspaceConfig: pm === 'pnpm' ? 'pnpm-workspace.yaml' : 'package.json',
    };

    // Build commands based on package manager and language
    const type = detection?.type ?? 'typescript';

    if (type === 'typescript' || type === 'javascript') {
      defaults.installCommand = this.getInstallCommand(pm);
      defaults.devCommand = `${pm === 'npm' ? 'npm run' : pm} dev`;
      defaults.testCommand = `${pm === 'npm' ? 'npm' : pm} test`;
      defaults.buildCommand = `${pm === 'npm' ? 'npm run' : pm} build`;
      defaults.lintCommand = `${pm === 'npm' ? 'npm run' : pm} lint`;
      defaults.typecheckCommand = `${pm === 'npm' ? 'npm run' : pm} typecheck`;
      defaults.formatCommand = `${pm === 'npm' ? 'npm run' : pm} format`;
      defaults.docsCommand = `${pm === 'npm' ? 'npm run' : pm} docs`;
      defaults.packageInstallCommand = `npm install ${defaults.projectName}`;
      defaults.publishCommand = 'npm publish';
      defaults.testCoverageCommand = `${pm === 'npm' ? 'npm run' : pm} test:coverage`;
      defaults.testFileCommand = `${pm === 'npm' ? 'npm' : pm} test -- path/to/test.ts`;
      defaults.startCommand = `${pm === 'npm' ? 'npm' : pm} start`;
      defaults.runPackageCommand = `${pm === 'npm' ? 'npm run' : pm} --filter @${defaults.projectName}/api dev`;
    } else if (type === 'python') {
      // pipCmd would be: pm === 'poetry' ? 'poetry' : pm === 'pdm' ? 'pdm' : 'pip'
      defaults.installCommand =
        pm === 'poetry'
          ? 'poetry install'
          : pm === 'pdm'
            ? 'pdm install'
            : 'pip install -e ".[dev]"';
      defaults.testCommand =
        detection?.testFramework === 'pytest' ? 'pytest' : 'python -m pytest';
      defaults.lintCommand = 'ruff check .';
      defaults.formatCommand = 'black .';
      defaults.buildCommand =
        pm === 'poetry' ? 'poetry build' : 'python -m build';
      defaults.packageInstallCommand = `pip install ${defaults.projectName}`;
      defaults.publishCommand =
        pm === 'poetry' ? 'poetry publish' : 'twine upload dist/*';
      defaults.registry = 'PyPI';
    } else if (type === 'go') {
      defaults.installCommand = 'go mod download';
      defaults.testCommand = 'go test ./...';
      defaults.buildCommand = `go build -o ${defaults.projectName}`;
      defaults.lintCommand = 'golangci-lint run';
      defaults.modulePath = `github.com/user/${defaults.projectName}`;
    }

    // Migration commands for API
    defaults.migrationCreateCommand = 'npm run migration:create';
    defaults.migrationRunCommand = 'npm run migration:run';
    defaults.migrationRollbackCommand = 'npm run migration:rollback';
    defaults.seedCommand = 'npm run seed';

    return defaults;
  }

  private getInstallCommand(pm: string): string {
    switch (pm) {
      case 'pnpm':
        return 'pnpm install';
      case 'yarn':
        return 'yarn';
      case 'bun':
        return 'bun install';
      default:
        return 'npm install';
    }
  }
}
