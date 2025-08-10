import { readFile } from 'fs/promises';
import { ContextFile } from '../domain/ContextFile.js';
import { PathValidator } from './security/PathValidator.js';

export class FileReader {
  private pathValidator: PathValidator;

  constructor() {
    // Initialize with allowed extensions for CLAUDE.md files
    this.pathValidator = new PathValidator(['.md', '.MD', '.markdown']);
  }

  public async readContextFile(
    filePath: string,
    basePath?: string
  ): Promise<ContextFile> {
    try {
      // Validate the path for security
      const safePath = this.pathValidator.validatePath(filePath, basePath);

      // Check if file exists and is actually a file
      if (!this.pathValidator.isValidFile(safePath)) {
        throw new Error(`Path does not exist or is not a file: ${safePath}`);
      }

      // Check if file has allowed extension
      if (!this.pathValidator.hasAllowedExtension(safePath)) {
        throw new Error(
          `File type not allowed. Only Markdown files (.md, .MD, .markdown) are supported`
        );
      }

      // Read the file content
      const content = await readFile(safePath, 'utf-8');

      // Check for suspicious content patterns
      this.validateFileContent(content, safePath);

      return new ContextFile(safePath, content);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to read file ${filePath}: ${error.message}`);
      }
      throw new Error(`Failed to read file ${filePath}: Unknown error`);
    }
  }

  /**
   * Validate file content for potential security issues
   * @param content The file content to validate
   * @param filePath The file path for error messages
   */
  private validateFileContent(content: string, filePath: string): void {
    // Check file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (content.length > maxSize) {
      throw new Error(`File ${filePath} exceeds maximum size of 10MB`);
    }

    // Check for null bytes
    if (content.includes('\x00')) {
      throw new Error(`File ${filePath} contains null bytes`);
    }

    // Check for excessive line length (potential ReDoS attack)
    const lines = content.split('\n');
    const maxLineLength = 10000;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.length > maxLineLength) {
        throw new Error(
          `File ${filePath} has line ${i + 1} exceeding ${maxLineLength} characters`
        );
      }
    }
  }
}
