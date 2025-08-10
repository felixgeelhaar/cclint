import { resolve, normalize, isAbsolute } from 'path';
import { existsSync, statSync } from 'fs';

/**
 * Security utility for validating file paths to prevent directory traversal attacks
 */
export class PathValidator {
  private readonly allowedExtensions: Set<string>;
  private readonly maxPathLength: number;
  private readonly forbiddenPatterns: RegExp[];

  constructor(
    allowedExtensions: string[] = ['.md', '.MD'],
    maxPathLength: number = 4096
  ) {
    this.allowedExtensions = new Set(allowedExtensions);
    this.maxPathLength = maxPathLength;

    // Patterns that could indicate directory traversal or malicious paths
    this.forbiddenPatterns = [
      /\.\.[\\/]/u, // Directory traversal - using backslash to escape forward slash
      /^[\\/]\.\..+/u, // Starting with hidden directories
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u001f\u007f]/u, // Control characters
      /%2e%2e[\\/]/iu, // URL encoded traversal
      /\.(git|ssh|env|npmrc|bashrc)/iu, // Sensitive files
    ];
  }

  /**
   * Validate a file path for security issues
   * @param filePath The path to validate
   * @param basePath Optional base path to restrict access within
   * @returns Normalized, safe path
   * @throws Error if path is invalid or unsafe
   */
  public validatePath(filePath: string, basePath?: string): string {
    // Check path length
    if (filePath.length > this.maxPathLength) {
      throw new Error(
        `Path exceeds maximum length of ${this.maxPathLength} characters`
      );
    }

    // Check for null bytes and control characters
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/u.test(filePath)) {
      throw new Error('Path contains invalid control characters');
    }

    // Check for forbidden patterns
    for (const pattern of this.forbiddenPatterns) {
      if (pattern.test(filePath)) {
        throw new Error(`Path contains forbidden pattern: ${pattern}`);
      }
    }

    // Normalize the path to remove redundant segments
    const normalizedPath = normalize(filePath);

    // If a base path is provided, ensure the file is within it
    if (basePath) {
      const resolvedBase = resolve(basePath);
      const resolvedPath = resolve(basePath, normalizedPath);

      // Ensure the resolved path is within the base directory
      if (!resolvedPath.startsWith(resolvedBase)) {
        throw new Error(
          'Path traversal detected: file is outside allowed directory'
        );
      }

      return resolvedPath;
    }

    // For absolute paths without a base path, just return normalized
    if (isAbsolute(normalizedPath)) {
      return normalizedPath;
    }

    // For relative paths, resolve from current working directory
    return resolve(process.cwd(), normalizedPath);
  }

  /**
   * Check if a file has an allowed extension
   * @param filePath The path to check
   * @returns True if extension is allowed
   */
  public hasAllowedExtension(filePath: string): boolean {
    const extension = this.getExtension(filePath);
    return this.allowedExtensions.has(extension.toLowerCase());
  }

  /**
   * Validate that a path exists and is a file (not a directory)
   * @param filePath The path to check
   * @returns True if path exists and is a file
   */
  public isValidFile(filePath: string): boolean {
    try {
      if (!existsSync(filePath)) {
        return false;
      }

      const stats = statSync(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Validate that a path exists and is a directory
   * @param dirPath The path to check
   * @returns True if path exists and is a directory
   */
  public isValidDirectory(dirPath: string): boolean {
    try {
      if (!existsSync(dirPath)) {
        return false;
      }

      const stats = statSync(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get the file extension from a path
   * @param filePath The path to extract extension from
   * @returns The file extension including the dot
   */
  private getExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1 || lastDot === filePath.length - 1) {
      return '';
    }
    return filePath.slice(lastDot);
  }

  /**
   * Sanitize a filename to remove potentially dangerous characters
   * @param filename The filename to sanitize
   * @returns Sanitized filename
   */
  public sanitizeFilename(filename: string): string {
    // Remove path separators and other dangerous characters
    return filename
      .replace(/[\\/\\:*?"<>|]/gu, '_') // Replace dangerous chars with underscore
      .replace(/^\.+/, '') // Remove leading dots
      .replace(/\.{2,}/g, '.') // Replace multiple dots with single
      .replace(/\s+/g, '_') // Replace whitespace with underscore
      .slice(0, 255); // Limit filename length
  }
}
