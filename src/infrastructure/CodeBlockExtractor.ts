import { ContextFile } from '../domain/ContextFile.js';
import { CodeBlock } from '../domain/CodeBlock.js';
import { Location } from '../domain/Location.js';

/**
 * Extracts code blocks from markdown files
 */
export class CodeBlockExtractor {
  /**
   * Extract all code blocks from a ContextFile
   * @param file The file to extract code blocks from
   * @returns Array of CodeBlock instances
   */
  public extractCodeBlocks(file: ContextFile): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];
    const lines = file.lines;

    let inCodeBlock = false;
    let currentLanguage = '';
    let currentContent: string[] = [];
    let codeBlockStartLine = 0;
    let indentLevel = 0;
    let context = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNumber = i + 1;

      // Check for code block start
      const codeBlockStart = this.parseCodeBlockStart(line);
      if (codeBlockStart && !inCodeBlock) {
        inCodeBlock = true;
        currentLanguage = codeBlockStart.language;
        codeBlockStartLine = lineNumber;
        indentLevel = codeBlockStart.indentLevel;
        currentContent = [];

        // Get context from previous lines
        context = this.getContext(lines, i);
        continue;
      }

      // Check for code block end
      if (inCodeBlock && this.isCodeBlockEnd(line, indentLevel)) {
        // Create the code block
        const location = new Location(codeBlockStartLine, 1);

        const codeBlock = new CodeBlock(
          currentLanguage,
          currentContent.join('\n'),
          location,
          context,
          {
            indentLevel,
            isExample: !context.toLowerCase().includes('anti-pattern'),
            isAntiPattern:
              context.toLowerCase().includes('anti-pattern') ||
              context.toLowerCase().includes('bad') ||
              context.toLowerCase().includes('wrong'),
            description: this.extractDescription(context),
          }
        );

        codeBlocks.push(codeBlock);

        // Reset state
        inCodeBlock = false;
        currentLanguage = '';
        currentContent = [];
        context = '';
        continue;
      }

      // Collect code block content
      if (inCodeBlock) {
        currentContent.push(line);
      }
    }

    // Handle unclosed code block
    if (inCodeBlock && currentContent.length > 0) {
      const location = new Location(codeBlockStartLine, 1);

      const codeBlock = new CodeBlock(
        currentLanguage,
        currentContent.join('\n'),
        location,
        context,
        {
          indentLevel,
          isExample: true,
          isAntiPattern: false,
          description: this.extractDescription(context),
        }
      );

      codeBlocks.push(codeBlock);
    }

    return codeBlocks;
  }

  /**
   * Parse the start of a code block
   * @param line The line to parse
   * @returns Language and indent information if this is a code block start
   */
  private parseCodeBlockStart(
    line: string
  ): { language: string; indentLevel: number } | null {
    // Match ``` or ~~~ with optional language identifier
    const match = line.match(/^(\s*)(```|~~~)\s*(\w+)?/);

    if (!match) {
      return null;
    }

    const indent = match[1] || '';
    const language = match[3] || '';

    return {
      language: language || 'text',
      indentLevel: indent.length,
    };
  }

  /**
   * Check if a line ends a code block
   * @param line The line to check
   * @param expectedIndent The expected indentation level
   * @returns True if this ends a code block
   */
  private isCodeBlockEnd(line: string, expectedIndent: number): boolean {
    const match = line.match(/^(\s*)(```|~~~)\s*$/);

    if (!match) {
      return false;
    }

    const indent = match[1] || '';
    // Allow some flexibility in indentation
    return Math.abs(indent.length - expectedIndent) <= 2;
  }

  /**
   * Get context for a code block from surrounding text
   * @param lines All lines in the file
   * @param codeBlockIndex Index where the code block starts
   * @returns Context string
   */
  private getContext(lines: string[], codeBlockIndex: number): string {
    const contextLines: string[] = [];
    const maxContextLines = 5;

    // Look backwards for context
    for (
      let i = codeBlockIndex - 1;
      i >= 0 && contextLines.length < maxContextLines;
      i--
    ) {
      const line = lines[i]!.trim();

      // Skip empty lines
      if (line === '') {
        continue;
      }

      // Stop at headers or other code blocks
      if (
        line.startsWith('#') ||
        line.startsWith('```') ||
        line.startsWith('~~~')
      ) {
        if (line.startsWith('#')) {
          contextLines.unshift(line);
        }
        break;
      }

      contextLines.unshift(line);
    }

    return contextLines.join(' ');
  }

  /**
   * Extract a description from context
   * @param context The context string
   * @returns A clean description
   */
  private extractDescription(context: string): string {
    // Remove markdown formatting
    let description = context
      .replace(/^#+\s+/, '') // Remove headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/`(.*?)`/g, '$1') // Remove inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
      .trim();

    // Limit length
    if (description.length > 100) {
      description = description.substring(0, 97) + '...';
    }

    return description;
  }

  /**
   * Extract code blocks of a specific language
   * @param file The file to extract from
   * @param language The language to filter by
   * @returns Array of CodeBlock instances for the specified language
   */
  public extractCodeBlocksByLanguage(
    file: ContextFile,
    language: string
  ): CodeBlock[] {
    const allBlocks = this.extractCodeBlocks(file);
    const normalizedLanguage = this.normalizeLanguage(language);

    return allBlocks.filter(
      block => this.normalizeLanguage(block.language) === normalizedLanguage
    );
  }

  /**
   * Normalize language identifier
   * @param language The language string to normalize
   * @returns Normalized language identifier
   */
  private normalizeLanguage(language: string): string {
    const normalized = language.toLowerCase().trim();

    const languageMap: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      tsx: 'typescriptreact',
      jsx: 'javascriptreact',
      py: 'python',
      rb: 'ruby',
      yml: 'yaml',
      shell: 'bash',
      sh: 'bash',
    };

    return languageMap[normalized] || normalized;
  }

  /**
   * Get statistics about code blocks in a file
   * @param file The file to analyze
   * @returns Statistics object
   */
  public getCodeBlockStats(file: ContextFile): CodeBlockStats {
    const blocks = this.extractCodeBlocks(file);
    const languageCounts = new Map<string, number>();
    let totalLines = 0;
    let completeBlocks = 0;
    let blocksWithImports = 0;

    for (const block of blocks) {
      const lang = block.language;
      languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
      totalLines += block.getLineCount();

      if (block.isComplete) {
        completeBlocks++;
      }

      if (block.hasImports) {
        blocksWithImports++;
      }
    }

    return {
      totalBlocks: blocks.length,
      totalLines,
      completeBlocks,
      blocksWithImports,
      languageCounts: Object.fromEntries(languageCounts),
      averageLinesPerBlock: blocks.length > 0 ? totalLines / blocks.length : 0,
    };
  }
}

/**
 * Statistics about code blocks in a file
 */
export interface CodeBlockStats {
  totalBlocks: number;
  totalLines: number;
  completeBlocks: number;
  blocksWithImports: number;
  languageCounts: Record<string, number>;
  averageLinesPerBlock: number;
}
