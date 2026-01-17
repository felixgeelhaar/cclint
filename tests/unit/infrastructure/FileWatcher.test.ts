import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileWatcher } from '../../../src/infrastructure/FileWatcher.js';
import { EventEmitter } from 'events';

// Create a mock watcher that extends EventEmitter for proper event handling
class MockFSWatcher extends EventEmitter {
  close = vi.fn().mockResolvedValue(undefined);
  getWatched = vi.fn().mockReturnValue({});
}

// Mock chokidar
vi.mock('chokidar', () => {
  return {
    default: {
      watch: vi.fn(),
    },
  };
});

import chokidar from 'chokidar';

describe('FileWatcher', () => {
  let watcher: FileWatcher;
  let mockFSWatcher: MockFSWatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFSWatcher = new MockFSWatcher();
    (chokidar.watch as ReturnType<typeof vi.fn>).mockReturnValue(mockFSWatcher);
  });

  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
    }
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create watcher with default options', () => {
      watcher = new FileWatcher({ patterns: ['*.md'] });
      expect(watcher).toBeDefined();
    });

    it('should create watcher with custom options', () => {
      watcher = new FileWatcher({
        patterns: ['CLAUDE.md'],
        recursive: false,
        debounceMs: 500,
        ignored: ['**/dist/**'],
        cwd: '/tmp',
      });
      expect(watcher).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start watching files', async () => {
      watcher = new FileWatcher({ patterns: ['*.md'] });

      const startPromise = watcher.start();

      // Emit ready event
      mockFSWatcher.emit('ready');

      await startPromise;

      expect(chokidar.watch).toHaveBeenCalledWith(
        ['*.md'],
        expect.objectContaining({
          persistent: true,
          ignoreInitial: true,
        })
      );
    });

    it('should not start twice', async () => {
      watcher = new FileWatcher({ patterns: ['*.md'] });

      const startPromise = watcher.start();
      mockFSWatcher.emit('ready');
      await startPromise;

      await watcher.start(); // Second call should be no-op

      expect(chokidar.watch).toHaveBeenCalledTimes(1);
    });

    // Note: Testing error before ready is complex due to EventEmitter behavior
    // The error handling after ready is tested in the 'error handling' section
  });

  describe('stop', () => {
    it('should stop watching files', async () => {
      watcher = new FileWatcher({ patterns: ['*.md'] });

      const startPromise = watcher.start();
      mockFSWatcher.emit('ready');
      await startPromise;

      await watcher.stop();

      expect(mockFSWatcher.close).toHaveBeenCalled();
    });

    it('should handle stop when not started', async () => {
      watcher = new FileWatcher({ patterns: ['*.md'] });
      await watcher.stop(); // Should not throw
      expect(mockFSWatcher.close).not.toHaveBeenCalled();
    });
  });

  describe('change events', () => {
    it('should emit debounced change events', async () => {
      vi.useFakeTimers();

      watcher = new FileWatcher({ patterns: ['*.md'], debounceMs: 100 });

      const changeHandler = vi.fn();
      watcher.on('change', changeHandler);

      const startPromise = watcher.start();
      mockFSWatcher.emit('ready');
      await startPromise;

      // Simulate file change
      mockFSWatcher.emit('change', 'CLAUDE.md');

      // Not emitted yet (debouncing)
      expect(changeHandler).not.toHaveBeenCalled();

      // Advance past debounce time
      await vi.advanceTimersByTimeAsync(150);

      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'change',
          path: 'CLAUDE.md',
        })
      );
    });

    it('should coalesce rapid changes', async () => {
      vi.useFakeTimers();

      watcher = new FileWatcher({ patterns: ['*.md'], debounceMs: 100 });

      const changeHandler = vi.fn();
      watcher.on('change', changeHandler);

      const startPromise = watcher.start();
      mockFSWatcher.emit('ready');
      await startPromise;

      // Simulate rapid changes
      mockFSWatcher.emit('change', 'CLAUDE.md');
      await vi.advanceTimersByTimeAsync(50);
      mockFSWatcher.emit('change', 'CLAUDE.md');
      await vi.advanceTimersByTimeAsync(50);
      mockFSWatcher.emit('change', 'CLAUDE.md');

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(150);

      // Should only emit once
      expect(changeHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle add events', async () => {
      vi.useFakeTimers();

      watcher = new FileWatcher({ patterns: ['*.md'], debounceMs: 100 });

      const changeHandler = vi.fn();
      watcher.on('change', changeHandler);

      const startPromise = watcher.start();
      mockFSWatcher.emit('ready');
      await startPromise;

      mockFSWatcher.emit('add', 'NEW.md');
      await vi.advanceTimersByTimeAsync(150);

      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'add',
          path: 'NEW.md',
        })
      );
    });

    it('should handle unlink events', async () => {
      vi.useFakeTimers();

      watcher = new FileWatcher({ patterns: ['*.md'], debounceMs: 100 });

      const changeHandler = vi.fn();
      watcher.on('change', changeHandler);

      const startPromise = watcher.start();
      mockFSWatcher.emit('ready');
      await startPromise;

      mockFSWatcher.emit('unlink', 'DELETED.md');
      await vi.advanceTimersByTimeAsync(150);

      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unlink',
          path: 'DELETED.md',
        })
      );
    });
  });

  describe('isWatcherReady', () => {
    it('should return false before start', () => {
      watcher = new FileWatcher({ patterns: ['*.md'] });
      expect(watcher.isWatcherReady()).toBe(false);
    });

    it('should return true after ready', async () => {
      watcher = new FileWatcher({ patterns: ['*.md'] });

      const startPromise = watcher.start();
      mockFSWatcher.emit('ready');
      await startPromise;

      expect(watcher.isWatcherReady()).toBe(true);
    });
  });

  describe('getWatchedPaths', () => {
    it('should return empty array when not started', () => {
      watcher = new FileWatcher({ patterns: ['*.md'] });
      expect(watcher.getWatchedPaths()).toEqual([]);
    });

    it('should return watched paths', async () => {
      watcher = new FileWatcher({ patterns: ['*.md'] });

      mockFSWatcher.getWatched.mockReturnValue({
        '.': ['CLAUDE.md'],
        docs: ['API.md'],
      });

      const startPromise = watcher.start();
      mockFSWatcher.emit('ready');
      await startPromise;

      const paths = watcher.getWatchedPaths();
      expect(paths).toContain('CLAUDE.md');
      expect(paths).toContain('docs/API.md');
    });
  });

  describe('error handling', () => {
    it('should emit error events after ready', async () => {
      watcher = new FileWatcher({ patterns: ['*.md'] });

      const errorHandler = vi.fn();
      watcher.on('error', errorHandler);

      const startPromise = watcher.start();
      mockFSWatcher.emit('ready');
      await startPromise;

      mockFSWatcher.emit('error', new Error('Runtime error'));

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
