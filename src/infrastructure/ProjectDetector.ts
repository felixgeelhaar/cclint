import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

/**
 * Partial package.json structure for detection
 */
interface PackageJson {
  name?: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
  bin?: string | Record<string, string>;
  main?: string;
  module?: string;
  exports?: unknown;
}

/**
 * Detected project programming language
 */
export type ProjectType =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'unknown';

/**
 * Detected project structure/architecture
 */
export type ProjectStructure =
  | 'monorepo'
  | 'library'
  | 'api'
  | 'cli'
  | 'web'
  | 'standard';

/**
 * Result of project detection analysis
 */
export interface DetectionResult {
  /** Primary programming language */
  type: ProjectType;
  /** Project structure type */
  structure: ProjectStructure;
  /** Confidence level 0-1 */
  confidence: number;
  /** Files that led to this detection */
  evidence: string[];
  /** Package manager used */
  packageManager: string | undefined;
  /** Testing framework detected */
  testFramework: string | undefined;
  /** CI system detected */
  ciSystem: string | undefined;
  /** Project name if detected */
  projectName: string | undefined;
  /** Project description if detected */
  projectDescription: string | undefined;
}

/**
 * Detects project type and structure by analyzing files in a directory.
 */
export class ProjectDetector {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  /**
   * Analyze the project and return detection results
   */
  detect(): DetectionResult {
    const evidence: string[] = [];
    let type: ProjectType = 'unknown';
    let structure: ProjectStructure = 'standard';
    let confidence = 0;
    let packageManager: string | undefined;
    let testFramework: string | undefined;
    let ciSystem: string | undefined;
    let projectName: string | undefined;
    let projectDescription: string | undefined;

    // Check for package.json (JavaScript/TypeScript)
    const packageJsonPath = join(this.rootDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      evidence.push('package.json');
      try {
        const pkg = JSON.parse(
          readFileSync(packageJsonPath, 'utf8')
        ) as PackageJson;
        projectName = pkg.name;
        projectDescription = pkg.description;

        // Detect package manager
        if (existsSync(join(this.rootDir, 'pnpm-lock.yaml'))) {
          packageManager = 'pnpm';
          evidence.push('pnpm-lock.yaml');
        } else if (existsSync(join(this.rootDir, 'yarn.lock'))) {
          packageManager = 'yarn';
          evidence.push('yarn.lock');
        } else if (existsSync(join(this.rootDir, 'bun.lockb'))) {
          packageManager = 'bun';
          evidence.push('bun.lockb');
        } else if (existsSync(join(this.rootDir, 'package-lock.json'))) {
          packageManager = 'npm';
          evidence.push('package-lock.json');
        }

        // Check for TypeScript
        if (
          existsSync(join(this.rootDir, 'tsconfig.json')) ||
          pkg.devDependencies?.['typescript'] ||
          pkg.dependencies?.['typescript']
        ) {
          type = 'typescript';
          confidence = 0.9;
          if (existsSync(join(this.rootDir, 'tsconfig.json'))) {
            evidence.push('tsconfig.json');
          }
        } else {
          type = 'javascript';
          confidence = 0.8;
        }

        // Detect test framework
        if (pkg.devDependencies?.['vitest'] || pkg.dependencies?.['vitest']) {
          testFramework = 'vitest';
        } else if (
          pkg.devDependencies?.['jest'] ||
          pkg.dependencies?.['jest']
        ) {
          testFramework = 'jest';
        } else if (
          pkg.devDependencies?.['mocha'] ||
          pkg.dependencies?.['mocha']
        ) {
          testFramework = 'mocha';
        }

        // Detect structure
        if (pkg.workspaces) {
          structure = 'monorepo';
          evidence.push('package.json workspaces');
        } else if (pkg.bin) {
          structure = 'cli';
        } else if (pkg.main || pkg.module || pkg.exports) {
          structure = 'library';
        }
      } catch {
        // Invalid JSON, still TypeScript/JavaScript project
        type = 'javascript';
        confidence = 0.5;
      }
    }

    // Check for pyproject.toml or setup.py (Python)
    if (existsSync(join(this.rootDir, 'pyproject.toml'))) {
      evidence.push('pyproject.toml');
      type = 'python';
      confidence = 0.9;
      packageManager = 'pip';

      try {
        const content = readFileSync(
          join(this.rootDir, 'pyproject.toml'),
          'utf8'
        );
        if (content.includes('[tool.poetry]')) {
          packageManager = 'poetry';
          evidence.push('poetry config');
        } else if (content.includes('[tool.pdm]')) {
          packageManager = 'pdm';
        } else if (content.includes('[tool.uv]')) {
          packageManager = 'uv';
        }

        // Extract name
        const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
        if (nameMatch) {
          projectName = nameMatch[1];
        }

        // Detect test framework
        if (content.includes('pytest')) {
          testFramework = 'pytest';
        }
      } catch {
        // Continue with default Python detection
      }
    } else if (existsSync(join(this.rootDir, 'setup.py'))) {
      evidence.push('setup.py');
      type = 'python';
      confidence = 0.8;
      packageManager = 'pip';
    } else if (existsSync(join(this.rootDir, 'requirements.txt'))) {
      evidence.push('requirements.txt');
      type = 'python';
      confidence = 0.7;
      packageManager = 'pip';
    }

    // Check for go.mod (Go)
    if (existsSync(join(this.rootDir, 'go.mod'))) {
      evidence.push('go.mod');
      type = 'go';
      confidence = 0.95;
      packageManager = 'go mod';

      try {
        const content = readFileSync(join(this.rootDir, 'go.mod'), 'utf8');
        const moduleMatch = content.match(/module\s+(\S+)/);
        if (moduleMatch?.[1]) {
          projectName = basename(moduleMatch[1]);
        }
      } catch {
        // Continue
      }

      // Go test is built-in
      testFramework = 'go test';
    }

    // Check for Cargo.toml (Rust)
    if (existsSync(join(this.rootDir, 'Cargo.toml'))) {
      evidence.push('Cargo.toml');
      type = 'rust';
      confidence = 0.95;
      packageManager = 'cargo';
      testFramework = 'cargo test';

      try {
        const content = readFileSync(join(this.rootDir, 'Cargo.toml'), 'utf8');
        const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
        if (nameMatch) {
          projectName = nameMatch[1];
        }
      } catch {
        // Continue
      }
    }

    // Check for pom.xml or build.gradle (Java)
    if (existsSync(join(this.rootDir, 'pom.xml'))) {
      evidence.push('pom.xml');
      type = 'java';
      confidence = 0.9;
      packageManager = 'maven';
      testFramework = 'junit';
    } else if (
      existsSync(join(this.rootDir, 'build.gradle')) ||
      existsSync(join(this.rootDir, 'build.gradle.kts'))
    ) {
      evidence.push('build.gradle');
      type = 'java';
      confidence = 0.9;
      packageManager = 'gradle';
      testFramework = 'junit';
    }

    // Check for monorepo patterns
    if (structure !== 'monorepo') {
      if (existsSync(join(this.rootDir, 'lerna.json'))) {
        structure = 'monorepo';
        evidence.push('lerna.json');
      } else if (existsSync(join(this.rootDir, 'nx.json'))) {
        structure = 'monorepo';
        evidence.push('nx.json');
      } else if (existsSync(join(this.rootDir, 'turbo.json'))) {
        structure = 'monorepo';
        evidence.push('turbo.json');
      } else if (existsSync(join(this.rootDir, 'pnpm-workspace.yaml'))) {
        structure = 'monorepo';
        evidence.push('pnpm-workspace.yaml');
      } else if (this.hasMultiplePackageJsons()) {
        structure = 'monorepo';
        evidence.push('multiple package.json files');
      }
    }

    // Detect CI system
    if (existsSync(join(this.rootDir, '.github', 'workflows'))) {
      ciSystem = 'github-actions';
      evidence.push('.github/workflows');
    } else if (existsSync(join(this.rootDir, '.gitlab-ci.yml'))) {
      ciSystem = 'gitlab-ci';
      evidence.push('.gitlab-ci.yml');
    } else if (existsSync(join(this.rootDir, 'bitbucket-pipelines.yml'))) {
      ciSystem = 'bitbucket-pipelines';
      evidence.push('bitbucket-pipelines.yml');
    } else if (existsSync(join(this.rootDir, '.circleci'))) {
      ciSystem = 'circleci';
      evidence.push('.circleci');
    }

    // Detect web project
    if (structure === 'standard') {
      if (
        existsSync(join(this.rootDir, 'next.config.js')) ||
        existsSync(join(this.rootDir, 'next.config.mjs')) ||
        existsSync(join(this.rootDir, 'next.config.ts'))
      ) {
        structure = 'web';
        evidence.push('Next.js config');
      } else if (
        existsSync(join(this.rootDir, 'vite.config.ts')) ||
        existsSync(join(this.rootDir, 'vite.config.js'))
      ) {
        structure = 'web';
        evidence.push('Vite config');
      } else if (existsSync(join(this.rootDir, 'angular.json'))) {
        structure = 'web';
        evidence.push('angular.json');
      } else if (existsSync(join(this.rootDir, 'vue.config.js'))) {
        structure = 'web';
        evidence.push('vue.config.js');
      }
    }

    // Detect API project
    if (structure === 'standard' && type !== 'unknown') {
      const hasOpenAPI =
        existsSync(join(this.rootDir, 'openapi.yaml')) ||
        existsSync(join(this.rootDir, 'openapi.json')) ||
        existsSync(join(this.rootDir, 'swagger.yaml')) ||
        existsSync(join(this.rootDir, 'swagger.json'));

      if (hasOpenAPI) {
        structure = 'api';
        evidence.push('OpenAPI/Swagger spec');
      }
    }

    return {
      type,
      structure,
      confidence,
      evidence,
      packageManager,
      testFramework,
      ciSystem,
      projectName,
      projectDescription,
    };
  }

  private hasMultiplePackageJsons(): boolean {
    try {
      const dirs = readdirSync(this.rootDir);
      let packageCount = 0;

      for (const dir of dirs) {
        const fullPath = join(this.rootDir, dir);
        if (statSync(fullPath).isDirectory()) {
          if (existsSync(join(fullPath, 'package.json'))) {
            packageCount++;
            if (packageCount >= 2) return true;
          }
        }
      }

      return false;
    } catch {
      return false;
    }
  }
}
