import fs from 'node:fs';
import path from 'node:path';
import { watch, type FSWatcher } from 'chokidar';
import type { AppConfig, ValidationResult } from '../types/index.js';

const DEFAULT_CONFIG: AppConfig = {
  watchDir: './tests/recorded',
  issueProvider: 'github',
  issueApiUrl: 'https://api.github.com',
  issueApiToken: '',
  issueRepo: 'owner/repo',
  testCaseDir: './tests/cases',
  serverPort: 3001,
  retryCount: 3,
  retryInterval: 10000,
  aiProvider: 'openai',
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  aiBaseUrl: 'https://api.openai.com/v1',
};

export class ConfigManager {
  private config: AppConfig;
  private configPath: string;
  private watcher: FSWatcher | null = null;
  private changeCallbacks: Array<(config: AppConfig) => void> = [];

  constructor(configPath?: string) {
    this.configPath = configPath ?? path.resolve('config.json');
    this.config = { ...DEFAULT_CONFIG };
  }

  load(): AppConfig {
    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AppConfig>;
      this.config = { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      console.warn(
        `[ConfigManager] Failed to load config from ${this.configPath}, using defaults.`
      );
      this.config = { ...DEFAULT_CONFIG };
    }

    const validation = this.validate(this.config);
    if (!validation.valid) {
      console.warn(
        `[ConfigManager] Config validation errors: ${validation.errors.join(', ')}. Using defaults for invalid fields.`
      );
    }

    this.startWatching();
    return { ...this.config };
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  update(updates: Partial<AppConfig>): void {
    const merged = { ...this.config, ...updates };
    const validation = this.validate(merged);
    if (!validation.valid) {
      throw new Error(
        `Invalid config update: ${validation.errors.join(', ')}`
      );
    }
    this.config = merged;
    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
    } catch (err) {
      console.error(`[ConfigManager] Failed to write config file: ${err}`);
    }
    this.notifyChange();
  }

  validate(config: Partial<AppConfig>): ValidationResult {
    const errors: string[] = [];

    if (config.watchDir !== undefined && typeof config.watchDir !== 'string') {
      errors.push('watchDir must be a string');
    }
    if (
      config.issueProvider !== undefined &&
      config.issueProvider !== 'github' &&
      config.issueProvider !== 'jira'
    ) {
      errors.push('issueProvider must be "github" or "jira"');
    }
    if (
      config.issueApiUrl !== undefined &&
      typeof config.issueApiUrl !== 'string'
    ) {
      errors.push('issueApiUrl must be a string');
    }
    if (
      config.issueApiToken !== undefined &&
      typeof config.issueApiToken !== 'string'
    ) {
      errors.push('issueApiToken must be a string');
    }
    if (
      config.testCaseDir !== undefined &&
      typeof config.testCaseDir !== 'string'
    ) {
      errors.push('testCaseDir must be a string');
    }
    if (config.serverPort !== undefined) {
      if (
        typeof config.serverPort !== 'number' ||
        !Number.isInteger(config.serverPort) ||
        config.serverPort < 1 ||
        config.serverPort > 65535
      ) {
        errors.push('serverPort must be an integer between 1 and 65535');
      }
    }
    if (config.retryCount !== undefined) {
      if (
        typeof config.retryCount !== 'number' ||
        !Number.isInteger(config.retryCount) ||
        config.retryCount < 0
      ) {
        errors.push('retryCount must be a non-negative integer');
      }
    }
    if (config.retryInterval !== undefined) {
      if (typeof config.retryInterval !== 'number' || config.retryInterval < 0) {
        errors.push('retryInterval must be a non-negative number');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  onConfigChange(callback: (config: AppConfig) => void): void {
    this.changeCallbacks.push(callback);
  }

  async destroy(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.changeCallbacks = [];
  }

  private startWatching(): void {
    if (this.watcher) return;

    try {
      this.watcher = watch(this.configPath, {
        persistent: false,
        ignoreInitial: true,
      });

      this.watcher.on('change', () => {
        try {
          const raw = fs.readFileSync(this.configPath, 'utf-8');
          const parsed = JSON.parse(raw) as Partial<AppConfig>;
          const newConfig = { ...DEFAULT_CONFIG, ...parsed };
          const validation = this.validate(newConfig);
          if (validation.valid) {
            this.config = newConfig;
            this.notifyChange();
          } else {
            console.warn(
              `[ConfigManager] Config file changed but has validation errors: ${validation.errors.join(', ')}`
            );
          }
        } catch {
          console.warn(
            '[ConfigManager] Failed to reload config after file change.'
          );
        }
      });
    } catch {
      console.warn('[ConfigManager] Failed to start config file watcher.');
    }
  }

  private notifyChange(): void {
    const snapshot = { ...this.config };
    for (const cb of this.changeCallbacks) {
      try {
        cb(snapshot);
      } catch (err) {
        console.error(`[ConfigManager] Change callback error: ${err}`);
      }
    }
  }
}

export { DEFAULT_CONFIG };
