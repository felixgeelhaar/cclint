import { readFile } from 'fs/promises';
import { ContextFile } from '../domain/ContextFile.js';

export class FileReader {
  public async readContextFile(filePath: string): Promise<ContextFile> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return new ContextFile(filePath, content);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to read file ${filePath}: ${error.message}`);
      }
      throw new Error(`Failed to read file ${filePath}: Unknown error`);
    }
  }
}
