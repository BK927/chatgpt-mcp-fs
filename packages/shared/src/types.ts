// Shared types for ChatGPT MCP File System

export interface ServerConfig {
  port: number;
  allowedFolders: string[];
  autoStart: boolean;
  ngrokEnabled: boolean;
}

export interface ConfigInitResult {
  config: ServerConfig;
  isFirstRun: boolean;
}

export interface FolderConfig {
  path: string;
  alias?: string;
  permissions: FolderPermission[];
}

export type FolderPermission = 'read' | 'write' | 'delete';

export interface ServerStatus {
  running: boolean;
  port: number;
  pid?: number;
  ngrokUrl?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export interface ToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  createdAt: string;
}

export interface SearchResult {
  path: string;
  name: string;
  type: 'file' | 'directory';
  matchType: 'name' | 'path' | 'content';
}
