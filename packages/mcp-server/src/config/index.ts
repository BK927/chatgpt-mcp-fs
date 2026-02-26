import type { ServerConfig } from '@chatgpt-mcp-fs/shared';
import fs from 'fs/promises';
import path from 'path';

// In bundled CJS, __dirname is available. If not, use process.cwd()
const __dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const DEFAULT_CONFIG: ServerConfig = {
  port: 3000,
  allowedFolders: [],
  autoStart: false,
  ngrokEnabled: false,
};

let config: ServerConfig | null = null;

export function getConfig(): ServerConfig {
  if (!config) {
    throw new Error('Config not initialized. Call initConfig() first.');
  }
  return config;
}

export async function initConfig(configPath?: string): Promise<ServerConfig> {
  const configFile = configPath || path.join(__dirname, '..', '..', 'config.json');

  try {
    const data = await fs.readFile(configFile, 'utf-8');
    const userConfig = JSON.parse(data);
    config = { ...DEFAULT_CONFIG, ...userConfig };
  } catch {
    // Config file doesn't exist, use defaults
    config = { ...DEFAULT_CONFIG };
  }

  return config!;
}

export async function saveConfig(newConfig: Partial<ServerConfig>): Promise<void> {
  const currentConfig = getConfig();
  config = { ...currentConfig, ...newConfig };

  const configPath = path.join(__dirname, '..', '..', 'config.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function addAllowedFolder(folder: string): void {
  const currentConfig = getConfig();
  if (!currentConfig.allowedFolders.includes(folder)) {
    currentConfig.allowedFolders.push(folder);
  }
}

export function removeAllowedFolder(folder: string): void {
  const currentConfig = getConfig();
  const index = currentConfig.allowedFolders.indexOf(folder);
  if (index !== -1) {
    currentConfig.allowedFolders.splice(index, 1);
  }
}

export function setAllowedFolders(folders: string[]): void {
  const currentConfig = getConfig();
  currentConfig.allowedFolders = [...folders];
}
