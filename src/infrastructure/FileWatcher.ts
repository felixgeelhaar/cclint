import chokidar, { type FSWatcher, type ChokidarOptions } from 'chokidar';
import { EventEmitter } from 'events';

/**
 * Options for configuring the FileWatcher
 */
export interface FileWatcherOptions {
  /** File patterns to watch (glob patterns supported) */
  patterns: string[];
  /** Watch directories recursively */
  recursive?: boolean;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Patterns to ignore */
  ignored?: string[];
  /** Current working directory */
  cwd?: string;
}

/**
 * Event emitted when a file changes
 */
export interface FileChangeEvent {
  /** Type of change */
  type: 'add' | 'change' | 'unlink';
  /** Path to the changed file */
  path: string;
  /** Timestamp of the change */
  timestamp: Date;
}

/**
 * Cross-platform file watcher with debouncing support.
 * Uses chokidar for reliable file system watching.
 */
export class FileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private options: Required<FileWatcherOptions>;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private isReady = false;

  constructor(options: FileWatcherOptions) {
    super();
    this.options = {
      patterns: options.patterns,
      recursive: options.recursive ?? true,
      debounceMs: options.debounceMs ?? 300,
      ignored: options.ignored ?? [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/coverage/**',
      ],
      cwd: options.cwd ?? process.cwd(),
    };
  }

  /**
   * Start watching for file changes
   */
  async start(): Promise<void> {
    if (this.watcher) {
      return;
    }

    return new Promise((resolve, reject) => {
      const watchOptions: ChokidarOptions = {
        ignored: this.options.ignored,
        persistent: true,
        ignoreInitial: true,
        cwd: this.options.cwd,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      };

      // Only set depth if not recursive (0 means current dir only)
      if (!this.options.recursive) {
        watchOptions.depth = 0;
      }

      this.watcher = chokidar.watch(this.options.patterns, watchOptions);

      this.watcher.on('ready', () => {
        this.isReady = true;
        this.emit('ready');
        resolve();
      });

      this.watcher.on('error', (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        this.emit('error', error);
        if (!this.isReady) {
          reject(error);
        }
      });

      this.watcher.on('add', (path: string) => {
        this.handleChange('add', path);
      });

      this.watcher.on('change', (path: string) => {
        this.handleChange('change', path);
      });

      this.watcher.on('unlink', (path: string) => {
        this.handleChange('unlink', path);
      });
    });
  }

  /**
   * Stop watching for file changes
   */
  async stop(): Promise<void> {
    // Clear all pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.isReady = false;
    }
  }

  /**
   * Get the list of watched paths
   */
  getWatchedPaths(): string[] {
    if (!this.watcher) {
      return [];
    }
    const watched = this.watcher.getWatched();
    const paths: string[] = [];
    for (const [dir, files] of Object.entries(watched)) {
      for (const file of files) {
        paths.push(dir === '.' ? file : `${dir}/${file}`);
      }
    }
    return paths;
  }

  /**
   * Check if the watcher is ready
   */
  isWatcherReady(): boolean {
    return this.isReady;
  }

  private handleChange(type: 'add' | 'change' | 'unlink', path: string): void {
    // Cancel any pending debounce for this file
    const existingTimer = this.debounceTimers.get(path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set up debounced emission
    const timer = setTimeout(() => {
      this.debounceTimers.delete(path);
      const event: FileChangeEvent = {
        type,
        path,
        timestamp: new Date(),
      };
      this.emit('change', event);
    }, this.options.debounceMs);

    this.debounceTimers.set(path, timer);
  }
}
