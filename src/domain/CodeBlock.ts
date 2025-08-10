import { Location } from './Location.js';

/**
 * Represents a code block found within a CLAUDE.md file
 */
export class CodeBlock {
  public readonly language: string;
  public readonly content: string;
  public readonly location: Location;
  public readonly context: string;
  public readonly isComplete: boolean;
  public readonly hasImports: boolean;
  public readonly metadata: CodeBlockMetadata;

  constructor(
    language: string,
    content: string,
    location: Location,
    context: string = '',
    metadata?: Partial<CodeBlockMetadata>
  ) {
    this.language = this.normalizeLanguage(language);
    this.content = content;
    this.location = location;
    this.context = context;
    this.isComplete = this.checkCompleteness();
    this.hasImports = this.checkImports();
    this.metadata = {
      indentLevel: metadata?.indentLevel ?? 0,
      isExample: metadata?.isExample ?? true,
      isAntiPattern: metadata?.isAntiPattern ?? false,
      description: metadata?.description ?? '',
      ...metadata,
    };
  }

  /**
   * Get the lines of code as an array
   */
  public getLines(): string[] {
    return this.content.split('\n');
  }

  /**
   * Get the number of lines in the code block
   */
  public getLineCount(): number {
    return this.getLines().length;
  }

  /**
   * Check if this code block appears to be complete and runnable
   */
  private checkCompleteness(): boolean {
    const lines = this.getLines();
    
    // Empty blocks are not complete
    if (lines.length === 0 || this.content.trim() === '') {
      return false;
    }

    // Check for common incomplete patterns
    const incompletePatterns = [
      /^\s*\.\.\.\s*$/,           // Just ellipsis
      /\/\/\s*\.\.\.\s*$/,        // Comment with ellipsis
      /#\s*\.\.\.\s*$/,           // Python comment with ellipsis
      /^\s*\/\/\s*TODO/i,         // TODO comment
      /^\s*#\s*TODO/i,            // Python TODO
      /^\s*\/\/\s*more code here/i, // Placeholder comment
    ];

    for (const line of lines) {
      for (const pattern of incompletePatterns) {
        if (pattern.test(line)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if the code block contains import statements
   */
  private checkImports(): boolean {
    const importPatterns = [
      /^import\s+/m,              // ES6 imports
      /^from\s+\S+\s+import\s+/m, // Python imports
      /^import\s+\(/m,            // Go imports
      /^require\s*\(/m,           // CommonJS
      /^using\s+/m,               // C#
      /^#include\s+/m,            // C/C++
      /^use\s+/m,                 // Rust/PHP
    ];

    for (const pattern of importPatterns) {
      if (pattern.test(this.content)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Normalize language identifiers to standard names
   */
  private normalizeLanguage(language: string): string {
    const normalized = language.toLowerCase().trim();
    
    // Map common aliases to standard names
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescriptreact',
      'jsx': 'javascriptreact',
      'py': 'python',
      'rb': 'ruby',
      'yml': 'yaml',
      'shell': 'bash',
      'sh': 'bash',
      'zsh': 'bash',
      'golang': 'go',
      'c++': 'cpp',
      'c#': 'csharp',
      'objective-c': 'objc',
      'f#': 'fsharp',
    };

    return languageMap[normalized] || normalized;
  }

  /**
   * Get a display name for the language
   */
  public getLanguageDisplayName(): string {
    const displayNames: Record<string, string> = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'typescriptreact': 'TypeScript (TSX)',
      'javascriptreact': 'JavaScript (JSX)',
      'python': 'Python',
      'go': 'Go',
      'rust': 'Rust',
      'java': 'Java',
      'csharp': 'C#',
      'cpp': 'C++',
      'ruby': 'Ruby',
      'php': 'PHP',
      'swift': 'Swift',
      'kotlin': 'Kotlin',
      'scala': 'Scala',
      'bash': 'Bash',
      'sql': 'SQL',
      'yaml': 'YAML',
      'json': 'JSON',
      'html': 'HTML',
      'css': 'CSS',
      'markdown': 'Markdown',
    };

    return displayNames[this.language] || this.language;
  }

  /**
   * Check if this is a supported programming language
   */
  public isSupportedLanguage(): boolean {
    const supportedLanguages = new Set([
      'javascript',
      'typescript',
      'typescriptreact',
      'javascriptreact',
      'python',
      'go',
      'rust',
      'java',
      'csharp',
      'cpp',
      'c',
      'ruby',
      'php',
      'swift',
      'kotlin',
      'scala',
      'bash',
      'sql',
      'yaml',
      'json',
    ]);

    return supportedLanguages.has(this.language);
  }

  /**
   * Get file extension for this language
   */
  public getFileExtension(): string {
    const extensions: Record<string, string> = {
      'javascript': '.js',
      'typescript': '.ts',
      'typescriptreact': '.tsx',
      'javascriptreact': '.jsx',
      'python': '.py',
      'go': '.go',
      'rust': '.rs',
      'java': '.java',
      'csharp': '.cs',
      'cpp': '.cpp',
      'c': '.c',
      'ruby': '.rb',
      'php': '.php',
      'swift': '.swift',
      'kotlin': '.kt',
      'scala': '.scala',
      'bash': '.sh',
      'sql': '.sql',
      'yaml': '.yaml',
      'json': '.json',
      'html': '.html',
      'css': '.css',
      'markdown': '.md',
    };

    return extensions[this.language] || `.${this.language}`;
  }
}

/**
 * Metadata about a code block
 */
export interface CodeBlockMetadata {
  /** Indentation level in the markdown file */
  indentLevel: number;
  /** Whether this is intended as an example */
  isExample: boolean;
  /** Whether this demonstrates an anti-pattern */
  isAntiPattern: boolean;
  /** Description or title of the code block */
  description: string;
  /** Any additional attributes from the markdown */
  attributes?: Record<string, unknown>;
}