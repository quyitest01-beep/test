import fs from 'node:fs';
import path from 'node:path';
import { watch, type FSWatcher } from 'chokidar';
import type { FileChangeEvent } from '../types/index.js';

type FileChangeCallback = (event: FileChangeEvent) => void;

export class MonitorService {
  private watcher: FSWatcher | null = null;
  private running = false;
  private watchDir: string | null = null;
  private callbacks: FileChangeCallback[] = [];

  /**
   * Start watching the given directory for `.spec.ts` file additions and changes.
   * Throws if the directory does not exist.
   */
  start(watchDir: string): void {
    if (this.running) {
      return;
    }

    const resolvedDir = path.resolve(watchDir);

    if (!fs.existsSync(resolvedDir)) {
      const msg = `[MonitorService] Watch directory does not exist: ${resolvedDir}`;
      console.error(msg);
      throw new Error(msg);
    }

    this.watcher = watch(resolvedDir, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50,
      },
    });

    this.watchDir = resolvedDir;

    this.watcher.on('add', (filePath: string) => {
      if (filePath.endsWith('.spec.ts')) {
        this.handleFileEvent('add', filePath);
      }
    });

    this.watcher.on('change', (filePath: string) => {
      if (filePath.endsWith('.spec.ts')) {
        this.handleFileEvent('change', filePath);
      }
    });

    this.watcher.on('error', (error: unknown) => {
      console.error(`[MonitorService] Watcher error: ${error}`);
    });

    this.running = true;
  }

  /**
   * Stop watching and clean up resources.
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.running = false;
    this.watchDir = null;
  }

  /**
   * Register a callback that fires on every valid file change event.
   */
  onFileChange(callback: FileChangeCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Returns whether the monitor is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get the current watch directory.
   */
  getWatchDir(): string | null {
    return this.watchDir;
  }

  /**
   * Manually scan the watch directory for all existing .spec.ts files
   * and dispatch events for each valid one. Returns the count of files processed.
   */
  scanExisting(): number {
    if (!this.watchDir) {
      throw new Error('[MonitorService] Not running, cannot scan.');
    }

    const files = this.findSpecFiles(this.watchDir);
    let count = 0;

    for (const filePath of files) {
      this.handleFileEvent('add', filePath);
      count++;
    }

    console.info(`[MonitorService] Scanned ${count} existing .spec.ts files in ${this.watchDir}`);
    return count;
  }

  /**
   * Recursively find all .spec.ts files in a directory.
   */
  private findSpecFiles(dir: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...this.findSpecFiles(fullPath));
        } else if (entry.name.endsWith('.spec.ts')) {
          results.push(fullPath);
        }
      }
    } catch (err) {
      console.warn(`[MonitorService] Failed to read directory ${dir}: ${err}`);
    }
    return results;
  }

  /**
   * Handle a raw file system event: read content, validate, and dispatch.
   */
  private handleFileEvent(type: 'add' | 'change', filePath: string): void {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      console.warn(`[MonitorService] Failed to read file ${filePath}: ${err}`);
      return;
    }

    if (!this.isValidContent(content)) {
      console.warn(
        `[MonitorService] Skipping file with empty or invalid content: ${filePath}`
      );
      return;
    }

    const event: FileChangeEvent = {
      type,
      filePath,
      fileName: path.basename(filePath),
      content,
      timestamp: new Date(),
    };

    this.dispatchEvent(event);
  }

  /**
   * Validate that file content is non-empty and looks like a valid spec file.
   * A valid spec file must have non-whitespace content and contain at least
   * an `import` statement or a `test`/`describe` block.
   */
  private isValidContent(content: string): boolean {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return false;
    }

    // Basic format check: should contain typical Playwright/test constructs
    const hasTestConstruct =
      /\b(test|describe|it)\s*\(/.test(trimmed) ||
      /\bimport\b/.test(trimmed);

    return hasTestConstruct;
  }

  /**
   * Dispatch a FileChangeEvent to all registered callbacks.
   */
  private dispatchEvent(event: FileChangeEvent): void {
    for (const cb of this.callbacks) {
      try {
        cb(event);
      } catch (err) {
        console.error(`[MonitorService] Callback error: ${err}`);
      }
    }
  }
}
