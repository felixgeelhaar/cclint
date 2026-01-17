import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  chmodSync,
  unlinkSync,
} from 'fs';
import { join } from 'path';

/**
 * Supported hook manager types
 */
export type HookManagerType = 'husky' | 'lefthook' | 'pre-commit' | 'git';

/**
 * Configuration for hook installation
 */
export interface HookConfig {
  /** Hook manager to use (auto-detect if not specified) */
  manager?: HookManagerType;
  /** Enable auto-fix in hook */
  fix?: boolean;
  /** Only lint staged files */
  staged?: boolean;
  /** File patterns to lint */
  patterns?: string[];
}

/**
 * Result of hook installation/uninstallation
 */
export interface HookInstallResult {
  /** Whether operation was successful */
  success: boolean;
  /** Hook manager used */
  manager: HookManagerType;
  /** Path to hook file */
  hookPath: string;
  /** Human-readable message */
  message: string;
}

/**
 * Hook script content marker
 */
const CCLINT_MARKER = '# cclint pre-commit hook';
const CCLINT_END_MARKER = '# end cclint';

/**
 * Manages Git pre-commit hooks for cclint.
 */
export class HookManager {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  /**
   * Detect which hook manager is being used in the project
   */
  detect(): HookManagerType | null {
    // Check for Husky
    if (existsSync(join(this.rootDir, '.husky'))) {
      return 'husky';
    }

    // Check for Lefthook
    if (
      existsSync(join(this.rootDir, 'lefthook.yml')) ||
      existsSync(join(this.rootDir, 'lefthook.yaml'))
    ) {
      return 'lefthook';
    }

    // Check for pre-commit
    if (existsSync(join(this.rootDir, '.pre-commit-config.yaml'))) {
      return 'pre-commit';
    }

    // Check for git hooks directory
    if (existsSync(join(this.rootDir, '.git', 'hooks'))) {
      return 'git';
    }

    return null;
  }

  /**
   * Install cclint pre-commit hook
   */
  install(config: HookConfig = {}): HookInstallResult {
    const manager = config.manager ?? this.detect();

    if (!manager) {
      return {
        success: false,
        manager: 'git',
        hookPath: '',
        message:
          'Could not detect hook manager. Make sure you have a .git directory or a hook manager configured.',
      };
    }

    switch (manager) {
      case 'husky':
        return this.installHusky(config);
      case 'lefthook':
        return this.installLefthook(config);
      case 'pre-commit':
        return this.installPreCommit(config);
      case 'git':
        return this.installGitHook(config);
      default: {
        const unknownManager = manager as string;
        return {
          success: false,
          manager: unknownManager as HookManagerType,
          hookPath: '',
          message: `Unsupported hook manager: ${unknownManager}`,
        };
      }
    }
  }

  /**
   * Uninstall cclint pre-commit hook
   */
  uninstall(): HookInstallResult {
    const manager = this.detect();

    if (!manager) {
      return {
        success: false,
        manager: 'git',
        hookPath: '',
        message: 'No hook manager detected.',
      };
    }

    switch (manager) {
      case 'husky':
        return this.uninstallHusky();
      case 'lefthook':
        return this.uninstallLefthook();
      case 'pre-commit':
        return this.uninstallPreCommit();
      case 'git':
        return this.uninstallGitHook();
      default: {
        const unknownManager = manager as string;
        return {
          success: false,
          manager: unknownManager as HookManagerType,
          hookPath: '',
          message: `Unsupported hook manager: ${unknownManager}`,
        };
      }
    }
  }

  /**
   * Check if cclint hook is installed
   */
  isInstalled(): boolean {
    const manager = this.detect();
    if (!manager) return false;

    switch (manager) {
      case 'husky': {
        const hookPath = join(this.rootDir, '.husky', 'pre-commit');
        return (
          existsSync(hookPath) &&
          readFileSync(hookPath, 'utf8').includes(CCLINT_MARKER)
        );
      }
      case 'lefthook': {
        const lefthookPath =
          join(this.rootDir, 'lefthook.yml') ||
          join(this.rootDir, 'lefthook.yaml');
        return (
          existsSync(lefthookPath) &&
          readFileSync(lefthookPath, 'utf8').includes('cclint')
        );
      }
      case 'pre-commit': {
        const preCommitPath = join(this.rootDir, '.pre-commit-config.yaml');
        return (
          existsSync(preCommitPath) &&
          readFileSync(preCommitPath, 'utf8').includes('cclint')
        );
      }
      case 'git': {
        const hookPath = join(this.rootDir, '.git', 'hooks', 'pre-commit');
        return (
          existsSync(hookPath) &&
          readFileSync(hookPath, 'utf8').includes(CCLINT_MARKER)
        );
      }
      default:
        return false;
    }
  }

  private buildCommand(config: HookConfig): string {
    const patterns = config.patterns ?? ['CLAUDE.md'];
    const patternsStr = patterns.join(' ');
    const fixFlag = config.fix ? ' --fix' : '';

    if (config.staged) {
      // Use git to get staged CLAUDE.md files
      return `git diff --cached --name-only --diff-filter=ACM | grep -E 'CLAUDE\\.md$' | xargs -r npx cclint lint${fixFlag}`;
    }

    return `npx cclint lint ${patternsStr}${fixFlag}`;
  }

  private installHusky(config: HookConfig): HookInstallResult {
    const huskyDir = join(this.rootDir, '.husky');
    const hookPath = join(huskyDir, 'pre-commit');

    // Ensure .husky directory exists
    if (!existsSync(huskyDir)) {
      mkdirSync(huskyDir, { recursive: true });
    }

    const command = this.buildCommand(config);
    const hookContent = existsSync(hookPath)
      ? readFileSync(hookPath, 'utf8')
      : '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\n';

    // Check if already installed
    if (hookContent.includes(CCLINT_MARKER)) {
      return {
        success: true,
        manager: 'husky',
        hookPath,
        message: 'cclint hook already installed in Husky.',
      };
    }

    // Add cclint hook
    const newContent = `${hookContent.trimEnd()}\n\n${CCLINT_MARKER}\n${command}\n${CCLINT_END_MARKER}\n`;
    writeFileSync(hookPath, newContent, 'utf8');
    chmodSync(hookPath, 0o755);

    return {
      success: true,
      manager: 'husky',
      hookPath,
      message: 'Successfully installed cclint hook in Husky.',
    };
  }

  private installLefthook(config: HookConfig): HookInstallResult {
    const lefthookPath = existsSync(join(this.rootDir, 'lefthook.yml'))
      ? join(this.rootDir, 'lefthook.yml')
      : join(this.rootDir, 'lefthook.yaml');

    if (!existsSync(lefthookPath)) {
      return {
        success: false,
        manager: 'lefthook',
        hookPath: lefthookPath,
        message: 'lefthook.yml not found. Please initialize Lefthook first.',
      };
    }

    const content = readFileSync(lefthookPath, 'utf8');

    // Check if already installed
    if (content.includes('cclint')) {
      return {
        success: true,
        manager: 'lefthook',
        hookPath: lefthookPath,
        message: 'cclint hook already configured in Lefthook.',
      };
    }

    const command = this.buildCommand(config);
    const hookConfig = `
  cclint:
    glob: "**/CLAUDE.md"
    run: ${command}
`;

    // Add to pre-commit section or create it
    let newContent: string;
    if (content.includes('pre-commit:')) {
      // Add under existing pre-commit section
      newContent = content.replace(
        /(pre-commit:\s*\n\s*commands:)/,
        `$1${hookConfig}`
      );
    } else {
      // Create pre-commit section
      newContent = `${content.trimEnd()}\n\npre-commit:\n  commands:${hookConfig}`;
    }

    writeFileSync(lefthookPath, newContent, 'utf8');

    return {
      success: true,
      manager: 'lefthook',
      hookPath: lefthookPath,
      message:
        'Successfully added cclint hook to Lefthook. Run `lefthook install` to activate.',
    };
  }

  private installPreCommit(config: HookConfig): HookInstallResult {
    const preCommitPath = join(this.rootDir, '.pre-commit-config.yaml');

    if (!existsSync(preCommitPath)) {
      return {
        success: false,
        manager: 'pre-commit',
        hookPath: preCommitPath,
        message:
          '.pre-commit-config.yaml not found. Please initialize pre-commit first.',
      };
    }

    const content = readFileSync(preCommitPath, 'utf8');

    // Check if already installed
    if (content.includes('cclint')) {
      return {
        success: true,
        manager: 'pre-commit',
        hookPath: preCommitPath,
        message: 'cclint hook already configured in pre-commit.',
      };
    }

    const fixFlag = config.fix ? ' --fix' : '';
    const hookConfig = `
  - repo: local
    hooks:
      - id: cclint
        name: cclint
        entry: npx cclint lint${fixFlag}
        language: system
        files: CLAUDE\\.md$
        pass_filenames: true
`;

    const newContent = `${content.trimEnd()}\n${hookConfig}`;
    writeFileSync(preCommitPath, newContent, 'utf8');

    return {
      success: true,
      manager: 'pre-commit',
      hookPath: preCommitPath,
      message:
        'Successfully added cclint hook to pre-commit. Run `pre-commit install` to activate.',
    };
  }

  private installGitHook(config: HookConfig): HookInstallResult {
    const hooksDir = join(this.rootDir, '.git', 'hooks');
    const hookPath = join(hooksDir, 'pre-commit');

    if (!existsSync(join(this.rootDir, '.git'))) {
      return {
        success: false,
        manager: 'git',
        hookPath,
        message: 'Not a git repository. Run `git init` first.',
      };
    }

    // Ensure hooks directory exists
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }

    const command = this.buildCommand(config);
    const hookContent = existsSync(hookPath)
      ? readFileSync(hookPath, 'utf8')
      : '#!/usr/bin/env sh\n\n';

    // Check if already installed
    if (hookContent.includes(CCLINT_MARKER)) {
      return {
        success: true,
        manager: 'git',
        hookPath,
        message: 'cclint hook already installed.',
      };
    }

    // Add cclint hook
    const newContent = `${hookContent.trimEnd()}\n\n${CCLINT_MARKER}\n${command}\n${CCLINT_END_MARKER}\n`;
    writeFileSync(hookPath, newContent, 'utf8');
    chmodSync(hookPath, 0o755);

    return {
      success: true,
      manager: 'git',
      hookPath,
      message: 'Successfully installed cclint pre-commit hook.',
    };
  }

  private uninstallHusky(): HookInstallResult {
    const hookPath = join(this.rootDir, '.husky', 'pre-commit');

    if (!existsSync(hookPath)) {
      return {
        success: true,
        manager: 'husky',
        hookPath,
        message: 'No pre-commit hook found.',
      };
    }

    const content = readFileSync(hookPath, 'utf8');

    if (!content.includes(CCLINT_MARKER)) {
      return {
        success: true,
        manager: 'husky',
        hookPath,
        message: 'cclint hook not found in Husky.',
      };
    }

    // Remove cclint section
    const newContent =
      content
        .replace(
          new RegExp(
            `\n*${CCLINT_MARKER}[\\s\\S]*?${CCLINT_END_MARKER}\n*`,
            'g'
          ),
          '\n'
        )
        .trimEnd() + '\n';

    writeFileSync(hookPath, newContent, 'utf8');

    return {
      success: true,
      manager: 'husky',
      hookPath,
      message: 'Successfully removed cclint hook from Husky.',
    };
  }

  private uninstallLefthook(): HookInstallResult {
    const lefthookPath = existsSync(join(this.rootDir, 'lefthook.yml'))
      ? join(this.rootDir, 'lefthook.yml')
      : join(this.rootDir, 'lefthook.yaml');

    if (!existsSync(lefthookPath)) {
      return {
        success: true,
        manager: 'lefthook',
        hookPath: lefthookPath,
        message: 'lefthook.yml not found.',
      };
    }

    const content = readFileSync(lefthookPath, 'utf8');

    if (!content.includes('cclint')) {
      return {
        success: true,
        manager: 'lefthook',
        hookPath: lefthookPath,
        message: 'cclint hook not found in Lefthook.',
      };
    }

    // Remove cclint command section (basic removal)
    const newContent =
      content
        .replace(/\s*cclint:\s*\n\s*glob:[^\n]*\n\s*run:[^\n]*\n?/g, '')
        .trimEnd() + '\n';

    writeFileSync(lefthookPath, newContent, 'utf8');

    return {
      success: true,
      manager: 'lefthook',
      hookPath: lefthookPath,
      message: 'Successfully removed cclint hook from Lefthook.',
    };
  }

  private uninstallPreCommit(): HookInstallResult {
    const preCommitPath = join(this.rootDir, '.pre-commit-config.yaml');

    if (!existsSync(preCommitPath)) {
      return {
        success: true,
        manager: 'pre-commit',
        hookPath: preCommitPath,
        message: '.pre-commit-config.yaml not found.',
      };
    }

    const content = readFileSync(preCommitPath, 'utf8');

    if (!content.includes('cclint')) {
      return {
        success: true,
        manager: 'pre-commit',
        hookPath: preCommitPath,
        message: 'cclint hook not found in pre-commit.',
      };
    }

    // Remove cclint repo section (basic removal)
    const newContent =
      content
        .replace(
          /\s*-\s*repo:\s*local\s*\n\s*hooks:\s*\n\s*-\s*id:\s*cclint[\s\S]*?(?=\n\s*-\s*repo:|\n*$)/g,
          ''
        )
        .trimEnd() + '\n';

    writeFileSync(preCommitPath, newContent, 'utf8');

    return {
      success: true,
      manager: 'pre-commit',
      hookPath: preCommitPath,
      message: 'Successfully removed cclint hook from pre-commit.',
    };
  }

  private uninstallGitHook(): HookInstallResult {
    const hookPath = join(this.rootDir, '.git', 'hooks', 'pre-commit');

    if (!existsSync(hookPath)) {
      return {
        success: true,
        manager: 'git',
        hookPath,
        message: 'No pre-commit hook found.',
      };
    }

    const content = readFileSync(hookPath, 'utf8');

    if (!content.includes(CCLINT_MARKER)) {
      return {
        success: true,
        manager: 'git',
        hookPath,
        message: 'cclint hook not found.',
      };
    }

    // Remove cclint section
    const newContent =
      content
        .replace(
          new RegExp(
            `\n*${CCLINT_MARKER}[\\s\\S]*?${CCLINT_END_MARKER}\n*`,
            'g'
          ),
          '\n'
        )
        .trimEnd() + '\n';

    // If only shebang remains, remove the file
    if (newContent.trim() === '#!/usr/bin/env sh') {
      unlinkSync(hookPath);
      return {
        success: true,
        manager: 'git',
        hookPath,
        message: 'Successfully removed cclint pre-commit hook.',
      };
    }

    writeFileSync(hookPath, newContent, 'utf8');

    return {
      success: true,
      manager: 'git',
      hookPath,
      message: 'Successfully removed cclint hook from pre-commit.',
    };
  }
}
